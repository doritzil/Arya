import { buildScore, type RawNotes } from '../src';
import { meterInfo } from '../src/meter';

describe('metres for curated scores', () => {
  it('treats x/8 metres divisible by three as compound, with a dotted-quarter beat', () => {
    for (const [sig, bar, units] of [
      ['3/8', 1.5, 1],
      ['6/8', 3, 2],
      ['9/8', 4.5, 3],
      ['12/8', 6, 4],
    ] as const) {
      const m = meterInfo(sig);
      expect([m.compound, m.unitQ, m.beatsPerBar, m.unitsPerBar]).toEqual([true, 1.5, bar, units]);
    }
    expect(meterInfo('2/2')).toMatchObject({ compound: false, beatsPerBar: 4 });
  });

  it('exactTempoBpm puts bar lines on a rigid grid from t = 0 and keeps given staves', () => {
    // 3/4 at 120: one beat = 0.5 s. A pickup-free bass note on each downbeat, a treble note on beat 2.
    const raw: RawNotes = {
      notes: [0, 1, 2, 3].flatMap((bar) => [
        { id: `b${bar}`, pitch: 72, onset: bar * 1.5, offset: bar * 1.5 + 0.45, velocity: 80, staff: 'bass' as const },
        { id: `t${bar}`, pitch: 48, onset: bar * 1.5 + 0.5, offset: bar * 1.5 + 0.95, velocity: 80, staff: 'treble' as const },
      ]),
      pedal: [],
      exactTempoBpm: 120,
    };
    const { model } = buildScore(raw, { timeSig: '3/4', grid: 'sixteenth', triplets: false });
    expect(model.settings.tempoBpm).toBe(120);
    expect(model.barCount).toBe(4);
    const b = model.notes.filter((n) => n.id.startsWith('b'));
    expect(b.map((n) => n.beat)).toEqual([0, 3, 6, 9]);
    // staves come from the input, even where pitch alone would put them the other way round
    expect(b.every((n) => n.staff === 'bass')).toBe(true);
    expect(model.notes.filter((n) => n.id.startsWith('t')).every((n) => n.staff === 'treble')).toBe(true);
  });
});
