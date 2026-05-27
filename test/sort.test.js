import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sortData } from '../src/reporter.js';

describe('sortData', () => {
  const languages = [
    { language: 'CSS', files: 3, total: 100, code: 80 },
    { language: 'JavaScript', files: 10, total: 500, code: 400 },
    { language: 'HTML', files: 5, total: 200, code: 150 },
  ];

  it('sorts by name', () => {
    const sorted = sortData(languages, 'name');
    assert.equal(sorted[0].language, 'CSS');
    assert.equal(sorted[1].language, 'HTML');
    assert.equal(sorted[2].language, 'JavaScript');
  });

  it('sorts by code (descending)', () => {
    const sorted = sortData(languages, 'code');
    assert.equal(sorted[0].language, 'JavaScript');
    assert.equal(sorted[1].language, 'HTML');
    assert.equal(sorted[2].language, 'CSS');
  });

  it('sorts by lines (descending)', () => {
    const sorted = sortData(languages, 'lines');
    assert.equal(sorted[0].language, 'JavaScript');
    assert.equal(sorted[2].language, 'CSS');
  });

  it('sorts by files (descending)', () => {
    const sorted = sortData(languages, 'files');
    assert.equal(sorted[0].language, 'JavaScript');
    assert.equal(sorted[1].language, 'HTML');
  });

  it('returns original if no sort field', () => {
    const sorted = sortData(languages, null);
    assert.equal(sorted[0].language, 'CSS');
  });

  it('does not mutate original array', () => {
    sortData(languages, 'code');
    assert.equal(languages[0].language, 'CSS');
  });
});
