/** Public types for `aria-musickit` (ARCHITECTURE.md §8.2). Clock/state shapes match aria-audio's. */
import type { Subscription } from './emitter';

export type { Subscription };

export type MusicAuthorization = 'authorized' | 'denied' | 'restricted' | 'notDetermined';

export interface SubscriptionInfo {
  canPlayCatalogContent: boolean;
  canBecomeSubscriber: boolean;
}

export type MusicPlayerStatus = 'idle' | 'playing' | 'paused' | 'ended';

export interface MusicClockEvent {
  position: number;
  /** ms, CACurrentMediaTime × 1000 natively, performance.now() in the mock */
  hostTime: number;
  /** ms, Date.now()-comparable */
  wallTime: number;
  rate: number;
  status: MusicPlayerStatus;
  duration: number;
  /** MusicKit output goes through the same AVAudioSession; reported for Keyboard-mode sync. */
  outputLatency: number;
}

export interface MusicStateEvent {
  status: MusicPlayerStatus | 'loading' | 'failed';
  appleMusicId?: string;
  duration?: number;
  error?: string;
}

export interface AriaMusicKitEvents {
  clock: MusicClockEvent;
  state: MusicStateEvent;
}

export interface AriaMusicKitApi {
  requestAuthorization(): Promise<MusicAuthorization>;
  authorizationStatus(): MusicAuthorization;
  subscription(): Promise<SubscriptionInfo>;
  play(appleMusicId: string): Promise<void>;
  /** Resume after pause (keeps queue + position). */
  resume(): Promise<void>;
  pause(): void;
  stop(): void;
  seek(sec: number): void;
  setRepeat(on: boolean): void;
  /**
   * FR-27, on device: recently played + heavy rotation → weights per **Apple Music genre name**
   * (e.g. "Pop", "Soundtrack", "Classical"), summing to 1. Raw history never leaves the module (NFR-2).
   * Map to Aria's genres in JS.
   */
  listeningGenreWeights(): Promise<Record<string, number>>;
  openInAppleMusic(appleMusicId: string): void;
  addListener<K extends keyof AriaMusicKitEvents>(event: K, cb: (payload: AriaMusicKitEvents[K]) => void): Subscription;
}
