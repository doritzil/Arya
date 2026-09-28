/**
 * aria-transcriber — on-device piano transcription (ARCHITECTURE.md §7.2).
 * audio file → Core ML → notes.raw.json (written atomically). Progress per chunk, cancellable.
 * Falls back to a JS mock that "transcribes" a demo 8-bar piece in ~4 s (`isNative` === false).
 */
import AriaTranscriber, { isNative } from './src/AriaTranscriberModule';
import type { AriaTranscriberMock } from './src/mock';
import type {
  AriaTranscriberEvents,
  ModelInfo,
  RawNotes,
  Subscription,
  TranscribeOptions,
} from './src/AriaTranscriber.types';

export * from './src/AriaTranscriber.types';
export { demoRawNotes } from './src/demoNotes';
export { isNative };

export const modelInfo: ModelInfo = AriaTranscriber.modelInfo;

export function transcribe(audioPath: string, opts: TranscribeOptions): Promise<{ jobId: string }> {
  return AriaTranscriber.transcribe(audioPath, opts);
}

export function cancel(jobId: string): void {
  AriaTranscriber.cancel(jobId);
}

export function addListener<K extends keyof AriaTranscriberEvents>(
  event: K,
  cb: (payload: AriaTranscriberEvents[K]) => void,
): Subscription {
  return AriaTranscriber.addListener(event, cb);
}

/**
 * Mock only: the notes the mock "wrote" to `outPath` (for the web preview, where no file system exists).
 * Always undefined with the native module — read the file instead.
 */
export function getMockOutput(outPath: string): RawNotes | undefined {
  return isNative ? undefined : (AriaTranscriber as AriaTranscriberMock).getMockOutput(outPath);
}
