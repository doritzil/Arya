import type { CatalogSong } from '@/data/types';

import { toAriaGenre } from './listening';

/**
 * Finds a song on Apple Music: its catalog id (for full playback via MusicKit) and the 30-second preview
 * URL (for everyone else, FR-30). Uses Apple's public iTunes Search API — no key, no sign-in — until
 * reco-api returns these with the catalog (ARCHITECTURE §9). Results are cached for the session.
 */
export interface AppleMusicMatch {
  appleMusicId: string;
  previewUrl?: string;
  durationSec?: number;
  trackName: string;
  artistName: string;
}

interface ItunesTrack {
  trackId: number;
  trackName: string;
  artistName: string;
  previewUrl?: string;
  trackTimeMillis?: number;
  primaryGenreName?: string;
  artworkUrl100?: string;
}

const cache = new Map<string, Promise<AppleMusicMatch | null>>();

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Words of the artist that should appear in Apple's artist name ("Debussy" ⊂ "Claude Debussy & …"). */
function artistMatches(wanted: string, found: string) {
  const f = norm(found);
  return norm(wanted)
    .split(' ')
    .filter((w) => w.length > 2 && !['the', 'and', 'attr'].includes(w))
    .some((w) => f.includes(w));
}

export function findOnAppleMusic(title: string, artist: string, country = 'US'): Promise<AppleMusicMatch | null> {
  const key = `${country}|${norm(title)}|${norm(artist)}`;
  let hit = cache.get(key);
  if (!hit) {
    hit = search(title, artist, country).catch(() => null);
    cache.set(key, hit);
    // Don't cache failures forever (e.g. offline) — retry on the next tap.
    hit.then((r) => r ?? cache.delete(key));
  }
  return hit;
}

async function search(title: string, artist: string, country: string): Promise<AppleMusicMatch | null> {
  const term = encodeURIComponent(`${title} ${artist}`);
  const url = `https://itunes.apple.com/search?term=${term}&media=music&entity=song&limit=10&country=${country}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = (await res.json()) as { results?: ItunesTrack[] };
  const tracks = (json.results ?? []).filter((t) => t.previewUrl);
  const t = norm(title);
  const best =
    tracks.find((r) => norm(r.trackName).startsWith(t) && artistMatches(artist, r.artistName)) ??
    tracks.find((r) => artistMatches(artist, r.artistName)) ??
    tracks.find((r) => norm(r.trackName).includes(t)) ??
    tracks[0];
  if (!best) return null;
  return {
    appleMusicId: String(best.trackId),
    previewUrl: best.previewUrl,
    durationSec: best.trackTimeMillis ? best.trackTimeMillis / 1000 : undefined,
    trackName: best.trackName,
    artistName: best.artistName,
  };
}

/** The device's App Store country (from its locale), so results and previews match the user's storefront. */
export function storefrontCountry(): string {
  try {
    const region = new Intl.Locale(Intl.DateTimeFormat().resolvedOptions().locale).maximize().region;
    if (region && /^[A-Z]{2}$/.test(region)) return region;
  } catch {
    // older engines without Intl.Locale
  }
  return 'US';
}

/** Words with diacritics and punctuation removed — used to spot the same song in two places. */
export const songKey = (title: string, artist: string) => `${norm(title)}|${norm(artist)}`;

/**
 * Free-text search of the Apple Music catalog (songs only), for the Discover search screen. Returns
 * cards ready to play (preview URL + Apple Music id) and add to Learning. Versions of the same song by
 * the same artist (live, remaster, single) collapse to the first. No difficulty: Aria can't rate these yet.
 * Throws on network errors so the screen can say it's offline.
 */
export async function searchAppleMusic(term: string, opts: { country?: string; limit?: number; signal?: AbortSignal } = {}): Promise<CatalogSong[]> {
  const country = opts.country ?? storefrontCountry();
  const url =
    `https://itunes.apple.com/search?term=${encodeURIComponent(term)}` +
    `&media=music&entity=song&limit=${opts.limit ?? 25}&country=${country}`;
  const res = await fetch(url, { signal: opts.signal });
  if (!res.ok) throw new Error(`Apple Music search failed (${res.status})`);
  const json = (await res.json()) as { results?: ItunesTrack[] };
  const seen = new Set<string>();
  const out: CatalogSong[] = [];
  for (const t of json.results ?? []) {
    if (!t.trackId || !t.trackName || !t.artistName) continue;
    const base = t.trackName.replace(/\s*[([](live|remaster(ed)?|single|radio edit|.*version|.*mix)[^)\]]*[)\]]/gi, '').trim();
    const key = songKey(base || t.trackName, t.artistName);
    if (seen.has(key)) continue;
    seen.add(key);
    const appleMusicId = String(t.trackId);
    // Seed the playback lookup so tapping play doesn't search again.
    if (t.previewUrl) {
      cache.set(`${country}|${norm(t.trackName)}|${norm(t.artistName)}`, Promise.resolve({
        appleMusicId,
        previewUrl: t.previewUrl,
        durationSec: t.trackTimeMillis ? t.trackTimeMillis / 1000 : undefined,
        trackName: t.trackName,
        artistName: t.artistName,
      }));
    }
    out.push({
      catalogId: `am-${appleMusicId}`,
      appleMusicId,
      title: t.trackName,
      artist: t.artistName,
      genre: toAriaGenre(t.primaryGenreName) ?? 'Pop',
      ...(t.previewUrl ? { previewUrl: t.previewUrl } : null),
      ...(t.trackTimeMillis ? { durationSec: Math.round(t.trackTimeMillis / 1000) } : null),
    });
  }
  return out;
}
