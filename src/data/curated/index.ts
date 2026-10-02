import type { RawNotes, ScoreSettings } from '@aria/score-engine';

/**
 * Curated scores: songs that get a Score tab and Keyboard mode without a recording. Keyed by seed-catalog
 * id; each entry is `() => require('./<catalogId>.json')` so a file loads on first use. Empty for now —
 * add licensed arrangements here (format: CuratedFile).
 */
interface CuratedFile {
  title: string;
  composer: string;
  source: string;
  license: string;
  credit?: string;
  settings: ScoreSettings & { tempoBpm: number };
  /** [pitch, start, length (quarter beats from bar 1), velocity, staff 0 = treble / 1 = bass] */
  notes: [number, number, number, number, 0 | 1][];
}

const FILES: Record<string, () => CuratedFile> = {};

export const hasCuratedScore = (catalogId: string | undefined): catalogId is string => !!catalogId && catalogId in FILES;

export interface CuratedScore {
  raw: RawNotes;
  settings: ScoreSettings;
  /** "Public Domain · Mutopia Project" / "CC BY-SA 3.0 · Typeset by … · Mutopia Project" */
  attribution: string;
}

const cache = new Map<string, CuratedScore>();

export function loadCuratedScore(catalogId: string): CuratedScore | null {
  const hit = cache.get(catalogId);
  if (hit) return hit;
  const load = FILES[catalogId];
  if (!load) return null;
  const f = load();
  const spb = 60 / f.settings.tempoBpm; // seconds per quarter beat
  const raw: RawNotes = {
    notes: f.notes.map(([pitch, start, len, velocity, staff], i) => ({
      id: `c${i + 1}`,
      pitch,
      onset: start * spb,
      offset: (start + len) * spb,
      velocity,
      staff: staff === 0 ? 'treble' : 'bass',
    })),
    pedal: [],
    exactTempoBpm: f.settings.tempoBpm,
  };
  const attribution = [f.license, f.credit, 'Mutopia Project'].filter(Boolean).join(' · ');
  const score = { raw, settings: f.settings, attribution };
  cache.set(catalogId, score);
  return score;
}
