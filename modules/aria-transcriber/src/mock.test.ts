/// <reference types="jest" />
import type { DoneEvent, ErrorEvent, ProgressEvent } from './AriaTranscriber.types';
import { demoRawNotes } from './demoNotes';
import { createAriaTranscriberMock } from './mock';

describe('demoRawNotes', () => {
  const raw = demoRawNotes(2);

  it('is a plausible 8-bar piece', () => {
    expect(raw.notes.length).toBeGreaterThan(50);
    expect(raw.pedal).toHaveLength(8);
    const ids = new Set(raw.notes.map((n) => n.id));
    expect(ids.size).toBe(raw.notes.length);
    for (const n of raw.notes) {
      expect(n.pitch).toBeGreaterThanOrEqual(21);
      expect(n.pitch).toBeLessThanOrEqual(108);
      expect(n.offset).toBeGreaterThan(n.onset);
      expect(n.onset).toBeGreaterThanOrEqual(2); // starts after the skipped count-in
      expect(n.velocity).toBeGreaterThanOrEqual(1);
      expect(n.velocity).toBeLessThanOrEqual(127);
    }
    const onsets = raw.notes.map((n) => n.onset);
    expect([...onsets].sort((a, b) => a - b)).toEqual(onsets);
    // 8 bars at 96 BPM ≈ 20 s
    expect(raw.notes.at(-1)!.offset - raw.notes[0]!.onset).toBeGreaterThan(18);
    expect(raw.notes.at(-1)!.offset - raw.notes[0]!.onset).toBeLessThan(22);
  });

  it('is deterministic', () => {
    expect(demoRawNotes(2)).toEqual(raw);
  });
});

describe('aria-transcriber mock', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('emits progress over ~4 s then writes and reports done', async () => {
    const written: Record<string, string> = {};
    const tx = createAriaTranscriberMock({
      writeFile: async (path, contents) => {
        written[path] = contents;
      },
    });
    const progress: ProgressEvent[] = [];
    const done: DoneEvent[] = [];
    tx.addListener('progress', (p) => progress.push(p));
    tx.addListener('done', (d) => done.push(d));

    const { jobId } = await tx.transcribe('file:///p/audio.m4a', { outPath: 'file:///p/notes.raw.json', startAtSec: 2.5 });
    jest.advanceTimersByTime(2000);
    expect(done).toHaveLength(0);
    jest.advanceTimersByTime(2000);
    await Promise.resolve();
    await Promise.resolve();

    expect(progress.length).toBeGreaterThanOrEqual(20);
    const fractions = progress.map((p) => p.fraction);
    expect([...fractions].sort((a, b) => a - b)).toEqual(fractions);
    expect(fractions.at(-1)).toBe(1);
    expect(done).toHaveLength(1);
    expect(done[0]!.jobId).toBe(jobId);
    const raw = JSON.parse(written['file:///p/notes.raw.json']!);
    expect(done[0]!.noteCount).toBe(raw.notes.length);
    expect(tx.getMockOutput('file:///p/notes.raw.json')).toEqual(raw);
    tx.dispose();
  });

  it('cancels with an error event', async () => {
    const tx = createAriaTranscriberMock({ writeFile: async () => {} });
    const errors: ErrorEvent[] = [];
    tx.addListener('error', (e) => errors.push(e));
    const { jobId } = await tx.transcribe('/a', { outPath: '/o' });
    jest.advanceTimersByTime(1000);
    tx.cancel(jobId);
    jest.advanceTimersByTime(5000);
    expect(errors).toEqual([{ jobId, code: 'cancelled', message: 'Cancelled' }]);
    tx.dispose();
  });
});
