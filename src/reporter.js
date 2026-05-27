import { writeFile } from 'node:fs/promises';
import chalk from 'chalk';
import Table from 'cli-table3';
import { renderBarChart } from './chart.js';

const nf = new Intl.NumberFormat('en-US');
const fmt = (n) => nf.format(n ?? 0);

function signedFmt(n) {
  if (n > 0) return chalk.green(`+${nf.format(n)}`);
  if (n < 0) return chalk.red(nf.format(n));
  return chalk.dim('0');
}

export function sortData(items, sortField, type = 'language') {
  if (!sortField || !items) return items;
  const copy = [...items];
  const key = sortField.toLowerCase();

  const sorters = {
    name: (a, b) => {
      const aName = type === 'file' ? a.relPath : a.language;
      const bName = type === 'file' ? b.relPath : b.language;
      return aName.localeCompare(bName);
    },
    lines: (a, b) => (b.total ?? 0) - (a.total ?? 0),
    code: (a, b) => (b.code ?? 0) - (a.code ?? 0),
    files: (a, b) => (b.files ?? 0) - (a.files ?? 0),
  };

  if (sorters[key]) copy.sort(sorters[key]);
  return copy;
}

export async function emitReport(report, opts = {}) {
  const format = opts.format || 'terminal';

  if (format === 'json') {
    return writeOrPrint(JSON.stringify(report, null, 2), opts.output);
  }
  if (format === 'csv') {
    return writeOrPrint(renderCsv(report), opts.output);
  }

  const text = renderTerminal(report, opts);
  if (opts.output) {
    await writeFile(opts.output, stripAnsi(text), 'utf8');
    console.log(chalk.green(`Report written to ${opts.output}`));
  } else {
    process.stdout.write(text);
  }
}

export async function emitCompareReport(diff, opts = {}) {
  const format = opts.format || 'terminal';

  if (format === 'json') {
    return writeOrPrint(JSON.stringify(diff, null, 2), opts.output);
  }

  const text = renderCompareTerminal(diff);
  if (opts.output) {
    await writeFile(opts.output, stripAnsi(text), 'utf8');
    console.log(chalk.green(`Comparison written to ${opts.output}`));
  } else {
    process.stdout.write(text);
  }
}

export async function emitMonorepoReport(results, opts = {}) {
  const format = opts.format || 'terminal';

  if (format === 'json') {
    return writeOrPrint(JSON.stringify(results, null, 2), opts.output);
  }

  const lines = [];
  lines.push('');
  lines.push(chalk.bold.cyan(`DevRadar Monorepo Analysis`));
  lines.push(chalk.dim(`Type: `) + chalk.white(results.type));
  lines.push(chalk.dim(`Workspaces: `) + chalk.white(results.workspaces.length));
  lines.push('');

  for (const ws of results.workspaces) {
    lines.push(chalk.bold.yellow(`── ${ws.name} `) + chalk.dim(`(${ws.path})`));
    const s = ws.report.summary;
    lines.push(`   Files: ${fmt(s.totalFiles)}  Code: ${chalk.green(fmt(s.codeLines))}  Total: ${fmt(s.totalLines)}`);
    if (ws.report.technologies.frameworks.length > 0) {
      lines.push(`   Frameworks: ${chalk.white(ws.report.technologies.frameworks.join(', '))}`);
    }
    lines.push('');
  }

  const agg = results.aggregate;
  lines.push(chalk.bold.cyan('Aggregate Summary'));
  lines.push(chalk.dim('Total files: ') + fmt(agg.totalFiles));
  lines.push(chalk.dim('Total lines: ') + fmt(agg.totalLines));
  lines.push(chalk.dim('Code lines:  ') + chalk.green(fmt(agg.codeLines)));
  lines.push('');

  const text = lines.join('\n');
  if (opts.output) {
    await writeFile(opts.output, stripAnsi(text), 'utf8');
    console.log(chalk.green(`Report written to ${opts.output}`));
  } else {
    process.stdout.write(text);
  }
}

async function writeOrPrint(text, output) {
  if (output) {
    await writeFile(output, text, 'utf8');
    console.log(chalk.green(`Report written to ${output}`));
  } else {
    process.stdout.write(text + '\n');
  }
}

