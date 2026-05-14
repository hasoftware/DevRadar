import * as tokei from './tokei.js';
import * as cloc from './cloc.js';
import * as builtin from './builtin.js';

const PREFERENCE_ORDER = [tokei, cloc, builtin];

export async function selectEngine() {
  for (const engine of PREFERENCE_ORDER) {
    if (await engine.isAvailable()) return engine;
  }
  return builtin;
}
