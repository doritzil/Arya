// Tempo estimation, beat tracking and downbeat (meter phase) selection.
//
// All work here is in "units": the felt beat of the metre (quarter, or dotted quarter
// in 6/8). Conversions to quarter-note BPM happen at the edges.

import type { PerfNote } from './types';

export interface OnsetEvent {
  t: number; // sec
  /** Salience used for tempo/beat tracking. */
  s: number;
  /** Lowest pitch in the event. */
  low: number;
  /** Longest note in the event (sec). */
  dur: number;
}

const CLUSTER_SEC = 0.035;

/** Groups near-simultaneous onsets (chords, rolled chords) into weighted events. */
export function onsetEvents(notes: PerfNote[]): OnsetEvent[] {
  const sorted = [...notes].sort((a, b) => a.onset - b.onset);
  const out: OnsetEvent[] = [];
  let i = 0;
  while (i < sorted.length) {
    const t0 = sorted[i]!.onset;
    let sumT = 0;
    let sumV = 0;
    let low = 128;
    let dur = 0;
    let n = 0;
    while (i < sorted.length && sorted[i]!.onset - t0 <= CLUSTER_SEC) {
      const x = sorted[i]!;
      sumT += x.onset;
      sumV += x.velocity;
      low = Math.min(low, x.pitch);
      dur = Math.max(dur, x.offset - x.onset);
      n++;
      i++;
    }
    const vel = sumV / n / 90;
    // louder, fuller and lower events are more likely to be on the beat
    const s = vel * (1 + 0.3 * (n - 1)) + (low < 55 ? 0.8 : 0);
    out.push({ t: sumT / n, s, low, dur });
  }
  return out;
}

// ---- tempo --------------------------------------------------------------------------

const BIN = 0.005;
const MAX_LAG = 3.2;
const NB = Math.ceil(MAX_LAG / BIN) + 2;
const MAX_PAIRS = 32;

/** Tempo prior (quarter BPM): flat over 60–140, soft fall-off outside, gentle pull to ~100 for ties. */
function tempoPrior(q: number): number {
  let p = 1;
  if (q < 60) p = Math.exp(-0.5 * (Math.log2(q / 60) / 0.4) ** 2);
  else if (q > 140) p = Math.exp(-0.5 * (Math.log2(q / 140) / 0.4) ** 2);
  return p * Math.exp(-0.5 * (Math.log2(q / 100) / 1.2) ** 2);
}

/**
 * Global tempo from an inter-onset-interval histogram (all pairs within 3.2 s, weighted by
 * salience) scored as a comb over the first multiples of each candidate beat period. Local
 * intervals make this robust to slow drift. Returns quarter-note BPM, refined by averaging
 * the matching intervals (sub-BPM precision).
 */
export function estimateTempo(
  ev: OnsetEvent[],
  unitQ: number,
  compound: boolean,
  countInBpm?: number,
): number {
  const fallback = countInBpm && countInBpm > 0 ? countInBpm : 100;
  if (ev.length < 4) return fallback;

  const h = new Float64Array(NB);
  forEachPair(ev, (d, w) => {
    const x = d / BIN;
    const k = Math.floor(x);
    const f = x - k;
    h[k] = h[k]! + w * (1 - f);
    h[k + 1] = h[k + 1]! + w * f;
  });
  const hs = gaussianSmooth(h, 3);
  const H = (sec: number): number => {
    const x = sec / BIN;
    const k = Math.floor(x);
    if (k < 0 || k + 1 >= NB) return 0;
    const f = x - k;
    return hs[k]! * (1 - f) + hs[k + 1]! * f;
  };

  let lo = 40;
  let hi = 200;
  if (countInBpm && countInBpm > 0) {
    lo = Math.max(40, countInBpm * 0.88);
    hi = Math.min(200, countInBpm * 1.12);
    if (lo > hi) lo = hi = Math.min(200, Math.max(40, countInBpm));
  }
  let best = -1;
  let bestQ = fallback;
  for (let q = lo; q <= hi + 1e-9; q += 0.5) {
    const P = (unitQ * 60) / q;
    let sum = 0;
    let cnt = 0;
    for (let k = 1; k <= 4; k++) {
      if (k * P > MAX_LAG - 0.05) break;
      sum += H(k * P);
      cnt++;
    }
    // compound metre: the beat must divide into three
    if (compound) {
      sum += H(P / 3);
      cnt++;
    }
    const sc = cnt ? (sum / cnt) * tempoPrior(q) : 0;
    if (sc > best) {
      best = sc;
      bestQ = q;
    }
  }

  // refine: weighted mean of the intervals close to k·P
  let P = (unitQ * 60) / bestQ;
  for (let iter = 0; iter < 2; iter++) {
    let sw = 0;
    let sp = 0;
    const tol = Math.max(0.02, 0.06 * P);
    forEachPair(ev, (d, w) => {
      const k = Math.round(d / P);
      if (k < 1 || k > 4) return;
      if (Math.abs(d - k * P) < tol) {
        sw += w;
        sp += (w * d) / k;
      }
    });
    if (sw > 0) P = sp / sw;
  }
  return (unitQ * 60) / P;
}

function forEachPair(ev: OnsetEvent[], fn: (d: number, w: number) => void): void {
  for (let i = 0; i < ev.length; i++) {
    const a = ev[i]!;
    for (let j = i + 1; j < ev.length && j - i <= MAX_PAIRS; j++) {
      const b = ev[j]!;
      const d = b.t - a.t;
      if (d > MAX_LAG) break;
      if (d < 0.1) continue;
      fn(d, a.s * b.s);
    }
  }
}

