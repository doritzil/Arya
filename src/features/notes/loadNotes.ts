import type { RawNotes } from '@aria/score-engine';

import { takeFiles } from '../record/takeFiles';

import { demoRawNotes } from './demoNotes';

/**
 * Raw notes for a source id: `score:<songId>` (curated public-domain MIDI) or a project id.
 * Demo projects (web preview) and curated scores use generated notes until the curated MIDI files ship.
 */
export async function loadProjectNotes(id: string): Promise<RawNotes | null> {
  if (id.startsWith('score:')) return demoRawNotes(hash(id), 24, 66);
  if (id.startsWith('p-')) return demoRawNotes(hash(id), 16, 72);
  return takeFiles.readRawNotes(id);
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h % 97) + 1;
}
