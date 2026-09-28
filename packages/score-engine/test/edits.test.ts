import type { EditLog, EditOp } from '../src';
import { applyEditLog, buildScore, canRedo, canUndo, emptyLog, pushEdit, redo, undo } from '../src';
import { CHORALE, build, checkModel, makeRaw } from './fixtures';

const base = build(CHORALE);
const byBeat = (beat: number, staff = 'treble') => base.model.notes.find((n) => n.beat === beat && n.staff === staff)!;
const n0 = byBeat(0); // E4
const n5 = byBeat(5); // F4 in bar 2
const n9 = byBeat(9); // C4 in bar 3

const OPS: EditOp[] = [
  { t: 'pitch', noteId: n0.id, pitch: 65 },
  { t: 'length', noteId: n5.id, beats: 2 },
  { t: 'delete', noteId: n9.id },
  { t: 'addNote', id: 'add1', beat: 30, pitch: 72, beats: 1, staff: 'treble' },
  { t: 'addNote', id: 'add2', beat: 2, pitch: 62, beats: 1, staff: 'bass' },
];
const log = OPS.reduce<EditLog>((l, op) => pushEdit(l, op), emptyLog());

function expectEditsApplied(r: ReturnType<typeof build>) {
  const notes = r.model.notes;
  expect(notes.find((n) => n.id === n0.id)).toMatchObject({ pitch: 65, name: 'F4' });
  expect(notes.find((n) => n.id === n5.id)!.beats).toBe(2);
  expect(notes.find((n) => n.id === n9.id)).toBeUndefined();
  expect(notes.find((n) => n.id === 'add1')).toMatchObject({ beat: 30, pitch: 72, staff: 'treble', added: true, name: 'C5' });
  // added notes keep their staff even when the pitch would suggest otherwise
  expect(notes.find((n) => n.id === 'add2')).toMatchObject({ staff: 'bass', name: 'D4' });
  expect(r.diagnostics.droppedEdits).toBe(0);
  expect(checkModel(r.model)).toEqual([]);
  expect(r.mei).toContain('xml:id="add1"');
}

describe('edits', () => {
  test('applied on top of the quantized layer', () => {
    expectEditsApplied(build(CHORALE, {}, log));
  });

  test('survive a grid change (eighth → sixteenth)', () => {
    expectEditsApplied(build(CHORALE, { grid: 'sixteenth' }, log));
  });

  test('survive a time signature change (4/4 → 3/4)', () => {
    const r = build(CHORALE, { timeSig: '3/4' }, log);
    expectEditsApplied(r);
    expect(r.model.beatsPerBar).toBe(3);
  });

  test('length edit longer than the gap is cut in notation, kept in the model', () => {
    const r = build(CHORALE, {}, log);
    const ev = r.model.measures[1]!.staves[0].events.find((e) => e.notes.some((h) => h.noteId === n5.id))!;
    expect(ev.beats).toBe(1); // next melody note starts one beat later
  });

  test('undo / redo', () => {
    expect(canUndo(log)).toBe(true);
    expect(canRedo(log)).toBe(false);
    const u = undo(undo(log));
    expect(u.head).toBe(3);
    expect(canRedo(u)).toBe(true);
    const r = build(CHORALE, {}, u);
    expect(r.model.notes.find((n) => n.id === 'add1')).toBeUndefined();
    expect(r.model.notes.find((n) => n.id === n9.id)).toBeUndefined();
    const rr = redo(u);
    expect(rr.head).toBe(4);
    expect(build(CHORALE, {}, rr).model.notes.find((n) => n.id === 'add1')).toBeDefined();
    // a new op after undo drops the redo tail
    const branched = pushEdit(u, { t: 'delete', noteId: n5.id });
    expect(branched.ops.length).toBe(4);
    expect(branched.head).toBe(4);
    expect(canRedo(branched)).toBe(false);
    // helpers are pure
    expect(log.head).toBe(5);
    expect(undo(emptyLog())).toEqual(emptyLog());
  });

  test('ops on notes that no longer exist are counted, not thrown', () => {
    const raw = makeRaw(CHORALE);
    const first = raw.notes[0]!;
    // a near-duplicate that the quantizer merges into `first`
    const dup = { ...first, id: 'dup', onset: first.onset + 0.012 };
    const l = [
      { t: 'pitch', noteId: 'dup', pitch: 70 },
      { t: 'length', noteId: 'nope', beats: 1 },
      { t: 'delete', noteId: n0.id },
      { t: 'pitch', noteId: n0.id, pitch: 60 }, // deleted just before
      { t: 'addRest', id: 'rest1', beat: 0, beats: 1, staff: 'treble' },
    ].reduce<EditLog>((acc, op) => pushEdit(acc, op as EditOp), emptyLog());
    const r = buildScore({ notes: [...raw.notes, dup], pedal: [] }, { timeSig: '4/4', grid: 'eighth', triplets: false }, l);
    expect(r.diagnostics.droppedEdits).toBe(3);
    expect(r.model.rests).toEqual([{ id: 'rest1', beat: 0, beats: 1, staff: 'treble' }]);
    // explicit rest fills the deleted note's place and keeps its id
    const ev = r.model.measures[0]!.staves[0].events;
    expect(ev.find((e) => e.xmlId === 'rest1')).toMatchObject({ kind: 'rest', offset: 0, beats: 1 });
    expect(checkModel(r.model)).toEqual([]);
  });

  test('applyEditLog is pure and respects head', () => {
    const notes = [{ id: 'a', pitch: 60, beat: 0, beats: 1, velocity: 64 }];
    const l = pushEdit(emptyLog(), { t: 'pitch', noteId: 'a', pitch: 62 });
    expect(applyEditLog(notes, l).notes[0]!.pitch).toBe(62);
    expect(applyEditLog(notes, undo(l)).notes[0]!.pitch).toBe(60);
    expect(notes[0]!.pitch).toBe(60);
  });
});
