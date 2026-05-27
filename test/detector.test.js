import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectLanguage } from '../src/detector.js';

describe('detectLanguage', () => {
  const cases = [
    [{ basename: 'app.js', ext: '.js' }, 'JavaScript'],
    [{ basename: 'app.ts', ext: '.ts' }, 'TypeScript'],
    [{ basename: 'main.py', ext: '.py' }, 'Python'],
    [{ basename: 'Main.java', ext: '.java' }, 'Java'],
    [{ basename: 'lib.rs', ext: '.rs' }, 'Rust'],
    [{ basename: 'main.go', ext: '.go' }, 'Go'],
    [{ basename: 'style.css', ext: '.css' }, 'CSS'],
    [{ basename: 'page.html', ext: '.html' }, 'HTML'],
    [{ basename: 'app.vue', ext: '.vue' }, 'Vue'],
    [{ basename: 'app.svelte', ext: '.svelte' }, 'Svelte'],
    [{ basename: 'query.sql', ext: '.sql' }, 'SQL'],
    [{ basename: 'script.sh', ext: '.sh' }, 'Shell'],
    [{ basename: 'script.ps1', ext: '.ps1' }, 'PowerShell'],
    [{ basename: 'code.cpp', ext: '.cpp' }, 'C++'],
    [{ basename: 'code.c', ext: '.c' }, 'C'],
    [{ basename: 'program.cs', ext: '.cs' }, 'C#'],
    [{ basename: 'app.rb', ext: '.rb' }, 'Ruby'],
    [{ basename: 'app.php', ext: '.php' }, 'PHP'],
    [{ basename: 'app.dart', ext: '.dart' }, 'Dart'],
    [{ basename: 'app.kt', ext: '.kt' }, 'Kotlin'],
    [{ basename: 'app.swift', ext: '.swift' }, 'Swift'],
  ];

  for (const [file, expected] of cases) {
    it(`detects ${expected} from ${file.basename}`, () => {
      assert.equal(detectLanguage(file), expected);
    });
  }

  it('detects Dockerfile by basename', () => {
    assert.equal(detectLanguage({ basename: 'Dockerfile', ext: '' }), 'Dockerfile');
  });

  it('detects Makefile by basename', () => {
    assert.equal(detectLanguage({ basename: 'Makefile', ext: '' }), 'Makefile');
  });

  it('returns null for unknown extension', () => {
    assert.equal(detectLanguage({ basename: 'data.xyz', ext: '.xyz' }), null);
  });
});
