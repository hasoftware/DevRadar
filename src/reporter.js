import { writeFile } from 'node:fs/promises';
import chalk from 'chalk';
import Table from 'cli-table3';

const nf = new Intl.NumberFormat('en-US');
const fmt = (n) => nf.format(n ?? 0);

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

  if (report.byLanguage.length > 0) {
    out.push(chalk.bold.cyan('By Language'));
    out.push(renderLanguageTable(report.byLanguage, pureCode));
    out.push('');
  }

  if (opts.advanced && report.files && report.files.length > 0) {
    out.push(chalk.bold.cyan('Per-File Details'));
    out.push(renderFileTable(report.files, pureCode));
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
