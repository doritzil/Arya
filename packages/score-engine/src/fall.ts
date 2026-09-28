import type { BeatMap, FallNote, ScoreModel } from './types';

/** Keyboard-mode notes: treble → right hand, bass → left hand, times through the beat map. */
export function toFallNotes(model: ScoreModel, beatMap: BeatMap): FallNote[] {
  const out: FallNote[] = model.notes.map((n) => ({
    id: n.id,
    pitch: n.pitch,
    startSec: beatMap.beatToSec(n.beat),
    endSec: beatMap.beatToSec(n.beat + n.beats),
    hand: n.staff === 'treble' ? 'R' : 'L',
    bar: Math.floor(n.beat / model.beatsPerBar + 1e-9) + 1,
    name: n.name,
  }));
  out.sort((a, b) => a.startSec - b.startSec || a.pitch - b.pitch);
  return out;
}
