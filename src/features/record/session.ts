import * as Audio from '@modules/aria-audio';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';
import * as Transcriber from '@modules/aria-transcriber';

import { useLibrary } from '@/data/store';
import type { Project } from '@/data/types';
import { formatTakeStamp } from '@/lib/format';

import { takeFiles } from './takeFiles';

/**
 * Record → notes orchestration (ARCHITECTURE §2.1). Lives outside screens so the Turning-it-into-notes
 * screen can be left while the job keeps running; the store carries status + progress for every card.
 */

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** Naming rule (handoff §3.4): `<song title | idea name> — <date> · <time>`. */
export const takeName = (base: string, at = Date.now()) => `${base} — ${formatTakeStamp(at)}`;

export async function beginTake(opts: {
  kind: Project['kind'];
  base: string;
  songId?: string;
  countInBpm?: number;
}): Promise<Project> {
  const now = Date.now();
  const project: Project = {
    id: newId(),
    kind: opts.kind,
    songId: opts.songId,
    name: takeName(opts.base, now),
    createdAt: now,
    updatedAt: now,
    durationSec: 0,
    transcriptionStatus: 'none',
    hasEdits: false,
  };
  const dir = await takeFiles.create(project);
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  await Audio.startRecording({
    projectDir: dir,
    sampleRate: 48000,
    ...(opts.countInBpm ? { countIn: { bpm: opts.countInBpm, beats: 4, clickOnlyInHeadphones: true } } : null),
  });
  pending = { project, dir };
  return project;
}

let pending: { project: Project; dir: string } | null = null;

/** Stops the recorder, saves the take and starts turning it into notes. */
export async function finishTake(): Promise<Project> {
  const result = await Audio.stopRecording();
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  if (!pending) throw new Error('No take in progress');
  const project: Project = { ...pending.project, durationSec: result.durationSec, transcriptionStatus: 'queued' };
  pending = null;
  // The audio is on disk now. Nothing after this point may lose the take or strand the user on the
  // recording screen: failures only mark the take, which the Transcribing screen then explains.
  await takeFiles.saveManifest(project, result).catch((e) => console.warn('[record] manifest save failed', e));
  useLibrary.getState().addProject(project);
  try {
    await startTranscription(project, result.file, result.countInEndSec);
  } catch (e) {
    console.warn('[record] transcription did not start', e);
    useLibrary.getState().updateProject(project.id, { transcriptionStatus: 'failed', transcriptionProgress: 0 });
  }
  return project;
}

/** False in builds that don't ship the transcription model yet (the take still records and plays). */
export const canTranscribe = () => !Transcriber.isNative || Transcriber.modelInfo.available;

export async function discardTake() {
  pending = null;
  await Audio.discardRecording().catch(() => {});
}

// ── Transcription jobs ────────────────────────────────────────────────────────────

const jobs = new Map<string, { projectId: string; outPath: string }>();
const byProject = new Map<string, string>();
let wired = false;

function wire() {
  if (wired) return;
  wired = true;
  const { updateProject } = useLibrary.getState();
  Transcriber.addListener('progress', ({ jobId, fraction }) => {
    const j = jobs.get(jobId);
    if (j) updateProject(j.projectId, { transcriptionStatus: 'running', transcriptionProgress: fraction });
  });
  Transcriber.addListener('done', ({ jobId }) => {
    const j = jobs.get(jobId);
    if (!j) return;
    updateProject(j.projectId, { transcriptionStatus: 'done', transcriptionProgress: 1 });
    takeFiles.rememberNotes(j.projectId, j.outPath);
    notifyNotesReady(j.projectId);
  });
  Transcriber.addListener('error', ({ jobId, code }) => {
    const j = jobs.get(jobId);
    if (!j) return;
    updateProject(j.projectId, { transcriptionStatus: code === 'cancelled' ? 'none' : 'failed', transcriptionProgress: 0 });
  });
}

export async function startTranscription(project: Project, audioFile: string, countInEndSec = 0) {
  wire();
  ensureNotificationPermission().catch(() => {});
  const outPath = takeFiles.rawNotesPath(project.id);
  useLibrary.getState().updateProject(project.id, { transcriptionStatus: 'queued', transcriptionProgress: 0 });
  const { jobId } = await Transcriber.transcribe(audioFile, { startAtSec: countInEndSec, outPath });
  jobs.set(jobId, { projectId: project.id, outPath });
  byProject.set(project.id, jobId);
}

export function cancelTranscription(projectId: string) {
  const jobId = byProject.get(projectId);
  if (jobId) Transcriber.cancel(jobId);
}

/** FR-5: import an audio file (Files / share sheet) as a take and transcribe it. */
export async function importTake(opts: { kind: Project['kind']; base: string; songId?: string; uri: string }) {
  const now = Date.now();
  const draft: Project = {
    id: newId(),
    kind: opts.kind,
    songId: opts.songId,
    name: takeName(opts.base, now),
    createdAt: now,
    updatedAt: now,
    durationSec: 0,
    transcriptionStatus: 'queued',
    hasEdits: false,
  };
  const dir = await takeFiles.create(draft);
  const { file, durationSec } = await Audio.importAudio(opts.uri, dir);
  const project = { ...draft, durationSec };
  await takeFiles.saveManifest(project, { file, durationSec, countInEndSec: 0, sampleRate: 48000, interrupted: false }, 'import');
  useLibrary.getState().addProject(project);
  await startTranscription(project, file, 0);
  return project;
}

/**
 * On launch (NFR-8): finalize takes a crash left mid-recording, then restart transcriptions that were
 * running when the app died — the transcriber resumes from its per-chunk checkpoint.
 */
export async function recoverAfterLaunch() {
  await takeFiles.recover().catch((e) => console.warn('[record] recovery failed', e));
  const { projects, updateProject } = useLibrary.getState();
  for (const p of projects) {
    if (p.transcriptionStatus === 'done' || byProject.has(p.id)) continue;
    // The notes file is only written when a transcription finishes, so its presence means "done" even if
    // the status write was lost (an older build could overwrite it, or the app was killed right after).
    const notes = await takeFiles.readRawNotes(p.id).catch(() => null);
    if (notes) {
      updateProject(p.id, { transcriptionStatus: 'done', transcriptionProgress: 1 });
      continue;
    }
    if (p.transcriptionStatus === 'running' || p.transcriptionStatus === 'queued') {
      startTranscription(p, takeFiles.audioUri(p.id)).catch(() =>
        useLibrary.getState().updateProject(p.id, { transcriptionStatus: 'failed' }),
      );
    }
  }
}

/** "Your notes are ready" — only when the user left the app while it worked (handoff §3.4 step 6). */
function notifyNotesReady(projectId: string) {
  if (Platform.OS === 'web' || AppState.currentState === 'active') return;
  const project = useLibrary.getState().projects.find((p) => p.id === projectId);
  Notifications.scheduleNotificationAsync({
    content: {
      title: 'Your notes are ready',
      body: project ? `${project.name.split(' — ')[0]} is written down. Tap to see it.` : 'Tap to see them.',
      data: { url: `/record/${projectId}` },
    },
    trigger: null,
  }).catch(() => {});
}

/** Ask once, at the first transcription — never during onboarding. */
export async function ensureNotificationPermission() {
  if (Platform.OS === 'web') return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'undetermined') await Notifications.requestPermissionsAsync().catch(() => {});
}
