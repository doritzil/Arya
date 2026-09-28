/**
 * Real audio for the JS fallback (Expo Go, web) so previews are audible before a dev build exists.
 * Uses expo-audio, which ships in Expo Go. The dev/production build never reaches this file: there the
 * Swift module owns the audio session (ARCHITECTURE D5), and expo-audio stays dormant.
 */
import type { AudioPlayer } from 'expo-audio';

type ExpoAudio = typeof import('expo-audio');

let audio: ExpoAudio | null | undefined;
function lib(): ExpoAudio | null {
  if (audio !== undefined) return audio;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    audio = require('expo-audio') as ExpoAudio;
    // Play even with the ring/silent switch on — this is a music app.
    audio.setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  } catch {
    audio = null; // Jest / environments without the module
  }
  return audio;
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

export function createFallbackSound(url: string): FallbackSound | null {
  const a = lib();
  if (!a) return null;
  let player: AudioPlayer;
  try {
    player = a.createAudioPlayer({ uri: url });
  } catch {
    return null;
  }
  return {
    play: () => player.play(),
    pause: () => player.pause(),
    seek: (sec) => {
      player.seekTo(sec).catch(() => {});
    },
    setRate: (rate) => player.setPlaybackRate(rate),
    setLoop: (on) => {
      player.loop = on;
    },
    duration: () => (player.duration > 0 ? player.duration : undefined),
    remove: () => player.remove(),
  };
}
