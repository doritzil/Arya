/**
 * aria-audio — the single AVAudioSession owner (ARCHITECTURE.md §8.1, D5).
 * Recording, metering, input routes, count-in, imports and every non-MusicKit player.
 * Falls back to a JS mock when the native module isn't linked (web, Jest, Expo Go): check `isNative`.
 */
import AriaAudio, { isNative } from './src/AriaAudioModule';
import type {
  AriaAudioEvents,
  AudioInput,
  ImportResult,
  LoadResult,
  MicPermission,
  NowPlayingMeta,
  OutputKind,
  PlayerSource,
  RecordingResult,
  RecoveredRecording,
  StartRecordingOptions,
  Subscription,
} from './src/AriaAudio.types';

export * from './src/AriaAudio.types';
export { dbToMeter } from './src/mock';
export { isNative };

// session / permission / inputs
export const getMicPermission = (): Promise<MicPermission> => AriaAudio.getMicPermission();
export const requestMicPermission = (): Promise<'granted' | 'denied'> => AriaAudio.requestMicPermission();
export const getInputs = (): Promise<AudioInput[]> => AriaAudio.getInputs();
export const setPreferredInput = (id: string): Promise<void> => AriaAudio.setPreferredInput(id);
export const getOutput = (): Promise<{ output: OutputKind; outputLatency: number }> => AriaAudio.getOutput();

// recording
export const startRecording = (opts: StartRecordingOptions): Promise<void> => AriaAudio.startRecording(opts);
export const stopRecording = (): Promise<RecordingResult> => AriaAudio.stopRecording();
export const discardRecording = (): Promise<void> => AriaAudio.discardRecording();

// import (FR-5)
export const importAudio = (src: string, projectDir: string): Promise<ImportResult> =>
  AriaAudio.importAudio(src, projectDir);

// playback
export const load = (source: PlayerSource, nowPlaying?: NowPlayingMeta): Promise<LoadResult> =>
  nowPlaying ? AriaAudio.load(source, nowPlaying) : AriaAudio.load(source);
export const play = (): void => AriaAudio.play();
export const pause = (): void => AriaAudio.pause();
export const seek = (sec: number): void => AriaAudio.seek(sec);
export const setLoop = (on: boolean): void => AriaAudio.setLoop(on);
export const setRate = (rate: number): void => AriaAudio.setRate(rate);
export const unload = (): void => AriaAudio.unload();

// files
export const getPeaks = (file: string, count: number): Promise<number[]> => AriaAudio.getPeaks(file, count);
/** Call once on launch: finalizes any `audio.caf` left without an `audio.m4a` by a crash (NFR-8). */
export const recoverOrphanedRecordings = (projectsDir: string): Promise<RecoveredRecording[]> =>
  AriaAudio.recoverOrphanedRecordings(projectsDir);

// events
export function addListener<K extends keyof AriaAudioEvents>(
  event: K,
  cb: (payload: AriaAudioEvents[K]) => void,
): Subscription {
  return AriaAudio.addListener(event, cb);
}
