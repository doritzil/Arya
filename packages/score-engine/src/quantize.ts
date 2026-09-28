// Grid quantization in beat space (integer ticks, TPQ = 48 so both 1/16 and 1/3 are exact).

import type { Grid, PerfNote, QuantNote } from './types';
import { TICKS_PER_QUARTER as TPQ } from './types';
import type { MeterInfo } from './meter';

const TRIPLET_STEP = TPQ / 3; // eighth-triplet
/** Onsets up to 1/12 beat early belong to the next beat's window. */
const WINDOW_LEAD = TPQ / 12;

/** Straight grid step in ticks. In 6/8 the coarsest grid is the eighth. */
export function gridStep(grid: Grid, meter: MeterInfo): number {
  if (grid === 'sixteenth') return TPQ / 4;
  if (grid === 'eighth' || meter.compound) return TPQ / 2;
  return TPQ;
}

export interface QuantizeResult {
  notes: QuantNote[];
  /** Quarter-beat indices quantized to the triplet grid. */
  tripletBeats: Set<number>;
}

/**
 * Snaps onsets and offsets to the grid. With `triplets` on (simple metres only), each beat
 * independently chooses the eighth-triplet grid when it fits the onsets in that beat
 * materially better: squared error at most half of the straight grid's, and better by a
 * fixed margin (the simplicity bias). Minimum length is one grid step. Duplicates (same
 * pitch, same quantized onset) are merged, keeping the first id.
 */
export function quantize(
  notes: PerfNote[],
  secToBeat: (sec: number) => number,
  grid: Grid,
  triplets: boolean,
  meter: MeterInfo,
): QuantizeResult {
  const g = gridStep(grid, meter);
  const useTrip = triplets && !meter.compound;
  const on = notes.map((n) => secToBeat(n.onset) * TPQ);
  const off = notes.map((n) => secToBeat(n.offset) * TPQ);
  const win = (x: number) => Math.floor((x + WINDOW_LEAD) / TPQ);

  const tripletBeats = new Set<number>();
  if (useTrip) {
    const cost = new Map<number, [number, number]>();
    for (const x of on) {
      const k = win(x);
      const c = cost.get(k) ?? [0, 0];
      c[0] += (gridErr(x, g) / TPQ) ** 2;
      c[1] += (gridErr(x, TRIPLET_STEP) / TPQ) ** 2;
      cost.set(k, c);
    }
    for (const [k, [cs, ct]] of cost) if (ct < 0.5 * cs && cs - ct > 0.004) tripletBeats.add(k);
  }
  const stepAt = (x: number) => (tripletBeats.has(win(x)) ? TRIPLET_STEP : g);
  const snap = (x: number) => {
    const s = stepAt(x);
    return Math.round(x / s) * s;
  };

  const byKey = new Map<string, QuantNote>();
  const order = notes.map((_, i) => i).sort((a, b) => notes[a]!.onset - notes[b]!.onset);
  for (const i of order) {
    const n = notes[i]!;
    const qOn = Math.max(0, snap(on[i]!));
    const minLen = stepAt(on[i]!);
    const len = Math.max(minLen, snap(off[i]!) - qOn);
    const key = `${n.pitch}@${qOn}`;
    const prev = byKey.get(key);
    if (prev) {
      prev.beats = Math.max(prev.beats, len / TPQ);
      prev.velocity = Math.max(prev.velocity, n.velocity);
      continue;
    }
    byKey.set(key, { id: n.id, pitch: n.pitch, beat: qOn / TPQ, beats: len / TPQ, velocity: n.velocity });
  }
  const out = [...byKey.values()];
  out.sort((a, b) => a.beat - b.beat || a.pitch - b.pitch);
  return { notes: out, tripletBeats };
}

function gridErr(x: number, step: number): number {
  return Math.abs(x - Math.round(x / step) * step);
}
