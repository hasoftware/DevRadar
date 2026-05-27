import chalk from 'chalk';

const BAR_WIDTH = 30;
const FILLED = '█';
const EMPTY = '░';

const COLORS = [
  chalk.cyan,
  chalk.green,
  chalk.yellow,
  chalk.magenta,
  chalk.blue,
  chalk.red,
  chalk.white,
  chalk.gray,
];

const nf = new Intl.NumberFormat('en-US');

export function renderBarChart(languages, { maxItems = 10, valueKey = 'code' } = {}) {
  if (!languages || languages.length === 0) return '';

  const items = languages.slice(0, maxItems);
  const total = items.reduce((sum, l) => sum + (l[valueKey] || 0), 0);
  if (total === 0) return '';

  const maxNameLen = Math.max(...items.map((l) => l.language.length));
  const lines = [];

  lines.push(chalk.bold.cyan('Language Distribution'));
  lines.push('');

  for (let i = 0; i < items.length; i++) {
    const lang = items[i];
    const value = lang[valueKey] || 0;
    const pct = (value / total) * 100;
    const filled = Math.round((pct / 100) * BAR_WIDTH);
    const empty = BAR_WIDTH - filled;
    const color = COLORS[i % COLORS.length];
    const name = lang.language.padEnd(maxNameLen);
    const bar = color(FILLED.repeat(filled)) + chalk.dim(EMPTY.repeat(empty));
    const pctStr = pct.toFixed(1).padStart(5) + '%';
    const countStr = chalk.dim(`(${nf.format(value)} lines)`);

    lines.push(`  ${name}  ${bar}  ${pctStr}  ${countStr}`);
  }

  if (languages.length > maxItems) {
    const rest = languages.slice(maxItems);
    const restTotal = rest.reduce((sum, l) => sum + (l[valueKey] || 0), 0);
    const pct = total > 0 ? ((restTotal / (total + restTotal)) * 100).toFixed(1) : '0.0';
    lines.push(chalk.dim(`  ... and ${rest.length} more languages (${pct}%)`));
  }

  lines.push('');
  return lines.join('\n');
}
