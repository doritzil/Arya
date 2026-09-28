import type { PedalSpan, RawNote, RawNotes } from './AriaTranscriber.types';

/**
 * An 8-bar C-major piece at 96 BPM in 4/4, played slightly unevenly (as a phone recording would be):
 * right-hand melody in quarters/eighths over a left-hand bass + broken chord, pedal changed every bar.
 * Progression: C – G – Am – F – C – F – G – C. Deterministic, so tests and screenshots are stable.
 */
export function demoRawNotes(startAtSec = 0): RawNotes {
  const bpm = 96;
  const beat = 60 / bpm;
  const bar = beat * 4;
  const t0 = startAtSec + 0.35; // player starts a moment after the count-in

  // Deterministic "humanisation"
  let seed = 7;
  const jitter = (amount: number) => {
    seed = (seed * 16807) % 2147483647;
    return ((seed / 2147483647) * 2 - 1) * amount;
  };

  // [bass root, chord tones for LH broken chord]
  const chords: [number, number[]][] = [
    [48, [55, 60, 64]], // C
    [43, [50, 55, 59]], // G
    [45, [52, 57, 60]], // Am
    [41, [48, 53, 57]], // F
    [48, [55, 60, 64]], // C
    [41, [48, 53, 57]], // F
    [43, [50, 55, 59]], // G
    [48, [55, 60, 64]], // C
  ];

  // Melody per bar: [pitch, beats][]
  const melody: [number, number][][] = [
    [[64, 1], [67, 1], [72, 1], [71, 0.5], [72, 0.5]],
    [[74, 1.5], [71, 0.5], [67, 2]],
    [[69, 1], [72, 1], [76, 1], [74, 0.5], [72, 0.5]],
    [[72, 1], [69, 1], [65, 2]],
    [[67, 0.5], [69, 0.5], [71, 0.5], [72, 0.5], [76, 1], [74, 1]],
    [[72, 1], [77, 1], [76, 1], [74, 1]],
    [[74, 1], [71, 1], [67, 1], [71, 1]],
    [[72, 3], [67, 0.5], [72, 0.5]],
  ];

  const notes: Omit<RawNote, 'id'>[] = [];
  const pedal: PedalSpan[] = [];

  chords.forEach(([root, tones], b) => {
    const barStart = t0 + b * bar;
    // LH: bass on 1, broken chord on the off-beats 2, 3, 4
    notes.push({
      pitch: root,
      onset: barStart + jitter(0.015),
      offset: barStart + beat * 2 - 0.05 + jitter(0.03),
      velocity: 62 + Math.round(jitter(6)),
    });
    tones.forEach((p, i) => {
      const on = barStart + beat * (i + 1) + jitter(0.02);
      notes.push({ pitch: p, onset: on, offset: on + beat * 0.9 + jitter(0.03), velocity: 50 + Math.round(jitter(6)) });
    });
    // RH melody
    let pos = 0;
    for (const [pitch, beats] of melody[b] ?? []) {
      const on = barStart + pos * beat + jitter(0.018);
      const legato = beats >= 2 ? 0.92 : 0.85;
      notes.push({
        pitch,
        onset: on,
        offset: on + beats * beat * legato + jitter(0.02),
        velocity: Math.max(1, Math.min(127, 78 + (pos === 0 ? 8 : 0) + Math.round(jitter(8)))),
      });
      pos += beats;
    }
    // Pedal down just after the downbeat, up just before the next bar
    pedal.push({ on: barStart + 0.06 + jitter(0.02), off: barStart + bar - 0.08 + jitter(0.02) });
  });

  const round = (x: number) => Math.round(x * 1000) / 1000;
  const sorted = notes
    .sort((a, b) => a.onset - b.onset || a.pitch - b.pitch)
    .map((n, i) => ({ id: `n${i + 1}`, pitch: n.pitch, onset: round(n.onset), offset: round(n.offset), velocity: n.velocity }));

  return {
    notes: sorted,
    pedal: pedal.map((p) => ({ on: round(p.on), off: round(p.off) })),
    frameRate: 100,
    modelId: 'mock',
    modelVersion: '0',
  };
}
