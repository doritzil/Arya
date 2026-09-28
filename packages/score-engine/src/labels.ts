import type { Grid, KeyMode, ScoreModel } from './types';
import { fifthsToSpelling } from './spell';

/** "D♭" etc. for the tonic of a key signature + mode. */
export function tonicName(fifths: number, mode: KeyMode): string {
  const { step, alter } = fifthsToSpelling(fifths + (mode === 'minor' ? 3 : 0));
  return step + (alter > 0 ? '♯'.repeat(alter) : '♭'.repeat(-alter));
}

/** "D♭ major · 5 flats", "A minor · no sharps or flats", "G major · 1 sharp". */
export function keyLabel(fifths: number, mode: KeyMode): string {
  const n = Math.abs(fifths);
  const acc = n === 0 ? 'no sharps or flats' : `${n} ${fifths > 0 ? 'sharp' : 'flat'}${n === 1 ? '' : 's'}`;
  return `${tonicName(fifths, mode)} ${mode} · ${acc}`;
}

const GRID_LABEL: Record<Grid, string> = { quarter: 'quarters', eighth: 'eighths', sixteenth: 'sixteenths' };

/** "♩ 80 · 4/4 · D♭ major · eighths". In 6/8 the tempo is shown per dotted quarter ("♩. 60"). */
export function summaryLabel(model: ScoreModel): string {
  const s = model.settings;
  const tempo = s.timeSig === '6/8' ? `♩. ${Math.round(s.tempoBpm / 1.5)}` : `♩ ${Math.round(s.tempoBpm)}`;
  const grid = GRID_LABEL[s.grid] + (s.triplets ? ' + triplets' : '');
  return `${tempo} · ${s.timeSig} · ${tonicName(s.keyFifths, s.keyMode)} ${s.keyMode} · ${grid}`;
}
