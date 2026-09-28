/** Public types for `aria-transcriber` (ARCHITECTURE.md §7.2). */
import type { Subscription } from './emitter';

export type { Subscription };

/**
 * `notes.raw.json` — model output, never edited (§5.2). Defined locally so this module doesn't depend on
 * @aria/score-engine; the shapes are structurally identical.
 */
export interface RawNote {
  id: string;
  /** MIDI 21–108 */
  pitch: number;
  /** seconds from the start of the audio file (count-in included, i.e. ≥ startAtSec) */
  onset: number;
  offset: number;
  /** 1–127 */
  velocity: number;
}

export interface PedalSpan {
  on: number;
  off: number;
}

export interface RawNotes {
  notes: RawNote[];
  pedal: PedalSpan[];
  /** model frames per second (for diagnostics) */
  frameRate?: number;
  modelId?: string;
  modelVersion?: string;
}

export interface TranscribeOptions {
  /** Skip the count-in (RecordingResult.countInEndSec). */
  startAtSec?: number;
  /** Where notes.raw.json is written (atomically). file:// URI or absolute path. */
  outPath: string;
}

export interface ProgressEvent {
  jobId: string;
  /** 0–1 */
  fraction: number;
  stage: 'notes';
}

export interface DoneEvent {
  jobId: string;
  noteCount: number;
  pedalCount: number;
  elapsedMs: number;
  outPath: string;
}

export type TranscribeErrorCode = 'cancelled' | 'decode' | 'model' | 'io';

export interface ErrorEvent {
  jobId: string;
  code: TranscribeErrorCode;
  message: string;
}

export interface AriaTranscriberEvents {
  progress: ProgressEvent;
  done: DoneEvent;
  error: ErrorEvent;
}

export interface ModelInfo {
  id: string;
  version: string;
  /** false when the .mlmodelc isn't bundled (or in the mock) */
  available: boolean;
}

export interface AriaTranscriberApi {
  readonly modelInfo: ModelInfo;
  transcribe(audioPath: string, opts: TranscribeOptions): Promise<{ jobId: string }>;
  cancel(jobId: string): void;
  addListener<K extends keyof AriaTranscriberEvents>(
    event: K,
    cb: (payload: AriaTranscriberEvents[K]) => void,
  ): Subscription;
}