function gaussianSmooth(h: Float64Array, sigma: number): Float64Array {
  const r = Math.ceil(sigma * 3);
  const k: number[] = [];
  for (let i = -r; i <= r; i++) k.push(Math.exp(-0.5 * (i / sigma) ** 2));
  const out = new Float64Array(h.length);
  for (let i = 0; i < h.length; i++) {
    const v = h[i]!;
    if (v === 0) continue;
    for (let j = -r; j <= r; j++) {
      const t = i + j;
      if (t >= 0 && t < h.length) out[t] = out[t]! + v * k[j + r]!;
    }
  }
  return out;
}

// ---- beat tracking ------------------------------------------------------------------

/**
 * Beat times (sec) of the felt beat, period P. Initial phase from the first ~12 beats
 * (salience-weighted fold), then a light phase-locked loop that follows events near each
 * predicted beat, allowing ±8 % tempo drift. `rigid` disables the corrections.
 */
export function trackBeats(ev: OnsetEvent[], P: number, rigid: boolean): number[] {
  if (!ev.length) return [0, P];
  const t0 = ev[0]!.t;
  const tEnd = ev[ev.length - 1]!.t;

  const sigma = Math.min(0.04, P / 10);
  const horizon = t0 + 12 * P;
  let phase = t0;
  let bestScore = -1;
  const NPH = 64;
  for (let b = 0; b < NPH; b++) {
    const ph = t0 + (b * P) / NPH;
    let sc = 0;
    for (const e of ev) {
      if (e.t > horizon) break;
      let d = (((e.t - ph) % P) + P) % P;
      if (d > P / 2) d -= P;
      sc += e.s * Math.exp(-0.5 * (d / sigma) ** 2);
    }
    if (sc > bestScore) {
      bestScore = sc;
      phase = ph;
    }
  }
  const rel = (((t0 - phase) % P) + P) % P;
  let b = t0 - rel;
  if (P - rel < 2 * sigma) b += P; // first event is just ahead of a beat

  const beats = [b];
  let p = P;
  let idx = 0;
  const win = 0.12 * P;
  const sig = 0.06 * P;
  while (b < tEnd + 0.5 * P) {
    const pred = b + p;
    while (idx < ev.length && ev[idx]!.t < pred - win) idx++;
    let bestJ = -1;
    let bw = 0;
    for (let j = idx; j < ev.length && ev[j]!.t <= pred + win; j++) {
      const d = ev[j]!.t - pred;
      const w = ev[j]!.s * Math.exp(-0.5 * (d / sig) ** 2);
      if (w > bw) {
        bw = w;
        bestJ = j;
      }
    }
    if (!rigid && bestJ >= 0) {
      const err = ev[bestJ]!.t - pred;
      b = pred + 0.6 * err;
      p = Math.min(1.08 * P, Math.max(0.92 * P, p + 0.1 * err));
    } else b = pred;
    beats.push(b);
  }
  return beats;
}

// ---- time <-> fractional index over a monotonic time list -----------------------------

export interface Interp {
  toPos(sec: number): number;
  toSec(pos: number): number;
}

/** Piecewise-linear map between index positions and times, extrapolating at both ends. */
export function makeInterp(times: number[]): Interp {
  const n = times.length;
  const first = times[0] ?? 0;
  const p0 = n > 1 ? times[1]! - first : 0.5;
  const last = times[n - 1] ?? 0;
  const p1 = n > 1 ? last - times[n - 2]! : p0;
  return {
    toSec(pos) {
      if (pos <= 0 || n < 2) return first + pos * p0;
      if (pos >= n - 1) return last + (pos - (n - 1)) * p1;
      const k = Math.floor(pos);
      const a = times[k]!;
      return a + (times[k + 1]! - a) * (pos - k);
    },
    toPos(sec) {
      if (sec <= first || n < 2) return (sec - first) / p0;
      if (sec >= last) return n - 1 + (sec - last) / p1;
      let lo = 0;
      let hi = n - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (times[mid]! <= sec) lo = mid;
        else hi = mid;
      }
      const a = times[lo]!;
      const bb = times[hi]!;
      return lo + (sec - a) / (bb - a);
    },
  };
}

// ---- downbeat ---------------------------------------------------------------------------

/**
 * Chooses which tracked beat is a downbeat: the bar phase that puts the most low, long,
 * salient events on bar starts. Near-ties go to the phase that makes the first event a
 * downbeat (no pickup). Returns the unit index (possibly negative) of the first barline,
 * at or before the first event.
 */
export function chooseDownbeat(ev: OnsetEvent[], unit: Interp, unitsPerBar: number, P: number): number {
  if (!ev.length) return 0;
  const scores = new Array<number>(unitsPerBar).fill(0);
  for (const e of ev) {
    const pos = unit.toPos(e.t);
    const u = Math.round(pos);
    if (Math.abs(pos - u) > 0.15) continue;
    const w = 1 + Math.max(0, 60 - e.low) / 6 + 0.5 * Math.min(e.dur / P, 3);
    const c = mod(u, unitsPerBar);
    scores[c] = scores[c]! + w;
  }
  const f = unit.toPos(ev[0]!.t);
  const firstC = mod(Math.round(f), unitsPerBar);
  let best = 0;
  for (let c = 1; c < unitsPerBar; c++) if (scores[c]! > scores[best]!) best = c;
  if (scores[firstC]! >= 0.9 * scores[best]!) best = firstC;
  return best + unitsPerBar * Math.floor((f + 0.25 - best) / unitsPerBar);
}

export function mod(a: number, m: number): number {
  return ((a % m) + m) % m;
}
