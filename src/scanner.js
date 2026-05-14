import path from 'node:path';
import fs from 'node:fs/promises';
import fg from 'fast-glob';
import { DEFAULT_EXCLUDED_DIRS, toGlobIgnore } from './constants/excludes.js';
import { loadIgnore, toPosix } from './ignore.js';

export async function scanProject(rootDir, options = {}) {
  const root = path.resolve(rootDir);

  const rootStat = await fs.stat(root);
  if (!rootStat.isDirectory()) {
    throw new Error(`Not a directory: ${root}`);
  }

  const customExcludes = Array.isArray(options.exclude) ? options.exclude : [];

  const fgIgnorePatterns = [
    ...toGlobIgnore(DEFAULT_EXCLUDED_DIRS),
    ...customExcludes,
  ];

  const found = await fg('**/*', {
    cwd: root,
    dot: true,
    onlyFiles: true,
    followSymbolicLinks: false,
    suppressErrors: true,
    ignore: fgIgnorePatterns,
    absolute: false,
  });

  const ig = await loadIgnore(root, customExcludes);
  const posixPaths = found.map(toPosix);
  const filtered = ig.filter(posixPaths);

  const files = [];
  for (const relPath of filtered) {
    const absPath = path.join(root, relPath);
    let fileStat;
    try {
      fileStat = await fs.stat(absPath);
    } catch {
      continue;
    }
    if (!fileStat.isFile()) continue;
    files.push({
      relPath,
      absPath,
      size: fileStat.size,
      ext: path.extname(relPath).toLowerCase(),
      basename: path.basename(relPath),
    });
  }

  return { root, files };
}

export async function readFileText(absPath) {
  return fs.readFile(absPath, 'utf8');
}
