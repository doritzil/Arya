import {
  buildScore,
  toFallNotes,
  type BuildResult,
  type EditLog,
  type FallNote,
  type RawNotes,
  type ScoreSettings,
} from '@aria/score-engine';
import { useEffect, useMemo, useState } from 'react';

import type { SynthNote } from '@modules/aria-audio';

import { loadProjectNotes, type LoadedNotes } from './loadNotes';

export const DEFAULT_SCORE_SETTINGS: ScoreSettings = { timeSig: '4/4', grid: 'eighth', triplets: false };

export interface ProjectScore {
  raw: RawNotes;
  /** Source credit for curated scores. */
  attribution?: string;
  build: BuildResult;
  fallNotes: FallNote[];
  synthNotes: SynthNote[];
  durationSec: number;
}

/** Pure: raw notes + settings + edits → score, falling notes (Keyboard mode) and synth notes (FR-15). */
export function deriveScore(raw: RawNotes, settings: ScoreSettings, edits?: EditLog): ProjectScore {
  const build = buildScore(raw, settings, edits);
  const fallNotes = toFallNotes(build.model, build.beatMap);
  const synthNotes = fallNotes.map((n) => ({ pitch: n.pitch, startSec: n.startSec, endSec: n.endSec, velocity: 80 }));
  const durationSec = fallNotes.reduce((m, n) => Math.max(m, n.endSec), 0) + 1;
  return { raw, build, fallNotes, synthNotes, durationSec };
}

/** Loads a take's (or a curated score's) notes and derives the score. `undefined` id → nothing loaded. */
export function useProjectScore(
  sourceId: string | undefined,
  settings: ScoreSettings = DEFAULT_SCORE_SETTINGS,
  edits?: EditLog,
): ProjectScore | null {
  const [loaded, setLoaded] = useState<{ id: string; data: LoadedNotes } | null>(null);
  useEffect(() => {
    if (!sourceId) return;
    let alive = true;
    loadProjectNotes(sourceId)
      .then((data) => alive && data && setLoaded({ id: sourceId, data }))
      .catch((e) => console.warn('[notes] load failed', e));
    return () => {
      alive = false;
    };
  }, [sourceId]);
  return useMemo(() => {
    if (!loaded || loaded.id !== sourceId) return null;
    // Curated scores come with their own metre, key and tempo.
    const s = deriveScore(loaded.data.notes, loaded.data.settings ?? settings, edits);
    return loaded.data.attribution ? { ...s, attribution: loaded.data.attribution } : s;
  }, [loaded, sourceId, settings, edits]);
}
