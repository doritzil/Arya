import type { BuildResult, MeasureEvent } from '../src';
import {
  A_MINOR,
  CHORALE,
  DFLAT,
  SIX_EIGHT,
  TRIPLETS,
  WALTZ,
  barNames,
  build,
  checkModel,
  makeRaw,
  parseVoices,
  type PieceSpec,
} from './fixtures';
import { buildScore } from '../src';

const events = (r: BuildResult, bar: number, staff: 0 | 1): MeasureEvent[] => r.model.measures[bar - 1]!.staves[staff].events;

/** Every expected pitch appears at its beat (shifted by `shift` quarters for a pickup). */
function expectPitchesAt(r: BuildResult, spec: PieceSpec, shift = 0) {
  const want = parseVoices(spec.voices);
  const have = new Set(r.model.notes.map((n) => `${n.pitch}@${Math.round((n.beat - shift) * 48)}`));
  const missing = want.filter((w) => !have.has(`${w.pitch}@${Math.round(w.beat * 48)}`));
  expect(missing).toEqual([]);
}

describe('C major chorale (4/4, 72 bpm, humanized)', () => {
  const r = build(CHORALE);
  const m = r.model;

  test('tempo, key, bars', () => {
    expect(Math.abs(r.diagnostics.detectedTempoBpm - 72)).toBeLessThanOrEqual(3);
    expect(m.settings.keyFifths).toBe(0);
    expect(m.settings.keyMode).toBe('major');
    expect(m.barCount).toBe(8);
    expect(r.diagnostics.noteCount).toBe(parseVoices(CHORALE.voices).length);
  });

  test('notes land on the written beats with the right names', () => {
    expectPitchesAt(r, CHORALE);
    expect(barNames(m, 1, 'treble')).toEqual(['E4', 'E4', 'F4', 'G4']);
    expect(barNames(m, 1, 'bass')).toEqual(['C3', 'G3', 'C3', 'G3']);
    expect(barNames(m, 4, 'treble')).toEqual(['E4', 'D4', 'D4']);
    const dotted = m.notes.find((n) => n.beat === 12 && n.staff === 'treble')!;
    expect(dotted.beats).toBe(1.5);
  });

  test('staff split: melody treble, accompaniment bass', () => {
    for (const n of m.notes) expect(n.staff).toBe(n.pitch >= 60 ? 'treble' : 'bass');
  });

  test('bars fill exactly, no overlaps, dotted quarter notated', () => {
    expect(checkModel(m)).toEqual([]);
    const ev = events(r, 4, 0);
    expect(ev.map((e) => [e.value, e.dots])).toEqual([
      ['quarter', 1],
      ['eighth', 0],
      ['half', 0],
    ]);
  });

  test('beat map follows the performance', () => {
    const first = makeRaw(CHORALE).notes[0]!;
    expect(Math.abs(r.beatMap.beatToSec(0) - first.onset)).toBeLessThan(0.05);
    expect(r.beatMap.secToBeat(r.beatMap.beatToSec(10.5))).toBeCloseTo(10.5, 6);
    expect(r.beatMap.beats.length).toBeGreaterThanOrEqual(m.barCount * 4 + 1);
    const spb = (r.beatMap.beats[20]! - r.beatMap.beats[0]!) / 20;
    expect(Math.abs(60 / spb - 72)).toBeLessThan(3);
  });
});

