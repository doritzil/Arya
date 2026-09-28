import type { RawNotes } from '@aria/score-engine';

/**
 * A short, humanised D♭-major piece (left-hand bass + broken chords, right-hand melody) standing in for
 * transcriptions in the web preview and for curated scores until the MIDI files ship. Deterministic.
 */
export function demoRawNotes(seed = 1, bars = 16, bpm = 72): RawNotes {
  let s = seed * 7919 + 1;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647) - 0.5;
  const beat = 60 / bpm;
  // D♭ – B♭m – G♭ – A♭ (I–vi–IV–V), bass notes and chord tones as MIDI pitches.
  const prog = [
    { bass: 37, chord: [49, 53, 56], mel: [68, 70, 68, 65] },
    { bass: 34, chord: [46, 49, 53], mel: [65, 66, 65, 61] },
    { bass: 42, chord: [54, 58, 61], mel: [66, 68, 70, 73] },
    { bass: 44, chord: [56, 60, 63], mel: [72, 70, 68, 67] },
  ];
  const notes: RawNotes['notes'] = [];
  const add = (pitch: number, onsetBeats: number, lenBeats: number, vel: number) => {
    const onset = Math.max(0, onsetBeats * beat + rnd() * 0.03);
    notes.push({
      id: `n${notes.length}`,
      pitch,
      onset,
      offset: onset + lenBeats * beat * (0.92 + rnd() * 0.06),
      velocity: Math.round(vel + rnd() * 14),
    });
  };
  for (let bar = 0; bar < bars; bar++) {
    const c = prog[bar % prog.length]!;
    const t = bar * 4;
    add(c.bass, t, 2, 62);
    add(c.bass + 12, t + 2, 2, 56);
    c.chord.forEach((p, i) => add(p, t + 0.5 + i * 0.5, 0.5, 48));
    c.chord.forEach((p, i) => add(p, t + 2.5 + i * 0.5, 0.5, 46));
    const phrase = bar % 2 === 0 ? [0, 1, 2, 3] : [0, 2];
    phrase.forEach((b, i) => add(c.mel[i % c.mel.length]!, t + b * (4 / phrase.length), 4 / phrase.length, 78));
  }
  notes.sort((a, b) => a.onset - b.onset || a.pitch - b.pitch);
  const pedal = Array.from({ length: bars * 2 }, (_, i) => ({ on: i * 2 * beat + 0.05, off: (i + 1) * 2 * beat - 0.05 }));
  return { notes, pedal };
}
