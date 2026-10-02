// Notation layer: bars → two staves → one voice each → chords/rests with ties, tuplets,
// beams and printed accidentals. Serializers only walk this structure.
//
// Single voice per staff (v1): notes with the same onset form a chord whose length is the
// longest of them; when a later onset (or an explicit rest) arrives in the same staff while
// the previous chord still sounds, the previous chord is cut at that onset. `ScoreNote.beats`
// keeps the untruncated length (used by MIDI / falling notes).

import type {
  Accidental,
  Measure,
  MeasureEvent,
  MeasureStaff,
  NoteHead,
  NoteValue,
  RestItem,
  ScoreNote,
  Staff,
} from './types';
import { TICKS_PER_QUARTER as TPQ } from './types';
import type { MeterInfo } from './meter';

interface Piece {
  start: number;
  len: number;
  value: NoteValue;
  dots: 0 | 1;
  triplet: boolean;
}

const STRAIGHT: { len: number; value: NoteValue; dots: 0 | 1 }[] = [
  { len: 192, value: 'whole', dots: 0 },
  { len: 144, value: 'half', dots: 1 },
  { len: 96, value: 'half', dots: 0 },
  { len: 72, value: 'quarter', dots: 1 },
  { len: 48, value: 'quarter', dots: 0 },
  { len: 36, value: 'eighth', dots: 1 },
  { len: 24, value: 'eighth', dots: 0 },
  { len: 18, value: '16th', dots: 1 },
  { len: 12, value: '16th', dots: 0 },
  { len: 6, value: '32nd', dots: 0 },
];
const TRIPLET: { len: number; value: NoteValue }[] = [
  { len: 32, value: 'quarter' },
  { len: 16, value: 'eighth' },
  { len: 8, value: '16th' },
];

/**
 * Splits [start, end) (ticks, inside one bar) into notatable pieces, greedily taking the
 * longest value allowed at each position:
 *  - values of a beat or longer start on a beat; in 4/4 they don't straddle the middle of
 *    the bar unless they start the bar; in 6/8 only dotted quarter / dotted half;
 *  - shorter values stay inside their beat and start on a multiple of half their length
 *    (dotted ones on a multiple of their undotted double);
 *  - inside a triplet beat, eighth-triplet values are used unless the span covers the beat.
 */
export function splitSpan(start: number, end: number, barStart: number, meter: MeterInfo, trip: Set<number>): Piece[] {
  const out: Piece[] = [];
  let p = start;
  let guard = 0;
  while (p < end && guard++ < 1000) {
    const rem = end - p;
    const piece = pickTriplet(p, rem, trip) ?? pickStraight(p, rem, barStart, meter, trip) ?? {
      start: p,
      len: Math.min(rem, 6),
      value: '32nd' as NoteValue,
      dots: 0 as const,
      triplet: false,
    };
    out.push(piece);
    p += piece.len;
  }
  return out;
}

function pickTriplet(p: number, rem: number, trip: Set<number>): Piece | null {
  const k = Math.floor(p / TPQ);
  if (!trip.has(k)) return null;
  const relW = p - k * TPQ;
  if (relW === 0 && rem >= TPQ) return null;
  const winEnd = (k + 1) * TPQ;
  for (const t of TRIPLET) {
    if (t.len <= rem && relW % t.len === 0 && p + t.len <= winEnd)
      return { start: p, len: t.len, value: t.value, dots: 0, triplet: true };
  }
  return null;
}

function pickStraight(p: number, rem: number, barStart: number, meter: MeterInfo, trip: Set<number>): Piece | null {
  const rel = p - barStart;
  for (const v of STRAIGHT) {
    if (v.len > rem) continue;
    const e = p + v.len;
    if (e % TPQ !== 0 && trip.has(Math.floor(e / TPQ))) continue; // would end mid-triplet
    if (allowedStraight(v.len, v.dots, rel, meter)) return { start: p, len: v.len, value: v.value, dots: v.dots, triplet: false };
  }
  return null;
}

