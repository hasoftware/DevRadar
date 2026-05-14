import path from 'node:path';
import { existsSync } from 'node:fs';
import spawn from 'cross-spawn';
import { DEFAULT_EXCLUDED_DIRS } from '../constants/excludes.js';

export const name = 'cloc';
export const displayName = 'cloc';

export async function isAvailable() {
  try {
    await runCommand('cloc', ['--version']);
    return true;
  } catch {
    return false;
  }
}

export async function run(rootDir, options = {}) {
  const userExcludes = options.exclude || [];
  const absRoot = path.resolve(rootDir);
  const useGit = existsSync(path.join(absRoot, '.git'));

  const dirNames = extractDirNames(userExcludes);
  const excludeDirs = [...new Set([...DEFAULT_EXCLUDED_DIRS, ...dirNames])];

  let args;
  let spawnOpts = {};

  if (useGit) {
    args = [
      '--vcs=git',
      '--json',
      '--by-file',
      '--quiet',
      '--exclude-dir=' + excludeDirs.join(','),
    ];
    spawnOpts.cwd = absRoot;
  } else {
    args = [
      '--json',
      '--by-file',
      '--quiet',
      '--exclude-dir=' + excludeDirs.join(','),
      absRoot,
    ];
  }

  const stdout = await runCommand('cloc', args, spawnOpts);
  const data = stdout.trim() ? JSON.parse(stdout) : {};
  return mapClocResult(data, absRoot, !!options.advanced);
}

function extractDirNames(patterns) {
  const names = [];
  for (const p of patterns) {
    const cleaned = p.replace(/^\.?\/+/, '');
    const head = cleaned.split(/[/\\]/, 1)[0];
    if (head && !head.includes('*') && !head.includes('?')) {
      names.push(head);
    }
  }
  return names;
}

function mapClocResult(data, absRoot, advanced) {
  const summary = {
    totalFiles: 0,
    totalLines: 0,
    codeLines: 0,
    commentLines: 0,
    blankLines: 0,
    binaryFiles: 0,
    unknownStyleFiles: 0,
  };
  const byLangMap = new Map();
  const files = [];

  for (const [key, value] of Object.entries(data)) {
    if (key === 'header' || key === 'SUM') continue;
    if (!value || typeof value !== 'object') continue;
    if (value.language === undefined) continue;

    const language = value.language || 'Other';
    const code = value.code || 0;
    const comment = value.comment || 0;
    const blank = value.blank || 0;
    const total = code + comment + blank;

    summary.totalFiles += 1;
    summary.totalLines += total;
    summary.codeLines += code;
    summary.commentLines += comment;
    summary.blankLines += blank;

    if (!byLangMap.has(language)) {
      byLangMap.set(language, {
        language,
        files: 0,
        total: 0,
        code: 0,
        comment: 0,
        blank: 0,
      });
    }
    const langEntry = byLangMap.get(language);
    langEntry.files++;
    langEntry.total += total;
    langEntry.code += code;
    langEntry.comment += comment;
    langEntry.blank += blank;

    if (advanced) {
      const abs = path.resolve(absRoot, key);
      const rel = path.relative(absRoot, abs).split(path.sep).join('/');
      files.push({
        relPath: rel || key,
        language,
        total,
        code,
        comment,
        blank,
      });
    }
  }

  const byLanguage = [...byLangMap.values()].sort((a, b) => b.code - a.code);
  if (advanced) files.sort((a, b) => a.relPath.localeCompare(b.relPath));

  return {
    summary,
    byLanguage,
    files: advanced ? files : undefined,
  };
}

function runCommand(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { windowsHide: true, ...opts });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => (stdout += d));
    proc.stderr.on('data', (d) => (stderr += d));
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${cmd} exited ${code}: ${stderr.trim() || stdout.trim()}`));
    });
  });
}
