import path from 'node:path';
import spawn from 'cross-spawn';
import { DEFAULT_EXCLUDED_DIRS } from '../constants/excludes.js';

export const name = 'tokei';
export const displayName = 'tokei';

export async function isAvailable() {
  try {
    await runCommand('tokei', ['--version']);
    return true;
  } catch {
    return false;
  }
}

export async function run(rootDir, options = {}) {
  const userExcludes = options.exclude || [];
  const excludePatterns = [
    ...DEFAULT_EXCLUDED_DIRS.map((d) => `${d}/`),
    ...userExcludes,
  ];

  const args = ['--output', 'json'];
  for (const pat of excludePatterns) {
    args.push('--exclude', pat);
  }
  args.push(rootDir);

  const stdout = await runCommand('tokei', args);
  const data = JSON.parse(stdout);
  return mapTokeiResult(data, rootDir, !!options.advanced);
}

function mapTokeiResult(data, rootDir, advanced) {
  const summary = {
    totalFiles: 0,
    totalLines: 0,
    codeLines: 0,
    commentLines: 0,
    blankLines: 0,
    binaryFiles: 0,
    unknownStyleFiles: 0,
  };
  const byLanguage = [];
  const files = [];
  const absRoot = path.resolve(rootDir);

  for (const [lang, stats] of Object.entries(data)) {
    if (lang === 'Total') continue;
    const reports = Array.isArray(stats.reports) ? stats.reports : [];
    const fileCount = reports.length;
    const code = stats.code || 0;
    const comment = stats.comments || 0;
    const blank = stats.blanks || 0;
    const total = code + comment + blank;

    summary.totalFiles += fileCount;
    summary.totalLines += total;
    summary.codeLines += code;
    summary.commentLines += comment;
    summary.blankLines += blank;

    byLanguage.push({
      language: lang,
      files: fileCount,
      total,
      code,
      comment,
      blank,
    });

    if (advanced) {
      for (const r of reports) {
        const s = r.stats || {};
        const fc = s.code || 0;
        const fcm = s.comments || 0;
        const fb = s.blanks || 0;
        const relPath = path
          .relative(absRoot, r.name)
          .split(path.sep)
          .join('/');
        files.push({
          relPath: relPath || r.name,
          language: lang,
          total: fc + fcm + fb,
          code: fc,
          comment: fcm,
          blank: fb,
        });
      }
    }
  }

  byLanguage.sort((a, b) => b.code - a.code);
  if (advanced) files.sort((a, b) => a.relPath.localeCompare(b.relPath));

  return {
    summary,
    byLanguage,
    files: advanced ? files : undefined,
  };
}

function runCommand(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { windowsHide: true });
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
