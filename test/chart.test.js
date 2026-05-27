import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderBarChart } from '../src/chart.js';

describe('renderBarChart', () => {
  it('renders chart for languages', () => {
    const languages = [
      { language: 'JavaScript', code: 800 },
      { language: 'CSS', code: 200 },
    ];
    const output = renderBarChart(languages);
    assert.ok(output.includes('JavaScript'));
    assert.ok(output.includes('CSS'));
    assert.ok(output.includes('%'));
  });

  it('returns empty string for empty input', () => {
    assert.equal(renderBarChart([]), '');
    assert.equal(renderBarChart(null), '');
  });

  it('returns empty string when all values are zero', () => {
    const languages = [{ language: 'X', code: 0 }];
    assert.equal(renderBarChart(languages), '');
  });

  it('respects maxItems', () => {
    const languages = Array.from({ length: 20 }, (_, i) => ({
      language: `Lang${i}`,
      code: 100 - i,
    }));
    const output = renderBarChart(languages, { maxItems: 5 });
    assert.ok(output.includes('Lang0'));
    assert.ok(output.includes('Lang4'));
    assert.ok(output.includes('15 more'));
  });
});
