/**
 * Real audio for the JS fallback (Expo Go, web) so previews are audible before a dev build exists.
 * Uses expo-audio, which ships in Expo Go. The dev/production build never reaches this file: there the
 * Swift module owns the audio session (ARCHITECTURE D5), and expo-audio stays dormant.
 */
import type { AudioPlayer, AudioStatus } from 'expo-audio';

type ExpoAudio = typeof import('expo-audio');

let audio: ExpoAudio | null | undefined;
let modeReady: Promise<void> | null = null;

function lib(): ExpoAudio | null {
  if (audio !== undefined) return audio;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    audio = require('expo-audio') as ExpoAudio;
  } catch {
    audio = null; // Jest / environments without the module
  }
  return audio;
}

/**
 * iOS: the default audio session category is muted by the ring/silent switch. Switch to playback
 * (plays in silent mode) and activate the session — and wait for it, or the first preview starts muted.
 */
function ensureAudioMode(a: ExpoAudio): Promise<void> {
  modeReady ??= a
    .setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'doNotMix', shouldPlayInBackground: false })
    .then(() => a.setIsAudioActiveAsync(true))
    .catch((e: unknown) => {
      modeReady = null; // retry next time
      console.warn('[aria-audio] could not set audio mode', e);
    });
  return modeReady;
}

export interface FallbackSound {
  play(): void;
  pause(): void;
  seek(sec: number): void;
  setRate(rate: number): void;
  setLoop(on: boolean): void;
  /** Real duration once the stream has loaded, else undefined. */
  duration(): number | undefined;
  remove(): void;
}

const LOAD_TIMEOUT_MS = 12_000;

/**
 * Creates a player for `url`. `onError` fires if the stream fails or never loads, so the UI can say so
 * instead of running a silent clock. Returns null when no audio library is available (Jest).
 */
export async function createFallbackSound(url: string, onError: (message: string) => void): Promise<FallbackSound | null> {
  const a = lib();
  if (!a) return null;
  await ensureAudioMode(a);
  let player: AudioPlayer;
  try {
    player = a.createAudioPlayer({ uri: url });
  } catch (e) {
    onError(`Couldn't open the preview (${e instanceof Error ? e.message : 'unknown error'}).`);
    return null;
  }
  let failed = false;
  const fail = (message: string) => {
    if (failed) return;
    failed = true;
    onError(message);
  };
  const sub = player.addListener('playbackStatusUpdate', (s: AudioStatus & { error?: string }) => {
    // iOS reports AVPlayerItem.status as playbackState 'failed'; web reports an `error` string.
    if (s.playbackState === 'failed' || s.error) fail("The preview couldn't be played. Try another song, or try again later.");
  });
  const timer = setTimeout(() => {
    if (!player.isLoaded) fail("The preview didn't load. Check your connection and try again.");
  }, LOAD_TIMEOUT_MS);

  return {
    play: () => {
      ensureAudioMode(a).then(() => player.play());
    },
    pause: () => player.pause(),
    seek: (sec) => {
      // Seeking before the stream is ready is ignored by AVPlayer anyway; skip the no-op at 0.
      if (sec > 0 || player.currentTime > 0) player.seekTo(sec).catch(() => {});
    },
    setRate: (rate) => player.setPlaybackRate(rate),
    setLoop: (on) => {
      player.loop = on;
    },
    duration: () => (player.duration > 0 ? player.duration : undefined),
    remove: () => {
      clearTimeout(timer);
      sub.remove();
      player.remove();
    },
  };
}
