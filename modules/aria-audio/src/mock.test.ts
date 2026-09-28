/// <reference types="jest" />
import { createAriaAudioMock, type AriaAudioMock } from './mock';
import type { ClockEvent, InputWarningEvent, LevelEvent } from './AriaAudio.types';

describe('aria-audio mock', () => {
  let audio: AriaAudioMock;

  beforeEach(() => {
    jest.useFakeTimers();
    audio = createAriaAudioMock();
  });

  afterEach(() => {
    audio.dispose();
    jest.useRealTimers();
  });

  it('grants mic permission after a short delay', async () => {
    expect(await audio.getMicPermission()).toBe('undetermined');
    const p = audio.requestMicPermission();
    jest.advanceTimersByTime(300);
    expect(await p).toBe('granted');
    expect(await audio.getMicPermission()).toBe('granted');
  });

  it('emits level at ~20 Hz while recording and returns a duration on stop', async () => {
    const levels: LevelEvent[] = [];
    const sub = audio.addListener('level', (l) => levels.push(l));
    await audio.startRecording({ projectDir: 'file:///p/1', countIn: { bpm: 120 } });
    jest.advanceTimersByTime(3000);
    const result = await audio.stopRecording();
    sub.remove();

    expect(levels.length).toBeGreaterThanOrEqual(58);
    expect(levels.length).toBeLessThanOrEqual(61);
    for (const l of levels) {
      expect(l.rms).toBeLessThanOrEqual(0);
      expect(l.peak).toBeGreaterThanOrEqual(l.rms);
      expect(l.meter).toBeGreaterThanOrEqual(0);
      expect(l.meter).toBeLessThanOrEqual(1);
    }
    expect(result.file).toBe('file:///p/1/audio.m4a');
    expect(result.durationSec).toBeCloseTo(3, 1);
    expect(result.countInEndSec).toBeCloseTo(2, 5); // 4 beats at 120 BPM
    expect(result.interrupted).toBe(false);
  });

  it('emits count-in beats', async () => {
    const beats: number[] = [];
    audio.addListener('countInBeat', (b) => beats.push(b.beat));
    await audio.startRecording({ projectDir: '/p', countIn: { bpm: 60, beats: 4 } });
    jest.advanceTimersByTime(3500);
    expect(beats).toEqual([1, 2, 3, 4]);
  });

  it('warns about a quiet input only after 1.5 s, and clears it', async () => {
    const warnings: InputWarningEvent[] = [];
    audio.addListener('inputWarning', (w) => warnings.push(w));
    await audio.startRecording({ projectDir: '/p' });
    audio.__forceInput('quiet');
    jest.advanceTimersByTime(1000);
    expect(warnings).toEqual([]);
    jest.advanceTimersByTime(1000);
    expect(warnings).toEqual([{ kind: 'quiet' }]);
    audio.__forceInput('normal');
    jest.advanceTimersByTime(1500);
    expect(warnings.at(-1)).toEqual({ kind: null });
  });

  it('advances a clock honouring rate, seek and loop', async () => {
    const clocks: ClockEvent[] = [];
    audio.addListener('clock', (c) => clocks.push(c));
    const loadP = audio.load({ kind: 'silent', durationSec: 10 });
    jest.advanceTimersByTime(60);
    expect(await loadP).toEqual({ durationSec: 10 });

    audio.setRate(2);
    audio.play();
    jest.advanceTimersByTime(1000);
    expect(clocks.at(-1)!.status).toBe('playing');
    expect(clocks.at(-1)!.position).toBeCloseTo(2, 1);

    audio.seek(9);
    audio.setLoop(true);
    jest.advanceTimersByTime(1000); // 9 + 2 → wraps to 1
    expect(clocks.at(-1)!.position).toBeCloseTo(1, 1);
    expect(clocks.at(-1)!.status).toBe('playing');

    audio.setLoop(false);
    jest.advanceTimersByTime(6000);
    expect(clocks.at(-1)!.status).toBe('ended');
    expect(clocks.at(-1)!.position).toBe(10);
    expect(clocks.at(-1)!.duration).toBe(10);
  });

  it('uses the synth note span as duration', async () => {
    const p = audio.load({ kind: 'synth', notes: [{ pitch: 60, startSec: 0, endSec: 4, velocity: 80 }] });
    jest.advanceTimersByTime(60);
    expect((await p).durationSec).toBeCloseTo(4.5);
  });
});
