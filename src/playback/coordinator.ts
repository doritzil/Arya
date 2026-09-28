import * as Audio from '@modules/aria-audio';
import * as MusicKit from '@modules/aria-musickit';
import { create } from 'zustand';

import { findOnAppleMusic } from '@/services/appleMusic';

/**
 * One thing plays at a time (handoff §2, ARCHITECTURE §6.4). The coordinator owns which source is
 * active and mirrors the native clock; cards and players read from it and never talk to players directly.
 */
export type Source =
  /** An original song. Plays in full through Apple Music for subscribers, otherwise the 30-s preview (FR-29, FR-30). */
  | { kind: 'song'; key: string; title: string; artist: string; appleMusicId?: string; previewUrl?: string }
  | { kind: 'recording'; key: string; title: string; uri: string }
  | { kind: 'synth'; key: string; title: string; notes: Audio.SynthNote[] };

export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

interface PlaybackState {
  source?: Source;
  status: PlaybackStatus;
  /** For songs: whether the full track or the 30-second preview is playing. */
  mode?: 'full' | 'preview';
  error?: string;
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

type Backend = 'audio' | 'musickit';
let backend: Backend = 'audio';
let subs: { remove(): void }[] = [];

/** Full songs need the native MusicKit module, permission, and an Apple Music subscription. */
async function canPlayFull(): Promise<boolean> {
  if (!MusicKit.isNative) return false;
  if (MusicKit.authorizationStatus() !== 'authorized') return false;
  return (await MusicKit.subscription().catch(() => null))?.canPlayCatalogContent ?? false;
}

export const usePlayback = create<PlaybackState>((set, get) => {
  const onClock = (from: Backend) => (c: { position: number; duration?: number; outputLatency?: number; status: string }) => {
    if (!get().source || from !== backend) return;
    set({
      positionSec: c.position,
      durationSec: c.duration ?? get().durationSec,
      outputLatency: c.outputLatency ?? 0,
      status: c.status === 'playing' ? 'playing' : c.status === 'ended' ? 'paused' : get().status,
    });
  };
  const wire = () => {
    if (subs.length) return;
    subs = [
      Audio.addListener('clock', onClock('audio')),
      MusicKit.addListener('clock', onClock('musickit')),
      Audio.addListener('playerError', ({ message }) => {
        if (get().source && backend === 'audio') set({ status: 'error', error: message });
      }),
    ];
  };
  const stopBackend = () => (backend === 'musickit' ? MusicKit.pause() : Audio.pause());

  return {
    status: 'idle',
    positionSec: 0,
    durationSec: 0,
    loop: false,
    rate: 1,
    outputLatency: 0,

    async play(source) {
      wire();
      if (get().source) stopBackend();
      set({ source, status: 'loading', positionSec: 0, error: undefined, mode: undefined });
      const stale = () => get().source?.key !== source.key;
      try {
        if (source.kind === 'song') {
          // Full track for Apple Music subscribers (FR-30)…
          let appleMusicId = source.appleMusicId;
          let previewUrl = source.previewUrl;
          if (!appleMusicId || !previewUrl) {
            const match = await findOnAppleMusic(source.title, source.artist);
            appleMusicId ??= match?.appleMusicId;
            previewUrl ??= match?.previewUrl;
          }
          if (stale()) return;
          if (appleMusicId && (await canPlayFull())) {
            backend = 'musickit';
            await MusicKit.play(appleMusicId);
            MusicKit.setRepeat(get().loop);
            set({ status: 'playing', mode: 'full' });
            return;
          }
          // …otherwise the 30-second preview.
          if (!previewUrl) throw new Error("Couldn't find this song on Apple Music. Check your connection and try again.");
          backend = 'audio';
          const { durationSec } = await Audio.load({ kind: 'url', url: previewUrl }, { title: source.title, artist: source.artist });
          if (stale()) return;
          set({ durationSec, mode: 'preview' });
        } else {
          backend = 'audio';
          const native: Audio.PlayerSource =
            source.kind === 'recording' ? { kind: 'file', uri: source.uri } : { kind: 'synth', notes: source.notes };
          const { durationSec } = await Audio.load(native, { title: source.title });
          if (stale()) return;
          set({ durationSec });
        }
        Audio.setLoop(get().loop);
        Audio.setRate(get().rate);
        Audio.play();
        set({ status: 'playing' });
      } catch (e) {
        if (!stale()) set({ status: 'error', error: e instanceof Error ? e.message : 'Playback failed' });
      }
    },

    async toggle(source) {
      const { source: cur, status } = get();
      if (cur?.key === source.key && (status === 'playing' || status === 'loading')) return get().pause();
      if (cur?.key === source.key && status === 'paused') return get().resume();
      return get().play(source);
    },

    pause() {
      stopBackend();
      set({ status: 'paused' });
    },
    resume() {
      if (backend === 'musickit') MusicKit.resume().catch(() => {});
      else Audio.play();
      set({ status: 'playing' });
    },
    seek(sec) {
      const s = Math.max(0, Math.min(sec, get().durationSec || sec));
      if (backend === 'musickit') MusicKit.seek(s);
      else Audio.seek(s);
      set({ positionSec: s });
    },
    skipBack(sec = 5) {
      get().seek(get().positionSec - sec);
    },
    setLoop(loop) {
      if (backend === 'musickit') MusicKit.setRepeat(loop);
      else Audio.setLoop(loop);
      set({ loop });
    },
    setRate(rate) {
      // Apple Music plays at 1× — speed only applies to recordings and the piano (Keyboard mode).
      if (backend === 'audio') Audio.setRate(rate);
      set({ rate });
    },
    stop() {
      stopBackend();
      set({ source: undefined, status: 'idle', positionSec: 0, mode: undefined, error: undefined });
    },
  };
});

/** True when `key` is the active source and playing (or about to) — drives play/pause icons in place. */
export const useIsPlaying = (key: string) =>
  usePlayback((s) => s.source?.key === key && (s.status === 'playing' || s.status === 'loading'));

export const useProgress = (key: string) =>
  usePlayback((s) => (s.source?.key === key && s.durationSec > 0 ? s.positionSec / s.durationSec : 0));

/** Error message for `key`, if its last play attempt failed. */
export const usePlaybackError = (key: string) => usePlayback((s) => (s.source?.key === key ? s.error : undefined));

/** 'preview' while a non-subscriber hears the 30-second clip of `key` (drives the FR-30 notice). */
export const usePlaybackMode = (key: string) => usePlayback((s) => (s.source?.key === key ? s.mode : undefined));
