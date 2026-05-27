import fs from 'node:fs/promises';
import path from 'node:path';

const CONFIG_NAMES = ['.devradarrc.json', '.devradarrc', 'devradar.config.json'];

export async function loadConfig(dir) {
  const root = path.resolve(dir);
  for (const name of CONFIG_NAMES) {
    try {
      const text = await fs.readFile(path.join(root, name), 'utf8');
      return JSON.parse(text);
    } catch {
      // try next
    }
  }
  return {};
}

export function mergeConfig(cliOpts, fileConfig) {
  const merged = { ...fileConfig };
  for (const [key, value] of Object.entries(cliOpts)) {
    if (value !== undefined && value !== false) {
      if (Array.isArray(value) && value.length === 0) continue;
      merged[key] = value;
    }
  }
  return merged;
}
