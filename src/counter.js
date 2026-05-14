import fs from 'node:fs/promises';
import { COMMENT_STYLES, EXT_TO_STYLE, SPECIAL_FILE_NAMES } from './constants/comments.js';

export function splitLines(text) {
  const lines = text.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines.map((l) => (l.endsWith('\r') ? l.slice(0, -1) : l));
}

export function pickStyle(file) {
  const byBasename = SPECIAL_FILE_NAMES[file.basename.toLowerCase()];
  if (byBasename) return COMMENT_STYLES[byBasename];
  const byExt = EXT_TO_STYLE[file.ext];
  return byExt ? COMMENT_STYLES[byExt] : null;
}

export function classifyLine(line, style, entryState) {
  const startedInBlock = !!entryState.inBlockComment;
  const startedInDoc = !!entryState.inDocstring;

  let inBlockComment = entryState.inBlockComment;
  let inDocstring = entryState.inDocstring;
  let hasCode = false;
  let i = 0;
  const len = line.length;

  while (i < len) {
    if (inBlockComment) {
      const closeIdx = line.indexOf(inBlockComment, i);
      if (closeIdx === -1) {
        i = len;
      } else {
        i = closeIdx + inBlockComment.length;
        inBlockComment = null;
      }
      continue;
    }

    if (inDocstring) {
      const closeIdx = line.indexOf(inDocstring, i);
      if (closeIdx === -1) {
        i = len;
      } else {
        i = closeIdx + inDocstring.length;
        inDocstring = null;
      }
      continue;
    }

    const ch = line[i];

    if (ch === ' ' || ch === '\t' || ch === '\r') {
      i++;
      continue;
    }

    let matched = false;

    if (style.docstring && !hasCode) {
      for (const d of style.docstring) {
        if (line.startsWith(d, i)) {
          const closeIdx = line.indexOf(d, i + d.length);
          if (closeIdx === -1) {
            inDocstring = d;
            i = len;
          } else {
            i = closeIdx + d.length;
          }
          matched = true;
          break;
        }
      }
    }
    if (matched) continue;

    if (style.blockComment && style.blockComment.length > 0) {
      for (const [open, close] of style.blockComment) {
        if (line.startsWith(open, i)) {
          const closeIdx = line.indexOf(close, i + open.length);
          if (closeIdx === -1) {
            inBlockComment = close;
            i = len;
          } else {
            i = closeIdx + close.length;
          }
          matched = true;
          break;
        }
      }
    }
    if (matched) continue;

    if (style.lineComment && style.lineComment.length > 0) {
      for (const lc of style.lineComment) {
        if (line.startsWith(lc, i)) {
          i = len;
          matched = true;
          break;
        }
      }
    }
    if (matched) continue;

    if (ch === '"' || ch === "'" || ch === '`') {
      hasCode = true;
      const quote = ch;
      i++;
      while (i < len) {
        if (line[i] === '\\' && i + 1 < len) {
          i += 2;
          continue;
        }
        if (line[i] === quote) {
          i++;
          break;
        }
        i++;
      }
      continue;
    }

    hasCode = true;
    i++;
  }

  const trimmedEmpty = line.trim() === '';

  let isBlank = false;
  let isComment = false;

  if (hasCode) {
    // counted as code below
  } else if (trimmedEmpty && !startedInBlock && !startedInDoc) {
    isBlank = true;
  } else {
    isComment = true;
  }

  return {
    isBlank,
    isComment,
    hasCode,
    nextState: { inBlockComment, inDocstring },
  };
}

export function classifyText(text, style) {
  const lines = splitLines(text);
  let code = 0;
  let comment = 0;
  let blank = 0;
  let state = { inBlockComment: null, inDocstring: null };

  for (const line of lines) {
    const r = classifyLine(line, style, state);
    state = r.nextState;
    if (r.hasCode) code++;
    else if (r.isBlank) blank++;
    else if (r.isComment) comment++;
  }

  return { total: lines.length, code, comment, blank };
}

function countUnknown(text) {
  const lines = splitLines(text);
  let blank = 0;
  let code = 0;
  for (const line of lines) {
    if (line.trim() === '') blank++;
    else code++;
  }
  return { total: lines.length, code, comment: 0, blank };
}

const BINARY_PROBE_BYTES = 8192;

export async function readSourceText(absPath) {
  const buf = await fs.readFile(absPath);
  const checkLen = Math.min(buf.length, BINARY_PROBE_BYTES);
  for (let i = 0; i < checkLen; i++) {
    if (buf[i] === 0) return null;
  }
  return buf.toString('utf8');
}

export async function countFile(file) {
  const text = await readSourceText(file.absPath);
  if (text === null) {
    return { total: 0, code: 0, comment: 0, blank: 0, binary: true };
  }
  const style = pickStyle(file);
  if (!style) return { ...countUnknown(text), unknownStyle: true };
  return classifyText(text, style);
}
