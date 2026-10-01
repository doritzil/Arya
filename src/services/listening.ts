import * as MusicKit from '@modules/aria-musickit';

import type { PickableGenre } from '@/data/types';

/**
 * FR-27: the user's Apple Music listening → weights over Aria's genres. MusicKit reduces recently played +
 * heavy rotation to Apple genre names on the device; only these weights are ever used (NFR-2).
 */
const APPLE_TO_ARIA: Record<string, PickableGenre> = {
  pop: 'Pop',
  'k-pop': 'K-pop',
  'j-pop': 'Anime',
  anime: 'Anime',
  classical: 'Classical',
  'classical crossover': 'Classical',
  soundtrack: 'Film & TV',
  'original score': 'Film & TV',
  'tv soundtrack': 'Film & TV',
  musicals: 'Musicals',
  'musical theater': 'Musicals',
  broadway: 'Musicals',
  jazz: 'Jazz',
  'r&b/soul': 'R&B',
  'r&b': 'R&B',
  soul: 'R&B',
  'hip-hop/rap': 'R&B',
  rock: 'Rock',
  alternative: 'Rock',
  'hard rock': 'Rock',
  indie: 'Rock',
  'singer/songwriter': 'Pop',
  'video game': 'Video games',
  'video games': 'Video games',
  electronic: 'Lo-fi',
  'lo-fi': 'Lo-fi',
  chill: 'Lo-fi',
  ambient: 'Lo-fi',
  'christian & gospel': 'Worship',
  christian: 'Worship',
  gospel: 'Worship',
  worship: 'Worship',
};

/** Apple's genre name (e.g. "Soundtrack") → Aria's genre, if there's a sensible one. */
export const toAriaGenre = (appleGenre: string | undefined): PickableGenre | undefined =>
  appleGenre ? APPLE_TO_ARIA[appleGenre.toLowerCase()] : undefined;

export type ConnectResult =
  | { ok: true; weights: Partial<Record<PickableGenre, number>> }
  | { ok: false; reason: 'unavailable' | 'denied' };

/** Asks for Apple Music access and returns listening weights. `unavailable` = no MusicKit in this build. */
export async function connectAppleMusic(): Promise<ConnectResult> {
  if (!MusicKit.isNative) return { ok: false, reason: 'unavailable' };
  const status = await MusicKit.requestAuthorization().catch(() => 'denied' as const);
  if (status !== 'authorized') return { ok: false, reason: 'denied' };
  return { ok: true, weights: await listeningWeights() };
}

export async function listeningWeights(): Promise<Partial<Record<PickableGenre, number>>> {
  if (!MusicKit.isNative || MusicKit.authorizationStatus() !== 'authorized') return {};
  const raw = await MusicKit.listeningGenreWeights().catch(() => ({}) as Record<string, number>);
  const out: Partial<Record<PickableGenre, number>> = {};
  for (const [genre, w] of Object.entries(raw)) {
    const g = APPLE_TO_ARIA[genre.toLowerCase()];
    if (g) out[g] = (out[g] ?? 0) + w;
  }
  return out;
}