describe('D♭ major (4/4, 90 bpm)', () => {
  const r = build(DFLAT);
  const m = r.model;

  test('tempo and key = 5 flats', () => {
    expect(Math.abs(r.diagnostics.detectedTempoBpm - 90)).toBeLessThanOrEqual(3);
    expect(r.diagnostics.detectedKeyFifths).toBe(-5);
    expect(m.settings.keyMode).toBe('major');
    expect(m.barCount).toBe(8);
  });

  test('spelled with flats', () => {
    expectPitchesAt(r, DFLAT);
    expect(m.notes.some((n) => n.name.includes('#'))).toBe(false);
    expect(barNames(m, 1, 'treble')).toEqual(['Ab4', 'F4', 'Gb4', 'Ab4', 'Db5']);
    expect(barNames(m, 2, 'bass')).toEqual(['Ab2', 'Eb3', 'C3', 'Eb3']);
    // key signature covers the flats: no printed accidentals anywhere
    const printed = m.measures.flatMap((ms) => ms.staves.flatMap((s) => s.events.flatMap((e) => e.notes.filter((h) => h.accidental))));
    expect(printed).toEqual([]);
  });

  test('eighths beamed in pairs by beat', () => {
    expect(checkModel(m)).toEqual([]);
    const ev = events(r, 1, 0);
    expect(ev.map((e) => e.beam ?? '-')).toEqual(['-', 'begin', 'end', '-', '-']);
  });
});

describe('3/4 waltz (G major, 120 bpm)', () => {
  const r = build(WALTZ, { timeSig: '3/4' });
  const m = r.model;

  test('tempo, key, bars, downbeat', () => {
    expect(Math.abs(r.diagnostics.detectedTempoBpm - 120)).toBeLessThanOrEqual(3);
    expect(m.settings.keyFifths).toBe(1);
    expect(m.beatsPerBar).toBe(3);
    expect(m.barCount).toBe(8);
    expectPitchesAt(r, WALTZ);
    // the low bass note starts each bar
    for (let b = 1; b <= 8; b++) expect(barNames(m, b, 'bass')[0]).toMatch(/^[GDC][23]$/);
  });

  test('half note over the barline is tied', () => {
    expect(checkModel(m)).toEqual([]);
    const g5 = m.notes.find((n) => n.name === 'G5' && n.beat === 5)!;
    expect(g5.beats).toBe(2);
    const last2 = events(r, 2, 0).at(-1)!;
    const first3 = events(r, 3, 0)[0]!;
    expect(last2.notes[0]).toMatchObject({ noteId: g5.id, xmlId: g5.id, tie: 'start' });
    expect(first3.notes[0]).toMatchObject({ noteId: g5.id, xmlId: `${g5.id}_t1`, tie: 'stop' });
    expect(last2.value).toBe('quarter');
  });

  test('F# spelled as sharp and covered by the key signature', () => {
    const fs = m.notes.filter((n) => n.pitch % 12 === 6);
    expect(fs.length).toBeGreaterThan(0);
    for (const n of fs) expect(n.name.startsWith('F#')).toBe(true);
    const printed = m.measures.flatMap((ms) => ms.staves.flatMap((s) => s.events.flatMap((e) => e.notes.filter((h) => h.accidental))));
    expect(printed).toEqual([]);
  });
});

describe('6/8 (F major, dotted quarter = 60)', () => {
  const r = build(SIX_EIGHT, { timeSig: '6/8' });
  const m = r.model;

  test('tempo in quarter bpm, key, bars', () => {
    expect(Math.abs(r.diagnostics.detectedTempoBpm - 90)).toBeLessThanOrEqual(3);
    expect(m.settings.keyFifths).toBe(-1);
    expect(m.beatsPerBar).toBe(3);
    expect(m.barCount).toBe(8);
    expectPitchesAt(r, SIX_EIGHT);
    expect(checkModel(m)).toEqual([]);
  });

  test('compound notation: dotted quarters and eighths beamed in threes', () => {
    expect(events(r, 2, 0).map((e) => [e.value, e.dots])).toEqual([
      ['quarter', 1],
      ['quarter', 1],
    ]);
    expect(events(r, 1, 0).map((e) => e.value)).toEqual(['quarter', 'eighth', 'quarter', 'eighth']);
    expect(events(r, 5, 0).map((e) => e.beam)).toEqual(['begin', 'continue', 'end', 'begin', 'continue', 'end']);
    expect(events(r, 8, 0).map((e) => [e.value, e.dots])).toEqual([['half', 1]]);
  });
});