function renderTerminal(report, opts) {
  const out = [];
  const pureCode = !!opts.pureCode;
  const sortField = opts.sort;

  out.push('');
  out.push(chalk.bold.cyan('DevRadar Analysis'));
  out.push(chalk.dim('Project: ') + chalk.white(report.root));
  out.push(chalk.dim('Scanned: ') + chalk.white(report.scannedAt));
  if (report.engine) {
    out.push(chalk.dim('Engine:  ') + chalk.white(report.engine));
  }
  out.push('');

  out.push(chalk.bold.cyan('Technologies'));
  out.push(techLine('Frameworks       ', report.technologies.frameworks));
  out.push(techLine('Package managers ', report.technologies.packageManagers));
  out.push(techLine('Build tools      ', report.technologies.buildTools));
  out.push(techLine('Databases        ', report.technologies.databases));
  out.push('');

  if (opts.techOnly) return out.join('\n') + '\n';

  const s = report.summary;
  out.push(chalk.bold.cyan('Summary'));
  out.push(chalk.dim('Files:    ') + fmt(s.totalFiles));
  if (pureCode) {
    out.push(chalk.dim('Code:     ') + chalk.green(fmt(s.codeLines)) + chalk.dim(' lines (pure code, comments and blanks excluded)'));
  } else {
    out.push(chalk.dim('Total:    ') + fmt(s.totalLines) + chalk.dim(' lines'));
    out.push(chalk.dim('Code:     ') + chalk.green(fmt(s.codeLines)));
    out.push(chalk.dim('Comments: ') + chalk.yellow(fmt(s.commentLines)));
    out.push(chalk.dim('Blank:    ') + chalk.gray(fmt(s.blankLines)));
  }
  if (s.binaryFiles > 0) {
    out.push(chalk.dim(`Binary files skipped: ${fmt(s.binaryFiles)}`));
  }
  if (s.unknownStyleFiles > 0) {
    out.push(chalk.dim(`Files with unknown comment style: ${fmt(s.unknownStyleFiles)}`));
  }
  out.push('');

  const sortedLangs = sortData(report.byLanguage, sortField, 'language');

  if (sortedLangs.length > 0) {
    out.push(renderBarChart(sortedLangs));

    out.push(chalk.bold.cyan('By Language'));
    if (sortField) out.push(chalk.dim(`  (sorted by ${sortField})`));
    out.push(renderLanguageTable(sortedLangs, pureCode));
    out.push('');
  }

  if (opts.advanced && report.files && report.files.length > 0) {
    const sortedFiles = sortData(report.files, sortField, 'file');
    out.push(chalk.bold.cyan('Per-File Details'));
    if (sortField) out.push(chalk.dim(`  (sorted by ${sortField})`));
    out.push(renderFileTable(sortedFiles, pureCode));
    out.push('');
  }

  return out.join('\n');
}

function renderCompareTerminal(diff) {
  const out = [];
  out.push('');
  out.push(chalk.bold.cyan('DevRadar Comparison'));
  out.push(chalk.dim('Previous: ') + chalk.white(diff.previousDate));
  out.push(chalk.dim('Current:  ') + chalk.white(diff.currentDate));
  out.push('');

  out.push(chalk.bold.cyan('Summary Changes'));
  const fields = [
    ['totalFiles', 'Files'],
    ['totalLines', 'Total lines'],
    ['codeLines', 'Code'],
    ['commentLines', 'Comments'],
    ['blankLines', 'Blank'],
  ];
  for (const [key, label] of fields) {
    const d = diff.summaryDiff[key];
    if (!d) continue;
    out.push(
      `  ${chalk.dim(label.padEnd(14))} ${fmt(d.prev)} → ${fmt(d.curr)}  (${signedFmt(d.delta)})`,
    );
  }
  out.push('');

  if (diff.added.length > 0) {
    out.push(chalk.green('+ Languages added: ') + diff.added.join(', '));
  }
  if (diff.removed.length > 0) {
    out.push(chalk.red('- Languages removed: ') + diff.removed.join(', '));
  }
  if (diff.techDiff.addedFrameworks.length > 0) {
    out.push(chalk.green('+ Frameworks added: ') + diff.techDiff.addedFrameworks.join(', '));
  }
  if (diff.techDiff.removedFrameworks.length > 0) {
    out.push(chalk.red('- Frameworks removed: ') + diff.techDiff.removedFrameworks.join(', '));
  }
  out.push('');

  if (diff.languageDiffs.length > 0) {
    out.push(chalk.bold.cyan('Language Changes'));
    const table = new Table({
      head: ['Language', 'Prev Code', 'Curr Code', 'Delta'].map((h) => chalk.bold(h)),
      colAligns: ['left', 'right', 'right', 'right'],
    });
    for (const ld of diff.languageDiffs) {
      if (ld.delta === 0) continue;
      table.push([ld.language, fmt(ld.prevCode), fmt(ld.currCode), signedFmt(ld.delta)]);
    }
    if (table.length > 0) out.push(table.toString());
    out.push('');
  }

  return out.join('\n');
}

