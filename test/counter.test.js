import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { splitLines, classifyLine, classifyText, pickStyle } from '../src/counter.js';

const fresh = () => ({ inBlockComment: null, inDocstring: null });

describe('splitLines', () => {
  it('splits basic text', () => {
    assert.deepEqual(splitLines('a\nb\nc'), ['a', 'b', 'c']);
  });

  it('handles trailing newline', () => {
    assert.deepEqual(splitLines('a\nb\n'), ['a', 'b']);
  });

  it('strips carriage returns', () => {
    assert.deepEqual(splitLines('a\r\nb\r\n'), ['a', 'b']);
  });

  it('handles empty string', () => {
    assert.deepEqual(splitLines(''), []);
  });
});

describe('classifyLine (C-style)', () => {
  const style = {
    lineComment: ['//'],
    blockComment: [['/*', '*/']],
    docstring: null,
  };

  it('detects code line', () => {
    const r = classifyLine('const x = 1;', style, fresh());
    assert.equal(r.hasCode, true);
    assert.equal(r.isComment, false);
    assert.equal(r.isBlank, false);
  });

  it('detects blank line', () => {
    const r = classifyLine('   ', style, fresh());
    assert.equal(r.isBlank, true);
  });

  it('detects line comment', () => {
    const r = classifyLine('  // this is a comment', style, fresh());
    assert.equal(r.isComment, true);
    assert.equal(r.hasCode, false);
  });

  it('detects code with inline comment', () => {
    const r = classifyLine('x = 1; // set x', style, fresh());
    assert.equal(r.hasCode, true);
  });

  it('detects block comment start', () => {
    const r = classifyLine('/* start', style, fresh());
    assert.equal(r.isComment, true);
    assert.equal(r.nextState.inBlockComment, '*/');
  });

  it('continues block comment', () => {
    const state = { inBlockComment: '*/', inDocstring: null };
    const r = classifyLine('  still in comment', style, state);
    assert.equal(r.isComment, true);
    assert.equal(r.nextState.inBlockComment, '*/');
  });

  it('ends block comment', () => {
    const state = { inBlockComment: '*/', inDocstring: null };
    const r = classifyLine('  end */ code', style, state);
    assert.equal(r.hasCode, true);
    assert.equal(r.nextState.inBlockComment, null);
  });
});

describe('classifyLine (Python-style)', () => {
  const style = {
    lineComment: ['#'],
    blockComment: [],
    docstring: ['"""', "'''"],
  };

  it('detects hash comment', () => {
    const r = classifyLine('# comment', style, fresh());
    assert.equal(r.isComment, true);
  });

  it('detects docstring start', () => {
    const r = classifyLine('"""', style, fresh());
    assert.equal(r.isComment, true);
    assert.equal(r.nextState.inDocstring, '"""');
  });

  it('detects inline docstring', () => {
    const r = classifyLine('"""short doc"""', style, fresh());
    assert.equal(r.isComment, true);
    assert.equal(r.nextState.inDocstring, null);
  });
});

describe('classifyText', () => {
  const style = {
    lineComment: ['//'],
    blockComment: [['/*', '*/']],
    docstring: null,
  };

  it('classifies mixed content', () => {
    const text = [
      'const a = 1;',
      '// comment',
      '',
      '/* block',
      '   comment */',
      'const b = 2;',
    ].join('\n');
    const result = classifyText(text, style);
    assert.equal(result.total, 6);
    assert.equal(result.code, 2);
    assert.equal(result.comment, 3);
    assert.equal(result.blank, 1);
  });
});

describe('pickStyle', () => {
  it('returns style for .js files', () => {
    const style = pickStyle({ basename: 'index.js', ext: '.js' });
    assert.ok(style);
    assert.ok(style.lineComment.includes('//'));
  });

  it('returns style for .py files', () => {
    const style = pickStyle({ basename: 'main.py', ext: '.py' });
    assert.ok(style);
    assert.ok(style.lineComment.includes('#'));
  });

  it('returns style for Makefile', () => {
    const style = pickStyle({ basename: 'Makefile', ext: '' });
    assert.ok(style);
  });

  it('returns null for unknown extension', () => {
    const style = pickStyle({ basename: 'data.xyz', ext: '.xyz' });
    assert.equal(style, null);
  });
});