describe('A minor (4/4, 100 bpm)', () => {
  const r = build(A_MINOR);
  const m = r.model;

  test('key = A minor, leading tone spelled G#', () => {
    expect(Math.abs(r.diagnostics.detectedTempoBpm - 100)).toBeLessThanOrEqual(3);
    expect(m.settings.keyFifths).toBe(0);
    expect(m.settings.keyMode).toBe('minor');
    expect(m.barCount).toBe(8);
    expectPitchesAt(r, A_MINOR);
    const gs = m.notes.filter((n) => n.pitch % 12 === 8).map((n) => n.name);
    expect(gs).toContain('G#5');
    expect(gs).toContain('G#3');
    expect(gs.every((x) => x.startsWith('G#'))).toBe(true);
    // accidental printed once per bar/octave
    const bar2 = events(r, 2, 0);
    expect(bar2[0]!.notes[0]!.accidental).toBe('sharp');
    expect(checkModel(m)).toEqual([]);
  });
});

describe('triplets', () => {
  test('on: triplet beats use the 1/3 grid with tuplets and beams', () => {
    const r = build(TRIPLETS, { triplets: true });
    const m = r.model;
    expect(Math.abs(r.diagnostics.detectedTempoBpm - 80)).toBeLessThanOrEqual(3);
    expect(m.tripletBeats).toEqual([1, 3, 5, 7, 9, 11]);
    expectPitchesAt(r, TRIPLETS);
    expect(checkModel(m)).toEqual([]);
    const ev = events(r, 1, 0);
    expect(ev.map((e) => e.value)).toEqual(['quarter', 'eighth', 'eighth', 'eighth', 'quarter', 'eighth', 'eighth', 'eighth']);
    const t = ev.slice(1, 4);
    expect(t.every((e) => e.triplet)).toBe(true);
    expect(t.map((e) => [!!e.tupletStart, !!e.tupletStop])).toEqual([
      [true, false],
      [false, false],
      [false, true],
    ]);
    expect(t.map((e) => e.beam)).toEqual(['begin', 'continue', 'end']);
  });

  test('off: everything on the eighth grid, no tuplets', () => {
    const r = build(TRIPLETS, { triplets: false });
    const m = r.model;
    expect(m.tripletBeats).toEqual([]);
    for (const n of m.notes) expect((n.beat * 2) % 1).toBe(0);
    expect(m.measures.some((ms) => ms.staves.some((s) => s.events.some((e) => e.triplet)))).toBe(false);
    expect(checkModel(m)).toEqual([]);
  });

  test('straight music does not become triplets when enabled', () => {
    const r = build(DFLAT, { triplets: true, grid: 'sixteenth' });
    expect(r.model.tripletBeats).toEqual([]);
    expectPitchesAt(r, DFLAT);
  });
});

