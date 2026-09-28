import * as Audio from '@modules/aria-audio';
import { create } from 'zustand';

/**
 * One thing plays at a time (handoff §2, ARCHITECTURE §6.4). The coordinator owns which source is
 * active and mirrors the native clock; cards and players read from it and never talk to players directly.
 */
export type Source =
  | { kind: 'preview'; key: string; title: string; url?: string; durationSec?: number }
  | { kind: 'appleMusic'; key: string; title: string; appleMusicId: string; durationSec?: number }
  | { kind: 'recording'; key: string; title: string; uri: string }
  | { kind: 'synth'; key: string; title: string; notes: Audio.SynthNote[] };

export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused';

interface PlaybackState {
  source?: Source;
  status: PlaybackStatus;
  positionSec: number;
  durationSec: number;
  loop: boolean;
  rate: number;
  /** Seconds between the reported position and what the listener hears (Bluetooth ≈ 0.2 s). */
  outputLatency: number;
  play(source: Source): Promise<void>;
  toggle(source: Source): Promise<void>;
  pause(): void;
  resume(): void;
  seek(sec: number): void;
  skipBack(sec?: number): void;
  setLoop(on: boolean): void;
  setRate(rate: number): void;
  stop(): void;
}

let clockSub: { remove(): void } | null = null;

function toNative(source: Source): Audio.PlayerSource {
  switch (source.kind) {
    case 'recording':
      return { kind: 'file', uri: source.uri };
    case 'synth':
      return { kind: 'synth', notes: source.notes };
    case 'preview':
      return source.url ? { kind: 'url', url: source.url } : { kind: 'silent', durationSec: source.durationSec ?? 30 };
    case 'appleMusic':
      // Full-song playback goes through aria-musickit once wired; until then the preview path plays.
      return { kind: 'silent', durationSec: source.durationSec ?? 30 };
  }
}

export const usePlayback = create<PlaybackState>((set, get) => ({
  status: 'idle',
  positionSec: 0,
  durationSec: 0,
  loop: false,
  rate: 1,
  outputLatency: 0,

  async play(source) {
    const cur = get().source;
    if (cur && cur.key !== source.key) Audio.pause();
    set({ source, status: 'loading', positionSec: 0 });
    clockSub ??= Audio.addListener('clock', (c) => {
      if (!get().source) return;
      set({
        positionSec: c.position,
        durationSec: c.duration ?? get().durationSec,
        outputLatency: c.outputLatency ?? 0,
        status: c.status === 'playing' ? 'playing' : c.status === 'ended' ? 'paused' : get().status,
      });
    });
    const { durationSec } = await Audio.load(toNative(source));
    if (get().source?.key !== source.key) return; // superseded while loading
    Audio.setLoop(get().loop);
    Audio.setRate(get().rate);
    Audio.play();
    set({ durationSec, status: 'playing' });
  },

  async toggle(source) {
    const { source: cur, status } = get();
    if (cur?.key === source.key && status === 'playing') return get().pause();
    if (cur?.key === source.key && status === 'paused') return get().resume();
    return get().play(source);
  },

  pause() {
    Audio.pause();
    set({ status: 'paused' });
  },
  resume() {
    Audio.play();
    set({ status: 'playing' });
  },
  seek(sec) {
    const s = Math.max(0, Math.min(sec, get().durationSec || sec));
    Audio.seek(s);
    set({ positionSec: s });
  },
  skipBack(sec = 5) {
    get().seek(get().positionSec - sec);
  },
  setLoop(loop) {
    Audio.setLoop(loop);
    set({ loop });
  },
  setRate(rate) {
    Audio.setRate(rate);
    set({ rate });
  },
  stop() {
    Audio.pause();
    set({ source: undefined, status: 'idle', positionSec: 0 });
  },
}));

/** True when `key` is the active source and audibly playing — drives play/pause icons in place. */
export const useIsPlaying = (key: string) =>
  usePlayback((s) => s.source?.key === key && (s.status === 'playing' || s.status === 'loading'));

export const useProgress = (key: string) =>
  usePlayback((s) => (s.source?.key === key && s.durationSec > 0 ? s.positionSec / s.durationSec : 0));
