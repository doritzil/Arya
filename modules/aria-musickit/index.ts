/**
 * aria-musickit — Apple Music via MusicKit (ARCHITECTURE.md §8.2): authorization, subscription check,
 * full-track playback with ApplicationMusicPlayer, on-device listening → genre weights.
 * Falls back to a JS mock (`isNative` === false). `configureMock` lets the web preview flip subscriber state.
 */
import AriaMusicKit, { isNative } from './src/AriaMusicKitModule';
import type {
  AriaMusicKitEvents,
  MusicAuthorization,
  Subscription,
  SubscriptionInfo,
} from './src/AriaMusicKit.types';
import type { AriaMusicKitMock } from './src/mock';

export * from './src/AriaMusicKit.types';
export { isNative };

export const requestAuthorization = (): Promise<MusicAuthorization> => AriaMusicKit.requestAuthorization();
export const authorizationStatus = (): MusicAuthorization => AriaMusicKit.authorizationStatus();
export const subscription = (): Promise<SubscriptionInfo> => AriaMusicKit.subscription();
export const play = (appleMusicId: string): Promise<void> => AriaMusicKit.play(appleMusicId);
export const resume = (): Promise<void> => AriaMusicKit.resume();
export const pause = (): void => AriaMusicKit.pause();
export const stop = (): void => AriaMusicKit.stop();
export const seek = (sec: number): void => AriaMusicKit.seek(sec);
export const setRepeat = (on: boolean): void => AriaMusicKit.setRepeat(on);
export const listeningGenreWeights = (): Promise<Record<string, number>> => AriaMusicKit.listeningGenreWeights();
export const openInAppleMusic = (appleMusicId: string): void => AriaMusicKit.openInAppleMusic(appleMusicId);

export function addListener<K extends keyof AriaMusicKitEvents>(
  event: K,
  cb: (payload: AriaMusicKitEvents[K]) => void,
): Subscription {
  return AriaMusicKit.addListener(event, cb);
}

/** Mock only (no-op natively): simulate subscriber / authorization states in the web preview and tests. */
export function configureMock(opts: Parameters<AriaMusicKitMock['configureMock']>[0]): void {
  if (!isNative) (AriaMusicKit as AriaMusicKitMock).configureMock(opts);
}
