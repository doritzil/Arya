/** Public types for `aria-audio` (ARCHITECTURE.md §8.1). Shared by the native wrapper and the JS mock. */
import type { Subscription } from './emitter';

export type { Subscription };

export type InputKind = 'builtIn' | 'usb' | 'bluetooth' | 'wired';
export type OutputKind = 'speaker' | 'headphones' | 'bluetooth' | 'other';
export type MicPermission = 'granted' | 'denied' | 'undetermined';

export interface AudioInput {
  /** `AVAudioSessionPortDescription.uid`. */
  id: string;
  name: string;
  kind: InputKind;
  /** Bluetooth HFP mics are low bandwidth (8–16 kHz) — the mic picker should say so. */
  lowBandwidth: boolean;
  /** True for the currently active/preferred input. */
  selected: boolean;
}

export interface CountInOptions {
  bpm: number;
  /** Always 4 in v1. */
  beats?: number;
  /** Clicks are only audible when the output is headphones (never leak into the mic). Default true. */
  clickOnlyInHeadphones?: boolean;
}

export interface StartRecordingOptions {
  /** Project folder (file:// URI or absolute path). `audio.caf` is written here while recording. */
  projectDir: string;
  sampleRate?: 44100 | 48000;
  countIn?: CountInOptions;
  /** Hard stop; defaults to 600 s (warning 30 s before). */
  maxDurationSec?: number;
}

export interface RecordingResult {
  /** file:// URI of `audio.m4a` (ALAC) — or `audio.caf` if the transcode failed (it is then retried on recovery). */
  file: string;
  durationSec: number;
  /** Seconds into the file where the count-in ends (0 without count-in). The transcriber skips this. */
  countInEndSec: number;
  sampleRate: number;
  /** The take was cut short by an interruption (call, Siri, route loss) or the 10-min limit. */
  interrupted: boolean;
}

export interface ImportResult {
  file: string;
  durationSec: number;
}

export interface SynthNote {
  pitch: number;
  startSec: number;
  endSec: number;
  /** 1–127 */
  velocity: number;
}

export type PlayerSource =
  | { kind: 'file'; uri: string }
  | { kind: 'url'; url: string }
  | { kind: 'synth'; notes: SynthNote[] }
  /** Clock-only source (no audio) — e.g. previews without a URL in dev. */
  | { kind: 'silent'; durationSec: number };
/** @deprecated alias — use PlayerSource */
export type NativeSource = PlayerSource;

export interface NowPlayingMeta {
  title: string;
  artist?: string;
}

export interface LoadResult {
  durationSec: number;
}

export interface RecoveredRecording {
  projectDir: string;
  /** m4a when recovered, caf when unreadable */
  file: string;
  durationSec: number;
  status: 'recovered' | 'unreadable';
}

export type PlayerStatus = 'idle' | 'playing' | 'paused' | 'ended';

// ---- events ----

export interface LevelEvent {
  /** dBFS, −160…0 */
  rms: number;
  /** dBFS, −160…0 */
  peak: number;
  /** 0–1 meter value (−60 dBFS → 0, 0 dBFS → 1), convenient for the LevelMeter. */
  meter: number;
}

export interface InputWarningEvent {
  /** null = warning cleared */
  kind: 'quiet' | 'clipping' | null;
}

export interface InterruptionEvent {
  phase: 'began' | 'ended';
  reason: 'call' | 'siri' | 'route' | 'mediaReset' | 'other';
  /** True if a recording was running and has been finalized. The UI offers Keep / Record again. */
  recordingStopped: boolean;
}

export interface ClockEvent {
  position: number;
  /** Monotonic host time in ms (CACurrentMediaTime × 1000 natively, performance.now() in the mock). */
  hostTime: number;
  /** Date.now()-comparable wall clock in ms at the time of `position`. Use this if host timebases differ. */
  wallTime: number;
  rate: number;
  status: PlayerStatus;
  /** Duration of the loaded source (s). */
  duration: number;
  /** AVAudioSession.outputLatency (s). Visual time = position − outputLatency (§6.6). */
  outputLatency: number;
}

export interface RouteChangeEvent {
  inputs: AudioInput[];
  output: OutputKind;
  outputLatency: number;
  reason: 'newDevice' | 'oldDeviceUnavailable' | 'categoryChange' | 'override' | 'other';
}

export interface CountInBeatEvent {
  /** 1-based */
  beat: number;
  beats: number;
  /** false when the click was not played (speaker output) — show on-screen beats + haptic. */
  audible: boolean;
}

export interface RecordingStatusEvent {
  state: 'recording' | 'limitWarning' | 'autoStopped' | 'interrupted' | 'stopped';
  elapsedSec: number;
}

export interface PlayerErrorEvent {
  message: string;
}

export interface AriaAudioEvents {
  level: LevelEvent;
  inputWarning: InputWarningEvent;
  interruption: InterruptionEvent;
  clock: ClockEvent;
  routeChange: RouteChangeEvent;
  countInBeat: CountInBeatEvent;
  recordingStatus: RecordingStatusEvent;
  /** The loaded source can't be played (stream failed or never loaded). */
  playerError: PlayerErrorEvent;
}

export type AriaAudioEventName = keyof AriaAudioEvents;

/** The surface implemented by both the Swift module and the JS mock. */
export interface AriaAudioApi {
  getMicPermission(): Promise<MicPermission>;
  requestMicPermission(): Promise<'granted' | 'denied'>;
  getInputs(): Promise<AudioInput[]>;
  setPreferredInput(id: string): Promise<void>;
  getOutput(): Promise<{ output: OutputKind; outputLatency: number }>;

  startRecording(opts: StartRecordingOptions): Promise<void>;
  stopRecording(): Promise<RecordingResult>;
  /** Stops and deletes the in-progress take. */
  discardRecording(): Promise<void>;

  importAudio(src: string, projectDir: string): Promise<ImportResult>;

  load(source: PlayerSource, nowPlaying?: NowPlayingMeta): Promise<LoadResult>;
  /** Fire-and-forget transport calls; state comes back through `clock` events. */
  play(): void;
  pause(): void;
  seek(sec: number): void;
  setLoop(on: boolean): void;
  /** 0.25–2. Files/URLs keep pitch (AVAudioUnitTimePitch / AVPlayer); synth changes sequencer rate. */
  setRate(rate: number): void;
  /** Stops and releases the current source (status → idle). */
  unload(): void;

  getPeaks(file: string, count: number): Promise<number[]>;
  recoverOrphanedRecordings(projectsDir: string): Promise<RecoveredRecording[]>;

  addListener<K extends AriaAudioEventName>(event: K, cb: (payload: AriaAudioEvents[K]) => void): Subscription;
}
