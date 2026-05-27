import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import chalk from 'chalk';

async function select(rl, message, choices) {
  console.log('');
  console.log(chalk.bold.cyan(message));
  for (let i = 0; i < choices.length; i++) {
    const marker = chalk.cyan(`  ${i + 1})`);
    const desc = choices[i].description
      ? chalk.dim(` - ${choices[i].description}`)
      : '';
    console.log(`${marker} ${choices[i].label}${desc}`);
  }
  const answer = await rl.question(chalk.dim('  Choose [1]: '));
  const idx = parseInt(answer, 10) - 1;
  if (idx >= 0 && idx < choices.length) return choices[idx].value;
  return choices[0].value;
}

async function input(rl, message, defaultValue) {
  const suffix = defaultValue ? chalk.dim(` [${defaultValue}]`) : '';
  const answer = await rl.question(chalk.bold.cyan(message) + suffix + ' ');
  return answer.trim() || defaultValue || '';
}

export async function runInteractive() {
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    const projectPath = await input(rl, 'Project path: ', '.');

    const mode = await select(rl, 'Analysis mode?', [
      { label: 'Basic (all lines)', value: 'basic' },
      { label: 'Pure code (exclude comments & blanks)', value: 'pure' },
      { label: 'Advanced (per-file)', value: 'advanced' },
      { label: 'Pure code + Advanced', value: 'both' },
    ]);

    const engine = await select(rl, 'Line counting engine?', [
      { label: 'Auto-detect', value: 'auto' },
      { label: 'tokei', value: 'tokei', description: 'fast, Rust-based' },
      { label: 'cloc', value: 'cloc', description: 'Perl-based, widely available' },
      { label: 'Built-in', value: 'builtin', description: 'no external tools needed' },
    ]);

    const format = await select(rl, 'Output format?', [
      { label: 'Terminal', value: 'terminal' },
      { label: 'JSON', value: 'json' },
      { label: 'CSV', value: 'csv' },
    ]);

    let outputFile = '';
    if (format !== 'terminal') {
      const ext = format === 'json' ? '.json' : '.csv';
      outputFile = await input(rl, `Output file path: `, `report${ext}`);
    }

    const excludeRaw = await input(rl, 'Exclude patterns (comma-separated, or empty): ', '');
    const exclude = excludeRaw
      ? excludeRaw.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    console.log('');
    return {
      path: projectPath,
      pureCode: mode === 'pure' || mode === 'both',
      advanced: mode === 'advanced' || mode === 'both',
      format,
      output: outputFile || undefined,
      exclude,
      tokei: engine === 'tokei',
      cloc: engine === 'cloc',
      builtin: engine === 'builtin',
    };
  } finally {
    rl.close();
  }
}