function allowedStraight(len: number, dots: 0 | 1, rel: number, meter: MeterInfo): boolean {
  const U = meter.unitTicks;
  if (rel + len > meter.barTicks) return false;
  if (len >= U) {
    if (rel % U !== 0) return false;
    if (meter.compound) return len % U === 0;
    const half = meter.barTicks / 2;
    if ((meter.timeSig === '4/4' || meter.timeSig === '2/2') && rel !== 0 && rel < half && rel + len > half) return false;
    return true;
  }
  const relU = rel % U;
  if (relU + len > U) return false;
  const align = dots ? (len * 4) / 3 : len / 2;
  return relU % align === 0;
}

const ACC: Record<number, Accidental> = { [-2]: 'flat-flat', [-1]: 'flat', 0: 'natural', 1: 'sharp', 2: 'double-sharp' };
const SHARP_ORDER = 'FCGDAEB';
const FLAT_ORDER = 'BEADGCF';

export function buildMeasures(
  notes: ScoreNote[],
  rests: RestItem[],
  meter: MeterInfo,
  barCount: number,
  trip: Set<number>,
  keyFifths: number,
): Measure[] {
  const bar = meter.barTicks;
  const total = barCount * bar;
  const measures: Measure[] = [];
  for (let i = 0; i < barCount; i++) {
    measures.push({
      number: i + 1,
      startBeat: (i * bar) / TPQ,
      beats: bar / TPQ,
      staves: [
        { staff: 'treble', n: 1, events: [] },
        { staff: 'bass', n: 2, events: [] },
      ],
    });
  }

  (['treble', 'bass'] as Staff[]).forEach((staff, si) => {
    type Item = { start: number; end: number; notes: ScoreNote[]; restId?: string };
    const items: Item[] = [];
    const byStart = new Map<number, Item>();
    for (const n of notes) {
      if (n.staff !== staff) continue;
      const start = Math.round(n.beat * TPQ);
      const end = start + Math.max(1, Math.round(n.beats * TPQ));
      const it = byStart.get(start);
      if (it) {
        it.notes.push(n);
        it.end = Math.max(it.end, end);
      } else {
        const ni: Item = { start, end, notes: [n] };
        byStart.set(start, ni);
        items.push(ni);
      }
    }
    for (const r of rests) {
      if (r.staff !== staff) continue;
      const start = Math.round(r.beat * TPQ);
      if (byStart.has(start)) continue; // a chord wins over a rest at the same onset
      items.push({ start, end: start + Math.max(1, Math.round(r.beats * TPQ)), notes: [], restId: r.id });
    }
    items.sort((a, b) => a.start - b.start || b.notes.length - a.notes.length);
    const uniq = items.filter((it, i) => i === 0 || items[i - 1]!.start !== it.start);

    for (let i = 0; i < uniq.length; i++) {
      const it = uniq[i]!;
      const next = uniq[i + 1];
      const end = Math.min(it.end, next ? next.start : Infinity, total);
      if (end <= it.start) continue;
      const pieces: { barIdx: number; piece: Piece }[] = [];
      let s = it.start;
      while (s < end) {
        const barIdx = Math.floor(s / bar);
        const segEnd = Math.min(end, (barIdx + 1) * bar);
        for (const piece of splitSpan(s, segEnd, barIdx * bar, meter, trip)) pieces.push({ barIdx, piece });
        s = segEnd;
      }
      const K = pieces.length;
      const sorted = [...it.notes].sort((a, b) => a.pitch - b.pitch);
      pieces.forEach(({ barIdx, piece }, k) => {
        const sfx = k === 0 ? '' : `_t${k}`;
        const tie = K === 1 ? undefined : k === 0 ? 'start' : k === K - 1 ? 'stop' : 'continue';
        const heads: NoteHead[] = sorted.map((n) => ({
          xmlId: n.id + sfx,
          noteId: n.id,
          pitch: n.pitch,
          spelled: n.spelled,
          name: n.name,
          ...(tie ? { tie } : {}),
        }));
        const xmlId = heads.length === 0 ? it.restId! + sfx : heads.length === 1 ? heads[0]!.xmlId : `${heads[0]!.xmlId}_c`;
        measures[barIdx]!.staves[si]!.events.push(makeEvent(heads.length ? 'chord' : 'rest', xmlId, piece, barIdx * bar, heads));
      });
    }
  });

  for (const m of measures) {
    const barStart = (m.number - 1) * bar;
    for (const st of m.staves) {
      fillRests(st, m.number, barStart, meter, trip);
      markTuplets(st);
      markBeams(st, barStart, meter);
      markAccidentals(st, keyFifths);
    }
  }
  return measures;
}

