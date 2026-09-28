import type { FallNote } from '@aria/score-engine';

const BLACK = new Set([1, 3, 6, 8, 10]);
export const isBlack = (pitch: number) => BLACK.has(((pitch % 12) + 12) % 12);

/** Fit the keyboard to the piece: lowest→highest pitch widened to C…E, at least 2½ octaves (§6.6). */
export function fitRange(notes: FallNote[], minSpan = 29): { low: number; high: number } {
  if (!notes.length) return { low: 48, high: 76 }; // C3–E5, the design's default
  let low = Math.min(...notes.map((n) => n.pitch));
  let high = Math.max(...notes.map((n) => n.pitch));
  low -= ((low % 12) + 12) % 12; // down to C
  while (((high % 12) + 12) % 12 !== 4) high++; // up to E
  while (high - low < minSpan) {
    if (low > 21) low -= 12;
    else high += 12;
  }
  return { low: Math.max(21, low), high: Math.min(108, high) };
}

export interface KeyRect {
  pitch: number;
  x: number;
  width: number;
  black: boolean;
}

/** Key rectangles for a range at a total width. Black keys are 60% of a white key, centred on the gap. */
export function layoutKeys(low: number, high: number, width: number): KeyRect[] {
  const whites: number[] = [];
  for (let p = low; p <= high; p++) if (!isBlack(p)) whites.push(p);
  const w = width / whites.length;
  const keys: KeyRect[] = [];
  let wi = 0;
  for (let p = low; p <= high; p++) {
    if (isBlack(p)) {
      const bw = w * 0.6;
      keys.push({ pitch: p, x: wi * w - bw / 2, width: bw, black: true });
    } else {
      keys.push({ pitch: p, x: wi * w, width: w, black: false });
      wi++;
    }
  }
  return keys;
}

/** Index of the last note starting at or before t (notes sorted by startSec). */
export function lastStartedIndex(notes: FallNote[], t: number): number {
  let lo = 0;
  let hi = notes.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (notes[mid]!.startSec <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

/** Notes sounding at t. Scans back a bounded window from the last started note. */
export function soundingAt(notes: FallNote[], t: number, maxLookbackSec = 12): FallNote[] {
  const out: FallNote[] = [];
  for (let i = lastStartedIndex(notes, t); i >= 0; i--) {
    const n = notes[i]!;
    if (t - n.startSec > maxLookbackSec) break;
    if (n.endSec > t) out.push(n);
  }
  return out;
}

const NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
/** Short key label; flats by default (the key's spelling comes from the note's own name when available). */
export const keyLabel = (n: FallNote) => n.name.replace(/\d+$/, '').replace('b', '♭').replace('#', '♯') || NAMES[n.pitch % 12]!;
