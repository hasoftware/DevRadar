import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Command, Option } from 'commander';
import { scanProject } from './scanner.js';
import { countFile } from './counter.js';
import { detectLanguage, detectFrameworks } from './detector.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function readPackageVersion() {
  try {
    const pkgPath = path.join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(Math.max(1, limit), Math.max(1, items.length)) },
    async () => {
      while (true) {
        const i = next++;
        if (i >= items.length) return;
        try {
          results[i] = await fn(items[i]);
        } catch (err) {
          results[i] = {
            file: items[i],
            language: null,
            counts: {
              total: 0,
              code: 0,
              comment: 0,
              blank: 0,
              error: err?.message || String(err),
            },
          };
        }
      }
    },
  );
  await Promise.all(workers);
  return results;
}

export async function analyze(rootPath, options = {}) {
  const scan = await scanProject(rootPath, { exclude: options.exclude || [] });
  const tech = await detectFrameworks(scan.root, scan.files);

  const fileReports = options.techOnly
    ? []
    : await mapWithConcurrency(scan.files, 16, async (file) => {
        const counts = await countFile(file);
        const language = detectLanguage(file);
        return { file, language, counts };
      });

  const summary = {
    totalFiles: 0,
    totalLines: 0,
    codeLines: 0,
    commentLines: 0,
    blankLines: 0,
    binaryFiles: 0,
    unknownStyleFiles: 0,
  };
  const byLanguage = new Map();
  const fileEntries = [];

  for (const r of fileReports) {
    if (r.counts.binary) {
      summary.binaryFiles++;
      continue;
    }
    summary.totalFiles++;
    summary.totalLines += r.counts.total;
    summary.codeLines += r.counts.code;
    summary.commentLines += r.counts.comment;
    summary.blankLines += r.counts.blank;
    if (r.counts.unknownStyle) summary.unknownStyleFiles++;

    const lang = r.language || 'Other';
    if (!byLanguage.has(lang)) {
      byLanguage.set(lang, {
        language: lang,
        files: 0,
        total: 0,
        code: 0,
        comment: 0,
        blank: 0,
      });
    }
    const entry = byLanguage.get(lang);
    entry.files++;
    entry.total += r.counts.total;
    entry.code += r.counts.code;
    entry.comment += r.counts.comment;
    entry.blank += r.counts.blank;

    fileEntries.push({
      relPath: r.file.relPath,
      language: lang,
      total: r.counts.total,
      code: r.counts.code,
      comment: r.counts.comment,
      blank: r.counts.blank,
    });
  }

  const byLanguageArr = [...byLanguage.values()].sort((a, b) => b.code - a.code);

  return {
    root: scan.root,
    scannedAt: new Date().toISOString(),
    options: {
      pureCode: !!options.pureCode,
      advanced: !!options.advanced,
      techOnly: !!options.techOnly,
      exclude: options.exclude || [],
    },
    technologies: tech,
    summary,
    byLanguage: byLanguageArr,
    files: options.advanced
      ? fileEntries.sort((a, b) => a.relPath.localeCompare(b.relPath))
      : undefined,
  };
}

function collectExcludes(value, previous) {
  return previous.concat([value]);
}

function inferFormatFromPath(outputPath) {
  const ext = path.extname(outputPath).toLowerCase();
  if (ext === '.json') return 'json';
  if (ext === '.csv') return 'csv';
  return null;
}

export async function run(argv = process.argv) {
  const program = new Command();
  const version = await readPackageVersion();

  program
    .name('devradar')
    .description('Analyze a code project: line counts, languages, frameworks.')
    .version(version, '-v, --version', 'output the version')
    .argument('<path>', 'path to the project to analyze')
    .option('-p, --pure-code', 'exclude comments and blank lines from totals')
    .option('-a, --advanced', 'include per-file statistics')
    .option('--tech-only', 'only show language and framework detection')
    .option('-o, --output <file>', 'write the report to a file instead of stdout')
    .addOption(
      new Option('-f, --format <format>', 'output format')
        .choices(['terminal', 'json', 'csv']),
    )
    .option(
      '--exclude <pattern>',
      'additional exclude pattern (can be repeated)',
      collectExcludes,
      [],
    )
    .action(async (pathArg, opts) => {
      const report = await analyze(pathArg, opts);

      const reporter = await import('./reporter.js').catch(() => null);

      let format = opts.format;
      if (!format && opts.output) format = inferFormatFromPath(opts.output);
      if (!format) format = opts.output ? 'json' : 'terminal';

      if (reporter && typeof reporter.emitReport === 'function') {
        await reporter.emitReport(report, { ...opts, format });
      } else {
        const text =
          format === 'csv' ? toCsvFallback(report) : JSON.stringify(report, null, 2);
        if (opts.output) {
          const { writeFile } = await import('node:fs/promises');
          await writeFile(opts.output, text, 'utf8');
          console.log(`Report written to ${opts.output}`);
        } else {
          process.stdout.write(text + '\n');
        }
      }
    });

  await program.parseAsync(argv);
}

function toCsvFallback(report) {
  const rows = [['language', 'files', 'total', 'code', 'comment', 'blank']];
  for (const lang of report.byLanguage) {
    rows.push([lang.language, lang.files, lang.total, lang.code, lang.comment, lang.blank]);
  }
  return rows.map((r) => r.join(',')).join('\n');
}
