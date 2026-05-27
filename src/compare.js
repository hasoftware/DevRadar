import fs from 'node:fs/promises';

export async function loadPreviousReport(filePath) {
  const text = await fs.readFile(filePath, 'utf8');
  return JSON.parse(text);
}

export function computeDiff(previous, current) {
  const summaryDiff = {};
  for (const key of Object.keys(current.summary)) {
    const prev = previous.summary?.[key] ?? 0;
    const curr = current.summary[key] ?? 0;
    summaryDiff[key] = { prev, curr, delta: curr - prev };
  }

  const prevLangs = new Map(
    (previous.byLanguage || []).map((l) => [l.language, l]),
  );
  const currLangs = new Map(
    (current.byLanguage || []).map((l) => [l.language, l]),
  );

  const allLangs = new Set([...prevLangs.keys(), ...currLangs.keys()]);
  const languageDiffs = [];
  const added = [];
  const removed = [];

  for (const lang of [...allLangs].sort()) {
    const prev = prevLangs.get(lang);
    const curr = currLangs.get(lang);
    if (!prev) {
      added.push(lang);
      languageDiffs.push({
        language: lang,
        prevCode: 0,
        currCode: curr.code,
        delta: curr.code,
        prevFiles: 0,
        currFiles: curr.files,
      });
    } else if (!curr) {
      removed.push(lang);
      languageDiffs.push({
        language: lang,
        prevCode: prev.code,
        currCode: 0,
        delta: -prev.code,
        prevFiles: prev.files,
        currFiles: 0,
      });
    } else {
      languageDiffs.push({
        language: lang,
        prevCode: prev.code,
        currCode: curr.code,
        delta: curr.code - prev.code,
        prevFiles: prev.files,
        currFiles: curr.files,
      });
    }
  }

  const prevTech = previous.technologies || {};
  const currTech = current.technologies || {};
  const techDiff = {
    addedFrameworks: (currTech.frameworks || []).filter(
      (f) => !(prevTech.frameworks || []).includes(f),
    ),
    removedFrameworks: (prevTech.frameworks || []).filter(
      (f) => !(currTech.frameworks || []).includes(f),
    ),
  };

  return {
    previousDate: previous.scannedAt,
    currentDate: current.scannedAt,
    summaryDiff,
    languageDiffs,
    added,
    removed,
    techDiff,
  };
}
