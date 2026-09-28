import type { RawNote } from '../src';
import { buildScore, toFallNotes, toMIDI, toMusicXML } from '../src';
import { mulberry32 } from './fixtures';

/** ~10 minutes of dense two-hand texture at 100 bpm: 1000 beats, 6 notes per beat. */
function denseRaw(): { notes: RawNote[]; pedal: { on: number; off: number }[] } {
  const rnd = mulberry32(42);
  const spb = 0.6;
  const notes: RawNote[] = [];
  const pedal: { on: number; off: number }[] = [];
  const j = () => (rnd() * 2 - 1) * 0.02;
  const scale = [0, 2, 4, 5, 7, 9, 11];
  let id = 0;
  for (let b = 0; b < 1000; b++) {
    const t = 0.5 + b * spb;
    const root = 36 + scale[(b >> 2) % 7]!;
    // LH: bass + fifth on the beat
    notes.push({ id: `p${id++}`, pitch: root, onset: t + j(), offset: t + spb * 0.9, velocity: 70 });
    notes.push({ id: `p${id++}`, pitch: root + 7, onset: t + j(), offset: t + spb * 0.9, velocity: 60 });
    // RH: two eighths + a two-note chord
    for (let e = 0; e < 2; e++) {
      const tt = t + e * spb * 0.5;
      const p = 72 + scale[(b + e * 3) % 7]!;
      notes.push({ id: `p${id++}`, pitch: p, onset: tt + j(), offset: tt + spb * 0.45, velocity: 64 + Math.round(rnd() * 20) });
    }
    notes.push({ id: `p${id++}`, pitch: 64 + scale[b % 7]!, onset: t + j(), offset: t + spb * 0.9, velocity: 58 });
    notes.push({ id: `p${id++}`, pitch: 67 + scale[b % 7]!, onset: t + j(), offset: t + spb * 0.9, velocity: 58 });
    if (b % 4 === 0) pedal.push({ on: t + 0.05, off: t + 4 * spb - 0.05 });
  }
  return { notes, pedal };
}

test('buildScore on ~6000 notes (10 min) is fast', () => {
  const raw = denseRaw();
  expect(raw.notes.length).toBe(6000);
  const settings = { timeSig: '4/4', grid: 'sixteenth', triplets: true } as const;
  buildScore(raw, settings); // warm-up (JIT)
  const times: number[] = [];
  let r = buildScore(raw, settings);
  for (let i = 0; i < 5; i++) {
    const t0 = Date.now();
    r = buildScore(raw, settings);
    times.push(Date.now() - t0);
  }
  times.sort((a, b) => a - b);
  const t0 = Date.now();
  toMusicXML(r.model);
  toMIDI(r.model, r.beatMap);
  toFallNotes(r.model, r.beatMap);
  const exportMs = Date.now() - t0;
  console.log(
    `perf: 6000 notes → buildScore median ${times[2]} ms (min ${times[0]}, max ${times[4]}); ` +
      `MusicXML+MIDI+fall ${exportMs} ms; tempo ${r.diagnostics.detectedTempoBpm}, bars ${r.model.barCount}`,
  );
  expect(times[2]!).toBeLessThan(300);
  expect(Math.abs(r.diagnostics.detectedTempoBpm - 100)).toBeLessThanOrEqual(3);
  expect(r.model.barCount).toBe(250);
});
