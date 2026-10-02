import type { PedalSpan, PerfNote, RawNote } from './types';

/**
 * Sustain pedal: a note released while the pedal is down keeps sounding until the pedal
 * lifts, unless the same pitch is struck again first (then it is cut at the re-strike).
 * Also sanitises input (pitch range, zero/negative durations).
 */
export function applyPedal(notes: RawNote[], pedal: PedalSpan[]): PerfNote[] {
  const spans = pedal.filter((p) => p.off > p.on).sort((a, b) => a.on - b.on);
  const out: PerfNote[] = notes
    .filter((n) => Number.isFinite(n.onset) && Number.isFinite(n.offset))
    .map((n) => ({
      id: n.id,
      pitch: Math.min(108, Math.max(21, Math.round(n.pitch))),
      onset: n.onset,
      offset: Math.max(n.offset, n.onset + 0.03),
      velocity: Math.min(127, Math.max(1, Math.round(n.velocity))),
      ...(n.staff ? { staff: n.staff } : null),
    }));

  // next onset of the same pitch, for cutting at re-strikes
  const byPitch = new Map<number, PerfNote[]>();
  for (const n of out) {
    const list = byPitch.get(n.pitch);
    if (list) list.push(n);
    else byPitch.set(n.pitch, [n]);
  }
  for (const list of byPitch.values()) {
    list.sort((a, b) => a.onset - b.onset);
    for (let i = 0; i < list.length; i++) {
      const n = list[i]!;
      const next = list[i + 1];
      const span = spanAt(spans, n.offset);
      let off = span ? Math.max(n.offset, span.off) : n.offset;
      if (next && next.onset > n.onset) off = Math.min(off, next.onset);
      n.offset = Math.max(off, n.onset + 0.03);
    }
  }
  return out;
}

/** Pedal span that is down at time t (binary search over spans sorted by `on`). */
function spanAt(spans: PedalSpan[], t: number): PedalSpan | undefined {
  let lo = 0;
  let hi = spans.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (spans[mid]!.on <= t) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  // spans may overlap; check a few earlier ones too
  for (let i = found; i >= 0 && i >= found - 3; i--) {
    const s = spans[i]!;
    if (s.on <= t && t < s.off) return s;
  }
  return undefined;
}