function makeEvent(kind: 'chord' | 'rest', xmlId: string, p: Piece, barStart: number, notes: NoteHead[]): MeasureEvent {
  return {
    kind,
    xmlId,
    beat: p.start / TPQ,
    offset: (p.start - barStart) / TPQ,
    beats: p.len / TPQ,
    ticks: p.len,
    value: p.value,
    dots: p.dots,
    ...(p.triplet ? { triplet: true } : {}),
    notes,
  };
}

function fillRests(st: MeasureStaff, num: number, barStart: number, meter: MeterInfo, trip: Set<number>): void {
  const bar = meter.barTicks;
  if (!st.events.length) {
    st.events.push({
      kind: 'rest',
      xmlId: `r${num}_${st.n}_0`,
      beat: barStart / TPQ,
      offset: 0,
      beats: bar / TPQ,
      ticks: bar,
      value: 'whole',
      dots: 0,
      notes: [],
      measureRest: true,
    });
    return;
  }
  st.events.sort((a, b) => a.beat - b.beat);
  const out: MeasureEvent[] = [];
  let cursor = barStart;
  let rid = 0;
  const gap = (to: number) => {
    for (const p of splitSpan(cursor, to, barStart, meter, trip))
      out.push(makeEvent('rest', `r${num}_${st.n}_${rid++}`, p, barStart, []));
  };
  for (const ev of st.events) {
    const s = Math.round(ev.beat * TPQ);
    if (s > cursor) gap(s);
    out.push(ev);
    cursor = s + ev.ticks;
  }
  if (cursor < barStart + bar) gap(barStart + bar);
  st.events = out;
}

function markTuplets(st: MeasureStaff): void {
  const ev = st.events;
  for (let i = 0; i < ev.length; i++) {
    const e = ev[i]!;
    if (!e.triplet) continue;
    const k = Math.floor(e.beat + 1e-9);
    const prev = ev[i - 1];
    const next = ev[i + 1];
    if (!prev?.triplet || Math.floor(prev.beat + 1e-9) !== k) e.tupletStart = true;
    if (!next?.triplet || Math.floor(next.beat + 1e-9) !== k) e.tupletStop = true;
  }
}

/** Beams eighths and shorter within each beat (dotted-quarter groups in 6/8); rests and tuplet edges break beams. */
function markBeams(st: MeasureStaff, barStart: number, meter: MeterInfo): void {
  const group = meter.unitTicks;
  let run: MeasureEvent[] = [];
  let runKey = '';
  const flush = () => {
    if (run.length >= 2) run.forEach((e, i) => (e.beam = i === 0 ? 'begin' : i === run.length - 1 ? 'end' : 'continue'));
    run = [];
  };
  for (const e of st.events) {
    const beamable = e.kind === 'chord' && e.ticks < TPQ && e.value !== 'quarter';
    const start = Math.round(e.beat * TPQ) - barStart;
    const key = `${Math.floor(start / group)}:${e.triplet ? 't' : 's'}`;
    if (!beamable) {
      flush();
      continue;
    }
    if (key !== runKey) flush();
    runKey = key;
    run.push(e);
    if (e.tupletStop) flush();
  }
  flush();
}

function markAccidentals(st: MeasureStaff, keyFifths: number): void {
  const keyAlter: Record<string, number> = {};
  for (let i = 0; i < Math.min(7, Math.abs(keyFifths)); i++) {
    if (keyFifths > 0) keyAlter[SHARP_ORDER[i]!] = 1;
    else keyAlter[FLAT_ORDER[i]!] = -1;
  }
  const state = new Map<string, number>();
  for (const e of st.events) {
    for (const h of e.notes) {
      if (h.tie === 'continue' || h.tie === 'stop') continue;
      const key = `${h.spelled.step}${h.spelled.octave}`;
      const cur = state.get(key) ?? keyAlter[h.spelled.step] ?? 0;
      if (h.spelled.alter !== cur) {
        h.accidental = ACC[h.spelled.alter];
        state.set(key, h.spelled.alter);
      }
    }
  }
}
