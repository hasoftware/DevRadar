import { scanProject } from '../scanner.js';
import { countFile } from '../counter.js';
import { detectLanguage } from '../detector.js';

export const name = 'built-in';
export const displayName = 'DevRadar built-in counter';

export async function isAvailable() {
  return true;
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(Math.max(1, limit), Math.max(1, items.length)) },
    async () => {
      while (true) {
        const i = next++;
        if (i >= items.length) return;
        try {
          results[i] = await fn(items[i]);
        } catch (err) {
          results[i] = {
            file: items[i],
            language: null,
            counts: {
              total: 0,
              code: 0,
              comment: 0,
              blank: 0,
              error: err?.message || String(err),
            },
          };
        }
      }
    },
  );
  await Promise.all(workers);
  return results;
}

export async function run(rootDir, options = {}) {
  const scan = await scanProject(rootDir, { exclude: options.exclude || [] });

  const fileReports = await mapWithConcurrency(scan.files, 16, async (file) => {
    const counts = await countFile(file);
    const language = detectLanguage(file);
    return { file, language, counts };
  });

  const summary = {
    totalFiles: 0,
    totalLines: 0,
    codeLines: 0,
    commentLines: 0,
    blankLines: 0,
    binaryFiles: 0,
    unknownStyleFiles: 0,
  };
  const byLanguage = new Map();
  const fileEntries = [];

  for (const r of fileReports) {
    if (r.counts.binary) {
      summary.binaryFiles++;
      continue;
    }
    summary.totalFiles++;
    summary.totalLines += r.counts.total;
    summary.codeLines += r.counts.code;
    summary.commentLines += r.counts.comment;
    summary.blankLines += r.counts.blank;
    if (r.counts.unknownStyle) summary.unknownStyleFiles++;

    const lang = r.language || 'Other';
    if (!byLanguage.has(lang)) {
      byLanguage.set(lang, {
        language: lang,
        files: 0,
        total: 0,
        code: 0,
        comment: 0,
        blank: 0,
      });
    }
    const entry = byLanguage.get(lang);
    entry.files++;
    entry.total += r.counts.total;
    entry.code += r.counts.code;
    entry.comment += r.counts.comment;
    entry.blank += r.counts.blank;

    fileEntries.push({
      relPath: r.file.relPath,
      language: lang,
      total: r.counts.total,
      code: r.counts.code,
      comment: r.counts.comment,
      blank: r.counts.blank,
    });
  }

  return {
    summary,
    byLanguage: [...byLanguage.values()].sort((a, b) => b.code - a.code),
    files: options.advanced
      ? fileEntries.sort((a, b) => a.relPath.localeCompare(b.relPath))
      : undefined,
  };
}
