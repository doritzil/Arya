// Test fixtures: turn a compact text description into RawNotes (seconds) the way the
// transcriber would emit them, optionally humanized.
//
// Voice syntax: whitespace-separated tokens `PITCH:BEATS`, where PITCH is a name
// (C4, F#3, Bb2), a chord (C3+G3) or `r` for a rest, and BEATS is quarter beats
// (1, 0.5, 1.5, 1/3). `|` is a bar marker and is ignored.

import type { EditLog, RawNotes, ScoreModel, ScoreSettings } from '../src';
import { buildScore } from '../src';

export interface PieceSpec {
  tempo: number; // quarter BPM
  voices: string[];
  startSec?: number;
  /** Fraction of the written length that sounds (legato ≈ 0.95). */
  articulation?: number;
  humanize?: { seed: number; jitterMs?: number; velJitter?: number };
  /** Pedal spans in beats [down, up]. */
  pedal?: [number, number][];
  /** Tempo drift: seconds-per-beat multiplier grows linearly by this fraction over the piece. */
  drift?: number;
}

const STEP: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function pitchOf(name: string): number {
  const m = /^([A-G])(#{1,2}|b{1,2})?(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad pitch ${name}`);
  const acc = m[2] ?? '';
  const alter = acc.startsWith('#') ? acc.length : -acc.length;
  return (Number(m[3]) + 1) * 12 + STEP[m[1]!]! + alter;
}

function beatsOf(s: string): number {
  if (s.includes('/')) {
    const [a, b] = s.split('/').map(Number) as [number, number];
    return a / b;
  }
  return Number(s);
}

export interface SpecNote {
  pitch: number;
  beat: number;
  beats: number;
  voice: number;
}

export function parseVoices(voices: string[]): SpecNote[] {
  const out: SpecNote[] = [];
  voices.forEach((v, vi) => {
    let beat = 0;
    for (const tok of v.split(/[\s|]+/)) {
      if (!tok || tok === '|') continue;
      const [p, d] = tok.split(':') as [string, string];
      const len = beatsOf(d);
      if (p !== 'r') for (const name of p.split('+')) out.push({ pitch: pitchOf(name), beat, beats: len, voice: vi });
      beat += len;
    }
  });
  return out;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRaw(spec: PieceSpec): RawNotes {
  const notes = parseVoices(spec.voices);
  const total = notes.reduce((m, n) => Math.max(m, n.beat + n.beats), 0);
  const spb = 60 / spec.tempo;
  const start = spec.startSec ?? 0.5;
  const drift = spec.drift ?? 0;
  // time of beat b with linearly changing beat length
  const sec = (b: number) => start + spb * (b + (drift * b * b) / (2 * Math.max(1, total)));
  const rnd = mulberry32(spec.humanize?.seed ?? 1);
  const jit = spec.humanize ? (spec.humanize.jitterMs ?? 20) / 1000 : 0;
  const vj = spec.humanize ? (spec.humanize.velJitter ?? 12) : 0;
  const art = spec.articulation ?? 0.92;
  const raw = notes.map((n, i) => {
    const on = sec(n.beat) + (rnd() * 2 - 1) * jit;
    const off = sec(n.beat + n.beats * art) + (rnd() * 2 - 1) * jit;
    const accent = Math.abs(n.beat - Math.round(n.beat)) < 1e-6 ? 8 : 0;
    const vel = Math.round(66 + accent + (rnd() * 2 - 1) * vj);
    return { id: `n${i}`, pitch: n.pitch, onset: on, offset: Math.max(off, on + 0.05), velocity: vel };
  });
  raw.sort((a, b) => a.onset - b.onset);
  const pedal = (spec.pedal ?? []).map(([a, b]) => ({ on: sec(a), off: sec(b) }));
  return { notes: raw, pedal };
}

export function build(spec: PieceSpec, settings: Partial<ScoreSettings> = {}, edits?: EditLog) {
  const s: ScoreSettings = { timeSig: '4/4', grid: 'eighth', triplets: false, ...settings };
  return buildScore(makeRaw(spec), s, edits);
}

/** Structural invariants every model must satisfy. Returns a list of problems (empty = ok). */
export function checkModel(model: ScoreModel): string[] {
  const errs: string[] = [];
  const ticksPerBar = Math.round(model.beatsPerBar * 48);
  const tieOpen = new Map<string, number>();
  if (model.measures.length !== model.barCount) errs.push('measure count');
  for (const m of model.measures) {
    for (const st of m.staves) {
      let cursor = 0;
      for (const e of st.events) {
        const off = Math.round(e.offset * 48);
        if (off !== cursor) errs.push(`bar ${m.number} ${st.staff}: gap/overlap at ${e.offset}`);
        if (e.ticks <= 0) errs.push(`bar ${m.number}: empty event`);
        cursor = off + e.ticks;
        for (const h of e.notes) {
          if (h.tie === 'stop' || h.tie === 'continue') {
            if (!tieOpen.has(h.noteId)) errs.push(`bar ${m.number}: dangling tie ${h.xmlId}`);
          }
          if (h.tie === 'start' || h.tie === 'continue') tieOpen.set(h.noteId, 1);
          if (h.tie === 'stop') tieOpen.delete(h.noteId);
        }
      }
      if (cursor !== ticksPerBar) errs.push(`bar ${m.number} ${st.staff}: fills ${cursor}/${ticksPerBar}`);
    }
  }
  if (tieOpen.size) errs.push(`unterminated ties: ${[...tieOpen.keys()].join(',')}`);
  for (let i = 1; i < model.notes.length; i++) {
    const a = model.notes[i - 1]!;
    const b = model.notes[i]!;
    if (a.beat > b.beat || (a.beat === b.beat && a.pitch > b.pitch)) errs.push('notes not sorted');
  }
  return errs;
}

/** Names of the notes in a bar/staff, in time then pitch order. */
export function barNames(model: ScoreModel, bar: number, staff: 'treble' | 'bass'): string[] {
  const bpb = model.beatsPerBar;
  return model.notes
    .filter((n) => n.staff === staff && n.beat >= (bar - 1) * bpb - 1e-9 && n.beat < bar * bpb - 1e-9)
    .map((n) => n.name);
}

/** Minimal XML well-formedness check: tag balance, quoted attributes, no stray `<`/`&`. */
export function xmlProblems(xml: string): string[] {
  const errs: string[] = [];
  const stack: string[] = [];
  const re = /<[^>]*>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const checkText = (t: string) => {
    if (t.includes('<')) errs.push('stray <');
    const amp = t.match(/&[^;\s]*;?/g) ?? [];
    for (const a of amp) if (!/^&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);$/.test(a)) errs.push(`bad entity ${a}`);
  };
  while ((m = re.exec(xml))) {
    checkText(xml.slice(last, m.index));
    last = m.index + m[0].length;
    const tag = m[0];
    if (tag.startsWith('<?') || tag.startsWith('<!')) continue;
    if (tag.startsWith('</')) {
      const name = tag.slice(2, -1).trim();
      const open = stack.pop();
      if (open !== name) errs.push(`mismatched </${name}> (open: ${open})`);
      continue;
    }
    const body = tag.slice(1, tag.endsWith('/>') ? -2 : -1);
    const name = /^[A-Za-z_][\w.:-]*/.exec(body)?.[0];
    if (!name) {
      errs.push(`bad tag ${tag}`);
      continue;
    }
    const attrs = body.slice(name.length).trim();
    if (attrs && !/^([\w.:-]+="[^"<]*"\s*)*$/.test(attrs)) errs.push(`bad attributes in ${tag}`);
    const seen = new Set<string>();
    for (const a of attrs.matchAll(/([\w.:-]+)=/g)) {
      if (seen.has(a[1]!)) errs.push(`duplicate attribute ${a[1]} in ${tag}`);
      seen.add(a[1]!);
    }
    if (!tag.endsWith('/>')) stack.push(name);
  }
  checkText(xml.slice(last));
  if (stack.length) errs.push(`unclosed: ${stack.join(',')}`);
  return errs;
}

// ---- pieces -------------------------------------------------------------------------------

export const CHORALE: PieceSpec = {
  tempo: 72,
  voices: [
    'E4:1 E4:1 F4:1 G4:1 | G4:1 F4:1 E4:1 D4:1 | C4:1 C4:1 D4:1 E4:1 | E4:1.5 D4:0.5 D4:2 |' +
      'E4:1 E4:1 F4:1 G4:1 | G4:1 F4:1 E4:1 D4:1 | C4:1 C4:1 D4:1 E4:1 | D4:1.5 C4:0.5 C4:2',
    'C3+G3:2 C3+G3:2 | B2+G3:2 G2+G3:2 | C3+G3:2 F3+A3:2 | G2+G3:2 G2+F3:2 |' +
      'C3+G3:2 C3+E3:2 | B2+G3:2 G2+G3:2 | A2+E3:2 F2+F3:2 | G2+F3:2 C3+E3:2',
  ],
  humanize: { seed: 7 },
};

export const DFLAT: PieceSpec = {
  tempo: 90,
  voices: [
    'Ab4:1 F4:0.5 Gb4:0.5 Ab4:1 Db5:1 | C5:1 Bb4:0.5 Ab4:0.5 Eb4:2 | Gb4:1 Bb4:0.5 Ab4:0.5 Gb4:1 Bb4:1 | Ab4:2 F4:2 |' +
      'Ab4:1 F4:0.5 Gb4:0.5 Ab4:1 Db5:1 | C5:1 Eb5:0.5 Db5:0.5 C5:2 | Bb4:1 Gb4:1 Eb4:1 C4:1 | Db4:4',
    'Db3:1 Ab3:1 F3:1 Ab3:1 | Ab2:1 Eb3:1 C3:1 Eb3:1 | Gb2:1 Db3:1 Bb2:1 Db3:1 | Db3:1 Ab3:1 F3:1 Ab3:1 |' +
      'Db3:1 Ab3:1 F3:1 Ab3:1 | Ab2:1 Eb3:1 C3:1 Eb3:1 | Gb2:1 Db3:1 Ab2:1 Eb3:1 | Db3:2 Db2+Ab2:2',
  ],
  humanize: { seed: 11 },
};

export const WALTZ: PieceSpec = {
  tempo: 120,
  voices: [
    'B4:1 C5:1 D5:1 | D5:1 B4:1 G5:2 A5:1 F#5:1 | E5:1 D5:1 C5:1 | B4:1 D5:1 G5:1 | E5:2 C5:1 | A4:1 F#4:1 D5:1 | G4:3',
    'G2:1 D3+G3+B3:1 D3+G3+B3:1 | G2:1 D3+G3+B3:1 D3+G3+B3:1 | D2:1 C3+F#3+A3:1 C3+F#3+A3:1 | D2:1 C3+F#3+A3:1 C3+F#3+A3:1 |' +
      'G2:1 D3+G3+B3:1 D3+G3+B3:1 | C3:1 E3+G3:1 E3+G3:1 | D2:1 C3+F#3+A3:1 C3+F#3+A3:1 | G2:3',
  ],
  humanize: { seed: 3 },
};

export const SIX_EIGHT: PieceSpec = {
  tempo: 90, // dotted quarter = 60
  voices: [
    'A4:1 Bb4:0.5 C5:1 A4:0.5 | F5:1.5 C5:1.5 | D5:1 C5:0.5 Bb4:1 G4:0.5 | A4:1.5 F4:1.5 |' +
      'A4:0.5 Bb4:0.5 C5:0.5 D5:0.5 E5:0.5 F5:0.5 | G5:1 E5:0.5 C5:1.5 | Bb4:1 G4:0.5 E4:1 G4:0.5 | F4:3',
    'F2+C3:1.5 F2+C3:1.5 | F2+C3:1.5 F2+C3:1.5 | Bb2+F3:1.5 Bb2+F3:1.5 | F2+C3:1.5 F2+C3:1.5 |' +
      'F2+C3:1.5 F2+C3:1.5 | C3+G3:1.5 C3+G3:1.5 | C3+G3:1.5 C3+G3:1.5 | F2+C3:3',
  ],
  humanize: { seed: 5 },
};

export const A_MINOR: PieceSpec = {
  tempo: 100,
  voices: [
    'A4:1 C5:1 E5:1 A5:1 | G#5:1 E5:1 B4:1 E5:1 | A5:1 E5:0.5 C5:0.5 A4:2 | B4:1 C5:1 D5:1 G#4:1 |' +
      'A4:1 C5:1 E5:1 D5:1 | C5:1 B4:1 A4:1 G#4:1 | F4:1 A4:1 D5:1 B4:1 | A4:4',
    'A2:2 C3+E3+A3:2 | E2:2 E3+G#3+B3:2 | A2:2 C3+E3+A3:2 | E2:2 E3+G#3+B3:2 |' +
      'A2:2 C3+E3+A3:2 | A2:2 E2:2 | D3:2 E2+E3:2 | A2+C3+E3:4',
  ],
  humanize: { seed: 13 },
};

export const TRIPLETS: PieceSpec = {
  tempo: 80,
  voices: [
    'C5:1 E5:1/3 D5:1/3 C5:1/3 G4:1 A4:1/3 B4:1/3 C5:1/3 | D5:1 F5:1/3 E5:1/3 D5:1/3 A4:1 B4:1/3 C5:1/3 D5:1/3 |' +
      'E5:1 G5:1/3 F5:1/3 E5:1/3 D5:1 C5:1/3 B4:1/3 A4:1/3 | G4:2 C5:2',
    'C3:1 G3:1 E3:1 G3:1 | F2:1 C3:1 A2:1 C3:1 | G2:1 D3:1 B2:1 D3:1 | C3:2 C2+G2:2',
  ],
  humanize: { seed: 17, jitterMs: 15 },
};