function techLine(label, items) {
  const prefix = chalk.dim(label + ': ');
  if (!items || items.length === 0) return prefix + chalk.dim('(none detected)');
  return prefix + chalk.white(items.join(', '));
}

function renderLanguageTable(languages, pureCode) {
  const head = pureCode
    ? ['Language', 'Files', 'Code']
    : ['Language', 'Files', 'Total', 'Code', 'Comments', 'Blank'];
  const colAligns = pureCode
    ? ['left', 'right', 'right']
    : ['left', 'right', 'right', 'right', 'right', 'right'];
  const table = new Table({
    head: head.map((h) => chalk.bold(h)),
    colAligns,
  });
  for (const lang of languages) {
    if (pureCode) {
      table.push([lang.language, fmt(lang.files), fmt(lang.code)]);
    } else {
      table.push([
        lang.language,
        fmt(lang.files),
        fmt(lang.total),
        chalk.green(fmt(lang.code)),
        chalk.yellow(fmt(lang.comment)),
        chalk.gray(fmt(lang.blank)),
      ]);
    }
  }
  return table.toString();
}

function renderFileTable(files, pureCode) {
  const head = pureCode
    ? ['File', 'Language', 'Code']
    : ['File', 'Language', 'Total', 'Code', 'Comments', 'Blank'];
  const colAligns = pureCode
    ? ['left', 'left', 'right']
    : ['left', 'left', 'right', 'right', 'right', 'right'];
  const table = new Table({
    head: head.map((h) => chalk.bold(h)),
    colAligns,
  });
  for (const f of files) {
    if (pureCode) {
      table.push([f.relPath, f.language, fmt(f.code)]);
    } else {
      table.push([
        f.relPath,
        f.language,
        fmt(f.total),
        chalk.green(fmt(f.code)),
        chalk.yellow(fmt(f.comment)),
        chalk.gray(fmt(f.blank)),
      ]);
    }
  }
  return table.toString();
}

function renderCsv(report) {
  const rows = [];
  rows.push(['# Summary']);
  rows.push(['totalFiles', report.summary.totalFiles]);
  rows.push(['totalLines', report.summary.totalLines]);
  rows.push(['codeLines', report.summary.codeLines]);
  rows.push(['commentLines', report.summary.commentLines]);
  rows.push(['blankLines', report.summary.blankLines]);
  rows.push(['binaryFiles', report.summary.binaryFiles]);
  rows.push([]);
  rows.push(['# Technologies']);
  rows.push(['frameworks', report.technologies.frameworks.join(';')]);
  rows.push(['packageManagers', report.technologies.packageManagers.join(';')]);
  rows.push(['buildTools', report.technologies.buildTools.join(';')]);
  rows.push(['databases', report.technologies.databases.join(';')]);
  rows.push([]);
  rows.push(['# By Language']);
  rows.push(['language', 'files', 'total', 'code', 'comment', 'blank']);
  for (const lang of report.byLanguage) {
    rows.push([lang.language, lang.files, lang.total, lang.code, lang.comment, lang.blank]);
  }
  if (report.files && report.files.length > 0) {
    rows.push([]);
    rows.push(['# By File']);
    rows.push(['path', 'language', 'total', 'code', 'comment', 'blank']);
    for (const f of report.files) {
      rows.push([f.relPath, f.language, f.total, f.code, f.comment, f.blank]);
    }
  }
  return rows.map((row) => row.map(csvEscape).join(',')).join('\n');
}

function csvEscape(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function stripAnsi(s) {
  return s.replace(/\x1B\[[0-9;]*m/g, '');
}
