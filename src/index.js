import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Command, Option } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { scanProject } from './scanner.js';
import { detectFrameworks } from './detector.js';
import { selectEngine } from './engines/index.js';
import { emitReport } from './reporter.js';

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

const EMPTY_SUMMARY = {
  totalFiles: 0,
  totalLines: 0,
  codeLines: 0,
  commentLines: 0,
  blankLines: 0,
  binaryFiles: 0,
  unknownStyleFiles: 0,
};

export async function analyze(rootPath, options = {}) {
  const scan = await scanProject(rootPath, { exclude: options.exclude || [] });
  const tech = await detectFrameworks(scan.root, scan.files);

  let engineName = null;
  let summary = { ...EMPTY_SUMMARY };
  let byLanguage = [];
  let files;

  if (!options.techOnly) {
    const engine = options.engine || (await selectEngine());
    engineName = engine.displayName || engine.name;
    const result = await engine.run(scan.root, {
      exclude: options.exclude || [],
      advanced: !!options.advanced,
    });
    summary = result.summary;
    byLanguage = result.byLanguage;
    files = result.files;
  }

  return {
    root: scan.root,
    scannedAt: new Date().toISOString(),
    engine: engineName,
    options: {
      pureCode: !!options.pureCode,
      advanced: !!options.advanced,
      techOnly: !!options.techOnly,
      exclude: options.exclude || [],
    },
    technologies: tech,
    summary,
    byLanguage,
    files,
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
    .argument('[path]', 'path to the project to analyze (default: current directory)', '.')
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
      let format = opts.format;
      if (!format && opts.output) format = inferFormatFromPath(opts.output);
      if (!format) format = opts.output ? 'json' : 'terminal';

      const useSpinner = process.stderr.isTTY && format === 'terminal' && !opts.output;
      const spinner = useSpinner
        ? ora({ text: 'Analyzing project...', spinner: 'dots', stream: process.stderr }).start()
        : null;

      let report;
      try {
        report = await analyze(pathArg, opts);
        if (spinner) spinner.succeed(chalk.green('Analysis complete'));
      } catch (err) {
        if (spinner) spinner.fail(chalk.red('Analysis failed'));
        throw err;
      }

      await emitReport(report, { ...opts, format });
    });

  await program.parseAsync(argv);
}
