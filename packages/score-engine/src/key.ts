// Key detection (Krumhansl–Schmuckler) and key-relative helpers.

import type { KeyMode } from './types';
import { fifthsToPc } from './spell';

const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
/** Key signature (fifths) of the major key on each pitch class; F#/Gb → Gb (-6). */
const MAJOR_FIFTHS = [0, -5, 2, -3, 4, -1, -6, 1, -4, 3, -2, 5];

/** Correlates duration-weighted pitch classes with the 24 rotated key profiles. */
export function detectKey(notes: { pitch: number; beats: number }[]): { fifths: number; mode: KeyMode } {
  const pcw = new Array<number>(12).fill(0);
  for (const n of notes) {
    const pc = n.pitch % 12;
    pcw[pc] = pcw[pc]! + Math.min(n.beats, 4);
  }
  if (pcw.every((v) => v === 0)) return { fifths: 0, mode: 'major' };
  let best = -Infinity;
  let res = { fifths: 0, mode: 'major' as KeyMode };
  for (let tonic = 0; tonic < 12; tonic++) {
    for (const mode of ['major', 'minor'] as const) {
      const prof = mode === 'major' ? MAJOR : MINOR;
      const r = pearson(pcw, (i) => prof[(i - tonic + 12) % 12]!);
      if (r > best + 1e-12) {
        best = r;
        res = { fifths: MAJOR_FIFTHS[mode === 'major' ? tonic : (tonic + 3) % 12]!, mode };
      }
    }
  }
  return res;
}

function pearson(x: number[], y: (i: number) => number): number {
  let mx = 0;
  let my = 0;
  for (let i = 0; i < 12; i++) {
    mx += x[i]!;
    my += y(i);
  }
  mx /= 12;
  my /= 12;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < 12; i++) {
    const a = x[i]! - mx;
    const b = y(i) - my;
    sxy += a * b;
    sxx += a * a;
    syy += b * b;
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
}

/** Pitch classes of the key signature's diatonic set (same for a major key and its relative minor). */
export function diatonicPcs(keyFifths: number): Set<number> {
  const s = new Set<number>();
  for (let q = keyFifths - 1; q <= keyFifths + 5; q++) s.add(fifthsToPc(q));
  return s;
}

/**
 * Next pitch up/down on the key signature's scale (major, or natural minor — the mode does
 * not change the set). A chromatic start moves to the nearest scale note in `dir`.
 */
export function stepPitchInKey(pitch: number, dir: 1 | -1, keyFifths: number, _keyMode: KeyMode): number {
  const set = diatonicPcs(keyFifths);
  let p = pitch + dir;
  while (p >= 21 && p <= 108 && !set.has(((p % 12) + 12) % 12)) p += dir;
  return Math.min(108, Math.max(21, p));
}
