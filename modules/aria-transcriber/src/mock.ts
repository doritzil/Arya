/**
 * JS stand-in for the Swift transcriber. Emits `progress` over ~4 s (per "chunk", slightly uneven like the
 * real thing), then writes the demo piece to `outPath` (best effort via expo-file-system; skipped where the
 * file system isn't available, e.g. web) and emits `done`. `cancel` → `error` with code 'cancelled'.
 */
import type { AriaTranscriberApi, AriaTranscriberEvents, RawNotes } from './AriaTranscriber.types';
import { demoRawNotes } from './demoNotes';
import { MockEmitter } from './emitter';

export interface AriaTranscriberMock extends AriaTranscriberApi {
  readonly isMock: true;
  /** Last notes produced per outPath (lets the web preview read "written" notes without a file system). */
  getMockOutput(outPath: string): RawNotes | undefined;
  dispose(): void;
}

export interface MockOptions {
  durationMs?: number;
  /** Override file writing (tests). Default: expo-file-system File API, ignored on failure. */
  writeFile?: (path: string, contents: string) => Promise<void>;
}

async function defaultWriteFile(path: string, contents: string): Promise<void> {
  try {
    const { File } = await import('expo-file-system');
    const uri = path.startsWith('file://') ? path : `file://${path}`;
    const f = new File(uri);
    if (!f.parentDirectory.exists) f.parentDirectory.create({ intermediates: true, idempotent: true });
    f.write(contents);
  } catch {
    // No file system here (web / Jest without mocks) — callers can use getMockOutput / demoRawNotes.
  }
}

export function createAriaTranscriberMock(options: MockOptions = {}): AriaTranscriberMock {
  const durationMs = options.durationMs ?? 4000;
  const writeFile = options.writeFile ?? defaultWriteFile;
  const emitter = new MockEmitter<AriaTranscriberEvents>();
  const jobs = new Map<string, { timer: ReturnType<typeof setInterval> }>();
  const outputs = new Map<string, RawNotes>();
  let counter = 0;

  const stepMs = 200;
  const steps = Math.max(1, Math.round(durationMs / stepMs));

  return {
    isMock: true,
    modelInfo: { id: 'mock', version: '0', available: false },

    async transcribe(_audioPath, opts) {
      const jobId = `job-${Date.now().toString(36)}-${++counter}`;
      const startedAt = Date.now();
      let step = 0;
      const timer = setInterval(() => {
        step++;
        // chunks finish unevenly; keep fraction monotonic and < 1 until done
        const fraction = Math.min(0.99, (step + (step % 3 === 0 ? 0.4 : 0)) / steps);
        emitter.emit('progress', { jobId, fraction, stage: 'notes' });
        if (step >= steps) {
          clearInterval(timer);
          jobs.delete(jobId);
          const raw = demoRawNotes(opts.startAtSec ?? 0);
          outputs.set(opts.outPath, raw);
          void writeFile(opts.outPath, JSON.stringify(raw)).then(
            () => {
              emitter.emit('progress', { jobId, fraction: 1, stage: 'notes' });
              emitter.emit('done', {
                jobId,
                noteCount: raw.notes.length,
                pedalCount: raw.pedal.length,
                elapsedMs: Date.now() - startedAt,
                outPath: opts.outPath,
              });
            },
            (e: unknown) => emitter.emit('error', { jobId, code: 'io', message: String(e) }),
          );
        }
      }, stepMs);
      jobs.set(jobId, { timer });
      return { jobId };
    },

    cancel(jobId) {
      const job = jobs.get(jobId);
      if (!job) return;
      clearInterval(job.timer);
      jobs.delete(jobId);
      emitter.emit('error', { jobId, code: 'cancelled', message: 'Cancelled' });
    },

    addListener(event, cb) {
      return emitter.addListener(event, cb);
    },

    getMockOutput(outPath) {
      return outputs.get(outPath);
    },

    dispose() {
      for (const j of jobs.values()) clearInterval(j.timer);
      jobs.clear();
      emitter.removeAllListeners();
    },
  };
}
