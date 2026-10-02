import type { RawNotes, ScoreSettings } from '@aria/score-engine';

import { loadCuratedScore } from '@/data/curated';
import { useLibrary } from '@/data/store';

import { takeFiles } from '../record/takeFiles';

import { demoRawNotes } from './demoNotes';

export interface LoadedNotes {
  notes: RawNotes;
  /** How the source should be written (curated scores); recordings use the take's own settings. */
  settings?: ScoreSettings;
  attribution?: string;
}

/**
 * Notes for a source id: `score:<songId>` (the song's curated public-domain score) or a project id.
 * Demo projects (web preview) use generated notes.
 */
export async function loadProjectNotes(id: string): Promise<LoadedNotes | null> {
  if (id.startsWith('score:')) {
    const songId = id.slice('score:'.length);
    const catalogId = useLibrary.getState().songs.find((s) => s.id === songId)?.catalogId;
    const curated = catalogId ? loadCuratedScore(catalogId) : null;
    return curated ? { notes: curated.raw, settings: curated.settings, attribution: curated.attribution } : null;
  }
  if (id.startsWith('p-')) return { notes: demoRawNotes(hash(id), 16, 72) };
  const notes = await takeFiles.readRawNotes(id);
  return notes ? { notes } : null;
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h % 97) + 1;
}
