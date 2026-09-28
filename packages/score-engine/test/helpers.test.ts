import { keyLabel, spellPitch, spelledToMidi, stepPitchInKey, summaryLabel, toFallNotes } from '../src';
import { CHORALE, DFLAT, SIX_EIGHT, TRIPLETS, build } from './fixtures';

describe('toFallNotes', () => {
  const r = build(DFLAT);
  const fall = toFallNotes(r.model, r.beatMap);

  test('one per note, hands from staves, sorted', () => {
    expect(fall.length).toBe(r.model.notes.length);
    for (let i = 1; i < fall.length; i++) expect(fall[i]!.startSec).toBeGreaterThanOrEqual(fall[i - 1]!.startSec);
    for (const f of fall) {
      const n = r.model.notes.find((x) => x.id === f.id)!;
      expect(f.hand).toBe(n.staff === 'treble' ? 'R' : 'L');
      expect(f.name).toBe(n.name);
      expect(f.bar).toBe(Math.floor(n.beat / 4) + 1);
      expect(f.startSec).toBeCloseTo(r.beatMap.beatToSec(n.beat), 9);
      expect(f.endSec).toBeCloseTo(r.beatMap.beatToSec(n.beat + n.beats), 9);
    }
  });

  test('times line up with the recording', () => {
    const first = fall[0]!;
    expect(first.startSec).toBeGreaterThan(0.4);
    expect(first.startSec).toBeLessThan(0.6); // fixtures start at 0.5 s
    const last = fall[fall.length - 1]!;
    expect(last.startSec).toBeCloseTo(0.5 + (30 * 60) / 90, 1); // LH Db2+Ab2 on beat 30
    expect(last.bar).toBe(8);
  });
});

describe('labels', () => {
  test('keyLabel', () => {
    expect(keyLabel(-5, 'major')).toBe('D♭ major · 5 flats');
    expect(keyLabel(0, 'major')).toBe('C major · no sharps or flats');
    expect(keyLabel(0, 'minor')).toBe('A minor · no sharps or flats');
    expect(keyLabel(1, 'major')).toBe('G major · 1 sharp');
    expect(keyLabel(-1, 'minor')).toBe('D minor · 1 flat');
    expect(keyLabel(-3, 'minor')).toBe('C minor · 3 flats');
    expect(keyLabel(6, 'major')).toBe('F♯ major · 6 sharps');
    expect(keyLabel(4, 'minor')).toBe('C♯ minor · 4 sharps');
  });

  test('summaryLabel', () => {
    expect(summaryLabel(build(DFLAT).model)).toBe('♩ 90 · 4/4 · D♭ major · eighths');
    expect(summaryLabel(build(CHORALE, { grid: 'sixteenth' }).model)).toBe('♩ 72 · 4/4 · C major · sixteenths');
    expect(summaryLabel(build(TRIPLETS, { triplets: true }).model)).toBe('♩ 80 · 4/4 · C major · eighths + triplets');
    expect(summaryLabel(build(SIX_EIGHT, { timeSig: '6/8' }).model)).toBe('♩. 60 · 6/8 · F major · eighths');
  });
});

describe('stepPitchInKey', () => {
  test('C major', () => {
    expect(stepPitchInKey(64, 1, 0, 'major')).toBe(65); // E → F
    expect(stepPitchInKey(65, 1, 0, 'major')).toBe(67); // F → G
    expect(stepPitchInKey(60, -1, 0, 'major')).toBe(59); // C → B
    expect(stepPitchInKey(61, 1, 0, 'major')).toBe(62); // C# → D
    expect(stepPitchInKey(61, -1, 0, 'major')).toBe(60);
  });
  test('D♭ major and range limits', () => {
    expect(stepPitchInKey(61, 1, -5, 'major')).toBe(63); // Db → Eb
    expect(stepPitchInKey(60, -1, -5, 'major')).toBe(58); // C → Bb
    expect(stepPitchInKey(108, 1, 0, 'major')).toBe(108);
    expect(stepPitchInKey(21, -1, 0, 'major')).toBe(21);
  });
  test('minor uses the signature scale', () => {
    expect(stepPitchInKey(67, 1, 0, 'minor')).toBe(69); // G → A in A minor
  });
});

describe('spelling', () => {
  const name = (p: number, k: number, m: 'major' | 'minor', next?: number) => {
    const s = spellPitch(p, k, m, next);
    expect(spelledToMidi(s)).toBe(p);
    return `${s.step}${s.alter > 0 ? '#'.repeat(s.alter) : 'b'.repeat(-s.alter)}${s.octave}`;
  };
  test('diatonic and chromatic', () => {
    expect(name(66, 0, 'major')).toBe('F#4');
    expect(name(70, 0, 'major')).toBe('Bb4');
    expect(name(63, 0, 'major')).toBe('Eb4');
    expect(name(63, 0, 'major', 64)).toBe('D#4'); // leads up to E
    expect(name(68, 0, 'major', 67)).toBe('Ab4'); // leads down to G
    expect(name(71, -6, 'major')).toBe('Cb5'); // in G♭ major
    expect(name(64, -5, 'major')).toBe('E4'); // not Fb in D♭
    expect(name(59, 0, 'major')).toBe('B3');
    expect(name(68, 0, 'minor')).toBe('G#4');
    expect(name(66, 0, 'minor')).toBe('F#4');
    expect(name(61, 2, 'major')).toBe('C#4');
    expect(name(65, 5, 'major')).toBe('E#4'); // chromatic in a sharp key leans sharp
  });
});
