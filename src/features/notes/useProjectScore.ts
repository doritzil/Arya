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

import { loadProjectNotes } from './loadNotes';

export const DEFAULT_SCORE_SETTINGS: ScoreSettings = { timeSig: '4/4', grid: 'eighth', triplets: false };

export interface ProjectScore {
  raw: RawNotes;
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
  const [raw, setRaw] = useState<{ id: string; notes: RawNotes } | null>(null);
  useEffect(() => {
    if (!sourceId) return;
    let alive = true;
    loadProjectNotes(sourceId)
      .then((notes) => alive && notes && setRaw({ id: sourceId, notes }))
      .catch((e) => console.warn('[notes] load failed', e));
    return () => {
      alive = false;
    };
  }, [sourceId]);
  return useMemo(
    () => (raw && raw.id === sourceId ? deriveScore(raw.notes, settings, edits) : null),
    [raw, sourceId, settings, edits],
  );
}
