/**
 * Project folder manifest (ARCHITECTURE.md §5.2) — pure types and (de)serialization, no I/O.
 * I/O lives in projectStore.ts.
 */
import type { Project, TranscriptionStatus } from './types';
import type { TimeSig } from '@aria/score-engine';

export const MANIFEST_SCHEMA = 1 as const;

/**
 * "How it's written" settings persisted per project. Mirrors @aria/score-engine's ScoreSettings
 * (kept structural here so data/ doesn't depend on the engine's internals).
 */
export interface ManifestScoreSettings {
  tempoBpm?: number;
  timeSig: TimeSig;
  keyFifths?: number;
  keyMode?: 'major' | 'minor';
  /** smallest note value: 4 = quarter, 8 = eighth, 16 = sixteenth */
  grid: 4 | 8 | 16;
  triplets: boolean;
}

export interface ManifestAudio {
  /** file name inside the project folder, e.g. "audio.m4a" (or "audio.caf" while recording / unrecovered) */
  file: string;
  sampleRate: number;
  durationSec: number;
  countInEndSec: number;
  source: 'mic' | 'import';
  /** take was cut short by a call/Siri/limit/crash */
  interrupted?: boolean;
}

export interface ManifestTranscription {
  status: TranscriptionStatus;
  modelId?: string;
  modelVersion?: string;
  finishedAt?: number;
  error?: string;
}

export interface ProjectManifest {
  schema: typeof MANIFEST_SCHEMA;
  id: string;
  kind: 'song' | 'idea';
  songId?: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  audio?: ManifestAudio;
  transcription: ManifestTranscription;
  scoreSettings: ManifestScoreSettings;
  /** true once edits.json has at least one op (mirrors projects.has_edits) */
  hasEdits?: boolean;
}

/** §5.4 edit log. Ops reference raw note ids (or added ids) and positions in beats. */
export type EditOp =
  | { t: 'pitch'; noteId: string; pitch: number }
  | { t: 'length'; noteId: string; beats: number }
  | { t: 'delete'; noteId: string }
  | { t: 'addNote'; id: string; beat: number; pitch: number; beats: number; staff: 'treble' | 'bass' }
  | { t: 'addRest'; id: string; beat: number; beats: number; staff: 'treble' | 'bass' };

export interface EditLog {
  ops: EditOp[];
  /** undo = head--, redo = head++, a new op truncates ops after head */
  head: number;
}

export const EMPTY_EDIT_LOG: EditLog = { ops: [], head: 0 };

export const DEFAULT_SCORE_SETTINGS: ManifestScoreSettings = { timeSig: '4/4', grid: 8, triplets: false };

// ---- ids ----

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** ULID: 48-bit ms timestamp + 80 random bits, Crockford base32 — sortable by creation time (§5.2). */
export function ulid(now = Date.now(), random: (n: number) => Uint8Array = randomBytes): string {
  let time = '';
  let t = Math.max(0, Math.floor(now));
  for (let i = 0; i < 10; i++) {
    time = CROCKFORD[t % 32] + time;
    t = Math.floor(t / 32);
  }
  const bytes = random(16);
  let rand = '';
  for (let i = 0; i < 16; i++) rand += CROCKFORD[(bytes[i] ?? 0) % 32];
  return time + rand;
}

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c?.getRandomValues) return c.getRandomValues(out);
  for (let i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256);
  return out;
}

// ---- construction / mapping ----

export function newManifest(
  kind: 'song' | 'idea',
  name: string,
  songId?: string,
  opts: { id?: string; now?: number } = {},
): ProjectManifest {
  const now = opts.now ?? Date.now();
  const m: ProjectManifest = {
    schema: MANIFEST_SCHEMA,
    id: opts.id ?? ulid(now),
    kind,
    name,
    createdAt: now,
    updatedAt: now,
    transcription: { status: 'none' },
    scoreSettings: { ...DEFAULT_SCORE_SETTINGS },
  };
  if (songId) m.songId = songId;
  return m;
}

/** The SQLite/Zustand view of a manifest. */
export function manifestToProject(m: ProjectManifest): Project {
  const p: Project = {
    id: m.id,
    kind: m.kind,
    name: m.name,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    durationSec: m.audio?.durationSec ?? 0,
    transcriptionStatus: m.transcription.status,
    hasEdits: m.hasEdits ?? false,
  };
  if (m.songId) p.songId = m.songId;
  return p;
}

/** Applies the Project fields the app can change (name, song link, status…) onto a manifest. */
export function mergeProjectIntoManifest(m: ProjectManifest, p: Project): ProjectManifest {
  const next: ProjectManifest = {
    ...m,
    kind: p.kind,
    name: p.name,
    updatedAt: Math.max(m.updatedAt, p.updatedAt),
    transcription: { ...m.transcription, status: p.transcriptionStatus },
    hasEdits: p.hasEdits,
  };
  if (p.songId) next.songId = p.songId;
  else delete next.songId;
  if (m.audio && p.durationSec > 0) next.audio = { ...m.audio, durationSec: p.durationSec };
  return next;
}

export function serializeManifest(m: ProjectManifest): string {
  return JSON.stringify(m, null, 2);
}

export class ManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ManifestError';
  }
}

const TX_STATUSES: readonly TranscriptionStatus[] = ['none', 'queued', 'running', 'done', 'failed'];

/** Parses and validates manifest.json; fills defaults for optional blocks. Throws ManifestError. */
export function parseManifest(text: string): ProjectManifest {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch (e) {
    throw new ManifestError(`manifest.json is not valid JSON: ${String(e)}`);
  }
  if (typeof v !== 'object' || v === null) throw new ManifestError('manifest.json is not an object');
  const o = v as Record<string, unknown>;
  if (o.schema !== MANIFEST_SCHEMA) throw new ManifestError(`unsupported manifest schema ${String(o.schema)}`);
  if (typeof o.id !== 'string' || !o.id) throw new ManifestError('manifest.id missing');
  if (o.kind !== 'song' && o.kind !== 'idea') throw new ManifestError('manifest.kind invalid');
  if (typeof o.name !== 'string') throw new ManifestError('manifest.name missing');
  if (typeof o.createdAt !== 'number' || typeof o.updatedAt !== 'number') {
    throw new ManifestError('manifest timestamps missing');
  }
  const tx = (o.transcription ?? {}) as Partial<ManifestTranscription>;
  const status = TX_STATUSES.includes(tx.status as TranscriptionStatus) ? (tx.status as TranscriptionStatus) : 'none';
  const m: ProjectManifest = {
    ...(o as unknown as ProjectManifest),
    transcription: { ...tx, status },
    scoreSettings: { ...DEFAULT_SCORE_SETTINGS, ...((o.scoreSettings as object | undefined) ?? {}) },
  };
  return m;
}

export function parseEditLog(text: string): EditLog {
  const v = JSON.parse(text) as Partial<EditLog>;
  const ops = Array.isArray(v.ops) ? v.ops : [];
  const head = typeof v.head === 'number' ? Math.max(0, Math.min(ops.length, Math.trunc(v.head))) : ops.length;
  return { ops, head };
}
