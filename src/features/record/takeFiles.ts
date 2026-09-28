import type { EditLog, ScoreSettings } from '@aria/score-engine';
import type { RecordingResult } from '@modules/aria-audio';
import { getMockOutput, type RawNotes } from '@modules/aria-transcriber';

import type { Project } from '@/data/types';

import { PROJECTS_DIR } from '../notes/paths';

/**
 * Where a take's files live. Resolved by TypeScript/Jest and the web preview (no file system: virtual
 * paths, notes kept in memory from the transcriber mock). Native uses takeFiles.native.ts (project folders).
 */
const notes = new Map<string, string>();

export const takeFiles = {
  async create(project: Project): Promise<string> {
    return `${PROJECTS_DIR}/${project.id}`;
  },
  async saveManifest(_project: Project, _result: RecordingResult, _source: 'mic' | 'import' = 'mic'): Promise<void> {},
  rawNotesPath: (projectId: string) => `${PROJECTS_DIR}/${projectId}/notes.raw.json`,
  rememberNotes(projectId: string, outPath: string) {
    notes.set(projectId, outPath);
  },
  async readRawNotes(projectId: string): Promise<RawNotes | null> {
    const out = notes.get(projectId);
    return out ? (getMockOutput(out) ?? null) : null;
  },
  audioUri: (projectId: string) => `${PROJECTS_DIR}/${projectId}/audio.m4a`,
  async loadScoreState(_projectId: string): Promise<{ settings: ScoreSettings; edits: EditLog } | null> {
    return null;
  },
  async saveScoreState(_projectId: string, _settings: ScoreSettings, _edits: EditLog): Promise<void> {},
  async recover(): Promise<void> {},
};
