import type { CatalogSong, Genre, Level } from '@/data/types';

export interface RankInput {
  genres: Genre[];
  level: Level;
  /** On-device listening weights (FR-27); only genre weights, never history items. */
  genreWeights?: Partial<Record<Genre, number>>;
  /** Catalog ids already wanted, dismissed, known, or on the learning list/library. */
  exclude: Set<string>;
  /** Difficulty of songs the user marked learned — nudges the target level up. */
  learnedLevels?: Level[];
  limit?: number;
}

export interface Ranked {
  song: CatalogSong;
  score: number;
  reason: string;
}

/**
 * Ranking v1 (ARCHITECTURE §9.1): genre match + difficulty fit + a small prior, then a diversity
 * re-rank (≤ 3 per genre and ≤ 2 per artist in the top 10). The same function runs in reco-api; the
 * app runs it locally on the seed catalog when offline or before the service exists.
 */
export function rankRecommendations(catalog: CatalogSong[], input: RankInput): Ranked[] {
  const limit = input.limit ?? 20;
  const picked = new Set(input.genres);
  const learned = input.learnedLevels ?? [];
  const target =
    input.level + (learned.length ? Math.max(0, avg(learned) - input.level) * 0.5 : 0);

  const scored = catalog
    .filter((s) => !input.exclude.has(s.catalogId))
    .map((song) => {
      const genre = picked.has(song.genre) ? 1 : (ADJACENT[song.genre] ?? []).some((g) => picked.has(g)) ? 0.6 : 0;
      const listen = input.genreWeights?.[song.genre] ?? 0;
      const fit = Math.exp(-(((song.difficulty ?? target) - target) ** 2) / 2); // Gaussian, σ = 1 level
      const score = genre * 2 + listen + fit * 1.5 + stableJitter(song.catalogId) * 0.1;
      const reason = `${genre ? 'genre' : 'adjacent'} · fit ${fit.toFixed(2)}${listen ? ` · listening ${listen.toFixed(2)}` : ''}`;
      return { song, score, reason };
    })
    .sort((a, b) => b.score - a.score);

  const out: Ranked[] = [];
  const perGenre = new Map<string, number>();
  const perArtist = new Map<string, number>();
  const deferred: Ranked[] = [];
  for (const r of scored) {
    const g = perGenre.get(r.song.genre) ?? 0;
    const a = perArtist.get(r.song.artist) ?? 0;
    if (out.length < 10 && (g >= 3 || a >= 2)) {
      deferred.push(r);
      continue;
    }
    out.push(r);
    perGenre.set(r.song.genre, g + 1);
    perArtist.set(r.song.artist, a + 1);
    if (out.length >= limit) break;
  }
  for (const r of deferred) {
    if (out.length >= limit) break;
    out.push(r);
  }
  return out;
}

function avg(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Deterministic 0–1 value per id so ties don't reshuffle on every render. */
function stableJitter(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

/** Catalog-only genres count as a partial match when a neighbouring pickable genre is chosen. */
const ADJACENT: Partial<Record<Genre, Genre[]>> = {
  Contemporary: ['Classical', 'Film & TV', 'Lo-fi'],
  Indie: ['Pop', 'Rock', 'Lo-fi'],
};
