import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeDiff } from '../src/compare.js';

describe('computeDiff', () => {
  const previous = {
    scannedAt: '2026-05-20T00:00:00Z',
    summary: { totalFiles: 10, totalLines: 500, codeLines: 400, commentLines: 50, blankLines: 50, binaryFiles: 0, unknownStyleFiles: 0 },
    byLanguage: [
      { language: 'JavaScript', files: 5, total: 300, code: 250, comment: 25, blank: 25 },
      { language: 'CSS', files: 3, total: 100, code: 80, comment: 10, blank: 10 },
      { language: 'HTML', files: 2, total: 100, code: 70, comment: 15, blank: 15 },
    ],
    technologies: { frameworks: ['React', 'Express'], packageManagers: ['npm'], buildTools: [], databases: [] },
  };

  const current = {
    scannedAt: '2026-05-27T00:00:00Z',
    summary: { totalFiles: 15, totalLines: 800, codeLines: 650, commentLines: 80, blankLines: 70, binaryFiles: 0, unknownStyleFiles: 0 },
    byLanguage: [
      { language: 'JavaScript', files: 7, total: 400, code: 330, comment: 35, blank: 35 },
      { language: 'TypeScript', files: 3, total: 200, code: 170, comment: 15, blank: 15 },
      { language: 'CSS', files: 5, total: 200, code: 150, comment: 30, blank: 20 },
    ],
    technologies: { frameworks: ['React', 'Next.js'], packageManagers: ['npm'], buildTools: ['Vite'], databases: [] },
  };

  it('computes summary deltas', () => {
    const diff = computeDiff(previous, current);
    assert.equal(diff.summaryDiff.totalFiles.delta, 5);
    assert.equal(diff.summaryDiff.codeLines.delta, 250);
  });

  it('detects added languages', () => {
    const diff = computeDiff(previous, current);
    assert.ok(diff.added.includes('TypeScript'));
  });

  it('detects removed languages', () => {
    const diff = computeDiff(previous, current);
    assert.ok(diff.removed.includes('HTML'));
  });

  it('computes per-language deltas', () => {
    const diff = computeDiff(previous, current);
    const jsDiff = diff.languageDiffs.find((d) => d.language === 'JavaScript');
    assert.equal(jsDiff.delta, 80);
  });

  it('detects framework changes', () => {
    const diff = computeDiff(previous, current);
    assert.ok(diff.techDiff.addedFrameworks.includes('Next.js'));
    assert.ok(diff.techDiff.removedFrameworks.includes('Express'));
  });
});
