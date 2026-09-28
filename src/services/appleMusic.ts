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