describe('settings and robustness', () => {
  test('tempo override and count-in', () => {
    const over = build(CHORALE, { tempoBpm: 70 });
    expect(over.model.settings.tempoBpm).toBe(70);
    expect(over.beatMap.tempoBpm).toBe(70);
    expectPitchesAt(over, CHORALE);
    // an eighth-note-only stream is ambiguous; the count-in resolves it
    const stream: PieceSpec = { tempo: 66, voices: ['C4:0.5 E4:0.5 G4:0.5 E4:0.5 '.repeat(16)], humanize: { seed: 2 } };
    const r = build(stream, { countInBpm: 66 });
    expect(Math.abs(r.diagnostics.detectedTempoBpm - 66)).toBeLessThanOrEqual(3);
    expectPitchesAt(r, stream);
  });

  test('sixteenth grid keeps sixteenths; quarter grid coarsens', () => {
    const spec: PieceSpec = {
      tempo: 76,
      voices: ['C5:0.25 D5:0.25 E5:0.5 F5:1 G5:2 | '.repeat(4), 'C3:1 G3:1 E3:1 G3:1 | '.repeat(4)],
      humanize: { seed: 9, jitterMs: 12 },
    };
    const s16 = build(spec, { grid: 'sixteenth' });
    expectPitchesAt(s16, spec);
    expect(checkModel(s16.model)).toEqual([]);
    expect(events(s16, 1, 0).slice(0, 3).map((e) => e.value)).toEqual(['16th', '16th', 'eighth']);
    const q = build(spec, { grid: 'quarter' });
    for (const n of q.model.notes) expect(n.beat % 1).toBe(0);
    for (const n of q.model.notes) expect(n.beats).toBeGreaterThanOrEqual(1);
    expect(checkModel(q.model)).toEqual([]);
  });

  test('gradual tempo drift is tracked', () => {
    const spec: PieceSpec = { ...CHORALE, voices: [CHORALE.voices[0]! + ' | ' + CHORALE.voices[0]!, CHORALE.voices[1]! + ' | ' + CHORALE.voices[1]!], drift: 0.08 };
    const r = build(spec);
    expect(r.model.barCount).toBe(16);
    expectPitchesAt(r, spec);
  });

  test('pickup (anacrusis) starts in a bar of rests, downbeats stay on the bass', () => {
    const spec: PieceSpec = { ...WALTZ, voices: ['D5:1 ' + WALTZ.voices[0]!, 'r:1 ' + WALTZ.voices[1]!] };
    const r = build(spec, { timeSig: '3/4' });
    expect(r.model.barCount).toBe(9);
    expectPitchesAt(r, spec, 2);
    expect(events(r, 1, 0).map((e) => [e.kind, e.value])).toEqual([
      ['rest', 'half'],
      ['chord', 'quarter'],
    ]);
    expect(events(r, 1, 1)[0]!.measureRest).toBe(true);
    expect(r.beatMap.beatToSec(2)).toBeCloseTo(makeRaw(spec).notes[0]!.onset, 1);
    expect(checkModel(r.model)).toEqual([]);
  });

  test('pedal extends notes until release; re-strike cuts', () => {
    const spec: PieceSpec = { tempo: 60, voices: ['C4:0.5 r:1.5 C4:0.5 E4:0.5 r:1', 'C3:4'], pedal: [[0, 1.9]], articulation: 0.9 };
    const r = build(spec, { tempoBpm: 60 });
    const [c1, c2] = r.model.notes.filter((n) => n.pitch === 60);
    expect(c1!.beats).toBeCloseTo(2, 5); // held by pedal up to the re-strike at beat 2
    expect(c2!.beats).toBe(0.5);
  });

  test('duplicates merge, empty input yields one empty bar', () => {
    const raw = makeRaw(CHORALE);
    const dup = { ...raw.notes[0]!, id: 'dup', onset: raw.notes[0]!.onset + 0.01 };
    const r = buildScore({ notes: [...raw.notes, dup], pedal: [] }, { timeSig: '4/4', grid: 'eighth', triplets: false });
    expect(r.model.notes.find((n) => n.id === 'dup')).toBeUndefined();
    expect(r.model.notes.length).toBe(raw.notes.length);

    const empty = buildScore({ notes: [], pedal: [] }, { timeSig: '3/4', grid: 'eighth', triplets: false });
    expect(empty.model.barCount).toBe(1);
    expect(empty.model.measures[0]!.staves[0].events[0]!.measureRest).toBe(true);
    expect(empty.mei).toContain('<mRest');
  });

  test('key override respected', () => {
    const r = build(CHORALE, { keyFifths: -1, keyMode: 'major' });
    expect(r.model.settings.keyFifths).toBe(-1);
    expect(r.diagnostics.detectedKeyFifths).toBe(0);
  });
});
