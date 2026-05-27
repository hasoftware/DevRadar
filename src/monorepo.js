import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';

async function readJsonSafe(absPath) {
  try {
    return JSON.parse(await fs.readFile(absPath, 'utf8'));
  } catch {
    return null;
  }
}

async function readTextSafe(absPath) {
  try {
    return await fs.readFile(absPath, 'utf8');
  } catch {
    return null;
  }
}

async function resolveGlobWorkspaces(root, patterns) {
  const dirs = await fg(patterns, {
    cwd: root,
    onlyDirectories: true,
    followSymbolicLinks: false,
    suppressErrors: true,
    absolute: false,
  });
  const results = [];
  for (const d of dirs.sort()) {
    const abs = path.join(root, d);
    const pkgPath = path.join(abs, 'package.json');
    const pkg = await readJsonSafe(pkgPath);
    results.push({
      name: pkg?.name || path.basename(d),
      path: d,
      absPath: abs,
    });
  }
  return results;
}

export async function detectMonorepo(rootDir) {
  const root = path.resolve(rootDir);

  const pkg = await readJsonSafe(path.join(root, 'package.json'));
  if (pkg?.workspaces) {
    const patterns = Array.isArray(pkg.workspaces)
      ? pkg.workspaces
      : pkg.workspaces.packages || [];
    const workspaces = await resolveGlobWorkspaces(root, patterns);
    if (workspaces.length > 0) return { type: 'npm/yarn workspaces', workspaces };
  }

  const pnpmWs = await readTextSafe(path.join(root, 'pnpm-workspace.yaml'));
  if (pnpmWs) {
    const match = pnpmWs.match(/packages:\s*\n((?:\s+-\s+.+\n?)+)/);
    if (match) {
      const patterns = match[1]
        .split('\n')
        .map((l) => l.replace(/^\s*-\s*['"]?/, '').replace(/['"]?\s*$/, ''))
        .filter(Boolean);
      const workspaces = await resolveGlobWorkspaces(root, patterns);
      if (workspaces.length > 0) return { type: 'pnpm workspaces', workspaces };
    }
  }

  const lerna = await readJsonSafe(path.join(root, 'lerna.json'));
  if (lerna?.packages) {
    const workspaces = await resolveGlobWorkspaces(root, lerna.packages);
    if (workspaces.length > 0) return { type: 'Lerna', workspaces };
  }

  return null;
}
