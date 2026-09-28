// Hand / staff split (FR-12).
//
// Notes are grouped into time slices (same quantized onset). Within a slice the split is
// a single pitch cut, so the state of slice i is "how many of its lowest notes go to the
// bass staff". A Viterbi pass picks the cut sequence minimising:
//   - distance from the middle-C default (notes below C4 in treble / C4 and up in bass),
//   - hand span beyond an octave + 2 and more than five notes per hand,
//   - jumps of each hand's centre between consecutive slices (continuity),
//   - hands crossing relative to the previous slice.
// Transition costs decay with the time gap between slices. Notes with a preset staff
// (user-added) are kept as they are.

import type { QuantNote, Staff } from './types';

const SPLIT = 60;
const MAX_SPAN = 14;

interface Slice {
  beat: number;
  idx: number[]; // note indices, ascending pitch
  ps: number[];
}

export function splitHands(notes: QuantNote[]): Staff[] {
  const staff: Staff[] = notes.map((n) => n.staff ?? (n.pitch >= SPLIT ? 'treble' : 'bass'));
  const free = notes.map((_, i) => i).filter((i) => !notes[i]!.staff);
  free.sort((a, b) => notes[a]!.beat - notes[b]!.beat || notes[a]!.pitch - notes[b]!.pitch);

  const slices: Slice[] = [];
  for (const i of free) {
    const n = notes[i]!;
    const last = slices[slices.length - 1];
    if (last && Math.abs(last.beat - n.beat) < 1e-6) {
      last.idx.push(i);
      last.ps.push(n.pitch);
    } else slices.push({ beat: n.beat, idx: [i], ps: [n.pitch] });
  }
  if (!slices.length) return staff;

  // dp[i][s]: best cost with s bass notes in slice i
  const dp: Float64Array[] = [];
  const back: Int16Array[] = [];
  for (let i = 0; i < slices.length; i++) {
    const sl = slices[i]!;
    const n = sl.ps.length;
    const cur = new Float64Array(n + 1);
    const bp = new Int16Array(n + 1);
    const prev = slices[i - 1];
    for (let s = 0; s <= n; s++) {
      const local = localCost(sl.ps, s);
      if (!prev) {
        cur[s] = local;
        continue;
      }
      const decay = Math.exp(-(sl.beat - prev.beat) / 2);
      let best = Infinity;
      let arg = 0;
      const pd = dp[i - 1]!;
      for (let t = 0; t <= prev.ps.length; t++) {
        const c = pd[t]! + decay * transitionCost(prev.ps, t, sl.ps, s);
        if (c < best) {
          best = c;
          arg = t;
        }
      }
      cur[s] = best + local;
      bp[s] = arg;
    }
    dp.push(cur);
    back.push(bp);
  }

  let s = argmin(dp[dp.length - 1]!);
  for (let i = slices.length - 1; i >= 0; i--) {
    const sl = slices[i]!;
    sl.idx.forEach((ni, k) => (staff[ni] = k < s ? 'bass' : 'treble'));
    s = back[i]![s]!;
  }
  return staff;
}

function localCost(ps: number[], s: number): number {
  let c = 0;
  for (let k = 0; k < ps.length; k++) {
    const p = ps[k]!;
    if (k < s && p >= SPLIT) c += 0.4 * (p - SPLIT + 1);
    if (k >= s && p < SPLIT) c += 0.4 * (SPLIT - p);
  }
  c += handCost(ps, 0, s) + handCost(ps, s, ps.length);
  return c;
}

function handCost(ps: number[], a: number, b: number): number {
  if (b <= a) return 0;
  const span = ps[b - 1]! - ps[a]!;
  let c = 0;
  if (span > MAX_SPAN) c += 3 * (span - MAX_SPAN);
  if (b - a > 5) c += 5 * (b - a - 5);
  return c;
}

function mean(ps: number[], a: number, b: number): number {
  let m = 0;
  for (let k = a; k < b; k++) m += ps[k]!;
  return m / (b - a);
}

function transitionCost(pp: number[], t: number, cp: number[], s: number): number {
  let c = 0;
  // continuity of each hand's centre
  if (t > 0 && s > 0) c += 0.12 * Math.abs(mean(cp, 0, s) - mean(pp, 0, t));
  if (t < pp.length && s < cp.length) c += 0.12 * Math.abs(mean(cp, s, cp.length) - mean(pp, t, pp.length));
  // crossing: treble now below where the bass just was, or vice versa
  if (t > 0 && s < cp.length && cp[s]! < pp[t - 1]!) c += 3 + 0.3 * (pp[t - 1]! - cp[s]!);
  if (t < pp.length && s > 0 && cp[s - 1]! > pp[t]!) c += 3 + 0.3 * (cp[s - 1]! - pp[t]!);
  return c;
}

function argmin(a: Float64Array): number {
  let k = 0;
  for (let i = 1; i < a.length; i++) if (a[i]! < a[k]!) k = i;
  return k;
}
