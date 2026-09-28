import { getPeaks, recoverOrphanedRecordings, type RecordingResult } from '@modules/aria-audio';
import type { RawNotes } from '@modules/aria-transcriber';
import type { EditLog, ScoreSettings } from '@aria/score-engine';

import {
  FILES,
  audioFile,
  projectFile,
  projectsRoot,
  projectDirUri,
  readEdits,
  readManifest,
  readRawNotes,
  syncProjectToFolder,
  updateManifest,
  writeEdits,
  writeWaveform,
  type ManifestScoreSettings,
} from '@/data/projectStore';
import type { Project } from '@/data/types';

/** Native take storage: one folder per take under Documents/Projects (ARCHITECTURE §5.2). */
const GRID_TO_MANIFEST = { quarter: 4, eighth: 8, sixteenth: 16 } as const;
const GRID_FROM_MANIFEST = { 4: 'quarter', 8: 'eighth', 16: 'sixteenth' } as const;

const basename = (uri: string) => uri.split('/').pop() ?? FILES.audioM4a;

export const takeFiles = {
  async create(project: Project): Promise<string> {
    await syncProjectToFolder(project);
    return projectDirUri(project.id);
  },

  async saveManifest(project: Project, result: RecordingResult, source: 'mic' | 'import' = 'mic'): Promise<void> {
    await updateManifest(project.id, (m) => ({
      ...m,
      audio: {
        file: basename(result.file),
        sampleRate: result.sampleRate,
        durationSec: result.durationSec,
        countInEndSec: result.countInEndSec,
        source,
        ...(result.interrupted ? { interrupted: true } : null),
      },
      transcription: { status: 'queued' },
    }));
    // Waveform peaks for the player (best effort — never blocks the take).
    getPeaks(result.file, 2000)
      .then((peaks) => writeWaveform(project.id, peaks))
      .catch(() => {});
  },

  rawNotesPath: (projectId: string) => projectFile(projectId, FILES.rawNotes).uri,

  rememberNotes(_projectId: string, _outPath: string) {
    // The transcriber wrote notes.raw.json into the project folder; nothing to keep in memory.
  },

  readRawNotes: (projectId: string): Promise<RawNotes | null> => readRawNotes(projectId),

  audioUri: (projectId: string) => audioFile(projectId)?.uri ?? projectFile(projectId, FILES.audioM4a).uri,

  async loadScoreState(projectId: string): Promise<{ settings: ScoreSettings; edits: EditLog } | null> {
    const m = await readManifest(projectId);
    if (!m) return null;
    const s = m.scoreSettings;
    return {
      settings: {
        timeSig: s.timeSig,
        grid: GRID_FROM_MANIFEST[s.grid],
        triplets: s.triplets,
        ...(s.tempoBpm ? { tempoBpm: s.tempoBpm } : null),
        ...(s.keyFifths !== undefined ? { keyFifths: s.keyFifths, keyMode: s.keyMode ?? 'major' } : null),
      },
      edits: await readEdits(projectId),
    };
  },

  async saveScoreState(projectId: string, settings: ScoreSettings, edits: EditLog): Promise<void> {
    const scoreSettings: ManifestScoreSettings = {
      timeSig: settings.timeSig,
      grid: GRID_TO_MANIFEST[settings.grid],
      triplets: settings.triplets,
      ...(settings.tempoBpm ? { tempoBpm: settings.tempoBpm } : null),
      ...(settings.keyFifths !== undefined ? { keyFifths: settings.keyFifths, keyMode: settings.keyMode } : null),
    };
    await updateManifest(projectId, (m) => ({ ...m, scoreSettings, hasEdits: edits.head > 0 }));
    await writeEdits(projectId, edits);
  },

  /** On launch: finalize takes a crash left as audio.caf (NFR-8). */
  async recover(): Promise<void> {
    await recoverOrphanedRecordings(projectsRoot().uri);
  },
};
