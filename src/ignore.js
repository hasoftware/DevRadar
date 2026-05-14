import fs from 'node:fs/promises';
import path from 'node:path';
import ignore from 'ignore';

export async function loadIgnore(rootDir, extraPatterns = []) {
  const ig = ignore();

  ig.add(['.git']);

  const gitignorePath = path.join(rootDir, '.gitignore');
  try {
    const content = await fs.readFile(gitignorePath, 'utf8');
    ig.add(content);
  } catch (err) {
    if (err && err.code !== 'ENOENT') {
      // Surface anything other than "missing file" so the caller can decide
      throw err;
    }
  }

  if (extraPatterns && extraPatterns.length > 0) {
    ig.add(extraPatterns);
  }

  return ig;
}

export function toPosix(p) {
  return p.split(path.sep).join('/');
}
