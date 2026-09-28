// Pitch spelling on the line of fifths (C = 0, G = 1, F = -1, F# = 6, Bb = -2 …).

import type { KeyMode, SpelledPitch } from './types';

const LETTERS = 'FCGDAEB';

export function fifthsToSpelling(q: number): { step: SpelledPitch['step']; alter: number } {
  const i = ((((q + 1) % 7) + 7) % 7) as number;
  return { step: LETTERS[i] as SpelledPitch['step'], alter: Math.floor((q + 1) / 7) };
}

/** Pitch class of a line-of-fifths position. */
export function fifthsToPc(q: number): number {
  return (((q * 7) % 12) + 12) % 12;
}

/**
 * Spells a MIDI pitch in a key. Diatonic notes take their key spelling; in minor the raised
 * 6th and 7th are preferred. Other notes take the spelling nearest the key centre, except
 * that a chromatic note moving by semitone to `next` is spelled in that direction
 * (G#→A, Ab→G). Double accidentals and Cb/Fb/E#/B# outside the key are avoided.
 */
export function spellPitch(pitch: number, keyFifths: number, mode: KeyMode, next?: number): SpelledPitch {
  const pc = ((pitch % 12) + 12) % 12;
  const base = fifthsToPcInverse(pc);
  const k = keyFifths;
  let bestQ = base;
  let bestCost = Infinity;
  for (let m = -2; m <= 1; m++) {
    const q = base + 12 * m;
    if (q < -15 || q > 19) continue;
    let cost: number;
    if (q >= k - 1 && q <= k + 5) cost = -100;
    else if (mode === 'minor' && (q === k + 6 || q === k + 8)) cost = -50;
    else {
      cost = Math.abs(q - (k + 2));
      const { alter } = fifthsToSpelling(q);
      const odd = Math.abs(alter) >= 2 || isWhiteEnharmonic(q);
      if (Math.abs(alter) >= 2) cost += 6;
      if (isWhiteEnharmonic(q)) cost += 3;
      if (next !== undefined && !odd) {
        // sharp side (larger q) leads up, flat side leads down
        if (next - pitch === 1 && q > base - 6) cost -= 4;
        if (next - pitch === -1 && q < base - 6) cost -= 4;
      }
      // tie-break toward the key's own accidental direction
      cost += k < 0 ? (q > k + 2 ? 0.1 : 0) : q < k + 2 ? 0.1 : 0;
    }
    if (cost < bestCost) {
      bestCost = cost;
      bestQ = q;
    }
  }
  const { step, alter } = fifthsToSpelling(bestQ);
  const octave = Math.floor((pitch - alter) / 12) - 1;
  return { step, alter: alter as SpelledPitch['alter'], octave };
}

/** Line-of-fifths position in 0..11 for a pitch class (C=0 … B=5, F#=6 … F=11). */
function fifthsToPcInverse(pc: number): number {
  return (pc * 7) % 12;
}

function isWhiteEnharmonic(q: number): boolean {
  const { step, alter } = fifthsToSpelling(q);
  return (alter === -1 && (step === 'C' || step === 'F')) || (alter === 1 && (step === 'E' || step === 'B'));
}

export function spelledName(sp: SpelledPitch, glyphs = false): string {
  const acc = sp.alter > 0 ? (glyphs ? '♯' : '#').repeat(sp.alter) : (glyphs ? '♭' : 'b').repeat(-sp.alter);
  return `${sp.step}${acc}${sp.octave}`;
}

export function spelledToMidi(sp: SpelledPitch): number {
  const nat: Record<SpelledPitch['step'], number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  return (sp.octave + 1) * 12 + nat[sp.step] + sp.alter;
}
