import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Command, Option } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { scanProject } from './scanner.js';
import { detectFrameworks } from './detector.js';
import { selectEngine } from './engines/index.js';
import * as tokeiEngine from './engines/tokei.js';
import * as clocEngine from './engines/cloc.js';
import * as builtinEngine from './engines/builtin.js';
import { emitReport, emitCompareReport, emitMonorepoReport } from './reporter.js';
import { detectMonorepo } from './monorepo.js';
import { loadPreviousReport, computeDiff } from './compare.js';
import { isRemoteUrl, cloneToTemp, cleanup } from './remote.js';
import { runInteractive } from './interactive.js';
import { loadConfig, mergeConfig } from './config.js';

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

async function resolveForcedEngine(opts) {
  if (opts.tokei) return ensureAvailable(tokeiEngine, 'tokei', 'https://github.com/XAMPPRocky/tokei');
  if (opts.cloc) return ensureAvailable(clocEngine, 'cloc', 'https://github.com/AlDanial/cloc');
  if (opts.builtin) return builtinEngine;
  return null;
}

async function ensureAvailable(engine, label, url) {
  if (await engine.isAvailable()) return engine;
  const err = new Error(
    `--${label} was requested but ${label} is not installed or not on PATH. Install it from ${url}.`,
  );
  err.code = 'ENGINE_UNAVAILABLE';
  throw err;
}

function inferFormatFromPath(outputPath) {
  const ext = path.extname(outputPath).toLowerCase();
  if (ext === '.json') return 'json';
  if (ext === '.csv') return 'csv';
  return null;
}

async function handleMonorepo(rootPath, mono, opts) {
  const results = {
    type: mono.type,
    workspaces: [],
    aggregate: { totalFiles: 0, totalLines: 0, codeLines: 0, commentLines: 0, blankLines: 0 },
  };

  for (const ws of mono.workspaces) {
    const report = await analyze(ws.absPath, opts);
    results.workspaces.push({ name: ws.name, path: ws.path, report });
    results.aggregate.totalFiles += report.summary.totalFiles;
    results.aggregate.totalLines += report.summary.totalLines;
    results.aggregate.codeLines += report.summary.codeLines;
    results.aggregate.commentLines += report.summary.commentLines;
    results.aggregate.blankLines += report.summary.blankLines;
  }

  return results;
}

export async function run(argv = process.argv) {
  const program = new Command();
  const version = await readPackageVersion();

  program
    .name('devradar')
    .description('Analyze a code project: line counts, languages, frameworks.')
    .version(version, '-v, --version', 'output the version')
    .argument('[path]', 'path to the project (or a Git URL) to analyze (default: current directory)', '.')
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
    .addOption(
      new Option('--tokei', 'force the tokei line-counting engine').conflicts([
        'cloc',
        'builtin',
      ]),
    )
    .addOption(
      new Option('--cloc', 'force the cloc line-counting engine').conflicts([
        'tokei',
        'builtin',
      ]),
    )
    .addOption(
      new Option('--builtin', 'force the built-in line-counting engine').conflicts([
        'tokei',
        'cloc',
      ]),
    )
    .option('-i, --interactive', 'launch interactive mode to select options')
    .option('--monorepo', 'detect and analyze workspaces separately')
    .option('--compare <file>', 'compare against a previous JSON report')
    .addOption(
      new Option('-s, --sort <field>', 'sort tables by field')
        .choices(['name', 'lines', 'code', 'files']),
    )
    .action(async (pathArg, opts) => {
      if (opts.interactive) {
        const interactiveOpts = await runInteractive();
        pathArg = interactiveOpts.path;
        opts = { ...opts, ...interactiveOpts };
      }

      const fileConfig = await loadConfig(pathArg === '.' ? process.cwd() : pathArg);
      opts = mergeConfig(opts, fileConfig);

      let targetPath = pathArg;
      let tempDir = null;

      if (isRemoteUrl(pathArg)) {
        const useSpinner = process.stderr.isTTY;
        const cloneSpinner = useSpinner
          ? ora({ text: `Cloning ${pathArg}...`, spinner: 'dots', stream: process.stderr }).start()
          : null;
        try {
          tempDir = await cloneToTemp(pathArg);
          targetPath = tempDir;
          if (cloneSpinner) cloneSpinner.succeed(chalk.green('Repository cloned'));
        } catch (err) {
          if (cloneSpinner) cloneSpinner.fail(chalk.red('Clone failed'));
          throw err;
        }
      }

      try {
        let format = opts.format;
        if (!format && opts.output) format = inferFormatFromPath(opts.output);
        if (!format) format = opts.output ? 'json' : 'terminal';

        const forced = await resolveForcedEngine(opts);

        if (opts.compare) {
          const previous = await loadPreviousReport(opts.compare);
          const useSpinner = process.stderr.isTTY && format === 'terminal' && !opts.output;
          const spinner = useSpinner
            ? ora({ text: 'Analyzing project...', spinner: 'dots', stream: process.stderr }).start()
            : null;
          let report;
          try {
            report = await analyze(targetPath, { ...opts, engine: forced });
            if (spinner) spinner.succeed(chalk.green('Analysis complete'));
          } catch (err) {
            if (spinner) spinner.fail(chalk.red('Analysis failed'));
            throw err;
          }
          const diff = computeDiff(previous, report);
          await emitCompareReport(diff, { ...opts, format });
          return;
        }

        if (opts.monorepo) {
          const mono = await detectMonorepo(targetPath);
          if (!mono) {
            console.log(chalk.yellow('No monorepo workspaces detected. Running standard analysis.'));
          } else {
            const useSpinner = process.stderr.isTTY && format === 'terminal' && !opts.output;
            const spinner = useSpinner
              ? ora({ text: `Analyzing ${mono.workspaces.length} workspaces...`, spinner: 'dots', stream: process.stderr }).start()
              : null;
            try {
              const results = await handleMonorepo(targetPath, mono, { ...opts, engine: forced });
              if (spinner) spinner.succeed(chalk.green('Monorepo analysis complete'));
              await emitMonorepoReport(results, { ...opts, format });
              return;
            } catch (err) {
              if (spinner) spinner.fail(chalk.red('Monorepo analysis failed'));
              throw err;
            }
          }
        }

        const useSpinner = process.stderr.isTTY && format === 'terminal' && !opts.output;
        const spinner = useSpinner
          ? ora({ text: 'Analyzing project...', spinner: 'dots', stream: process.stderr }).start()
          : null;

        let report;
        try {
          report = await analyze(targetPath, { ...opts, engine: forced });
          if (spinner) spinner.succeed(chalk.green('Analysis complete'));
        } catch (err) {
          if (spinner) spinner.fail(chalk.red('Analysis failed'));
          throw err;
        }

        await emitReport(report, { ...opts, format });
      } finally {
        if (tempDir) await cleanup(tempDir);
      }
    });

  await program.parseAsync(argv);
}
