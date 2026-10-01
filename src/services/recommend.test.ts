import { SEED_CATALOG } from '@/data/seedCatalog';
import { GENRES } from '@/data/types';

import { rankRecommendations } from './recommend';

describe('rankRecommendations', () => {
  it('returns at least 10 picks for any 3 genres (v1 success criterion)', () => {
    for (let i = 0; i < GENRES.length; i++) {
      const genres = [GENRES[i]!, GENRES[(i + 4) % GENRES.length]!, GENRES[(i + 8) % GENRES.length]!];
      const out = rankRecommendations(SEED_CATALOG, { genres, level: 2, exclude: new Set() });
      expect(out.length).toBeGreaterThanOrEqual(10);
    }
  });

  it('puts chosen genres first and respects the top-10 diversity caps', () => {
    const out = rankRecommendations(SEED_CATALOG, { genres: ['Classical', 'Jazz', 'Pop'], level: 3, exclude: new Set() });
    const top = out.slice(0, 10);
    expect(top.every((r) => ['Classical', 'Jazz', 'Pop', 'Contemporary', 'Indie'].includes(r.song.genre))).toBe(true);
    const perGenre = new Map<string, number>();
    const perArtist = new Map<string, number>();
    for (const r of top) {
      perGenre.set(r.song.genre, (perGenre.get(r.song.genre) ?? 0) + 1);
      perArtist.set(r.song.artist, (perArtist.get(r.song.artist) ?? 0) + 1);
    }
    expect(Math.max(...perGenre.values())).toBeLessThanOrEqual(3);
    expect(Math.max(...perArtist.values())).toBeLessThanOrEqual(2);
  });

  it('never returns excluded songs and prefers difficulties near the level', () => {
    const exclude = new Set(SEED_CATALOG.slice(0, 5).map((s) => s.catalogId));
    const out = rankRecommendations(SEED_CATALOG, { genres: ['Classical', 'Film & TV', 'Worship'], level: 1, exclude });
    expect(out.some((r) => exclude.has(r.song.catalogId))).toBe(false);
    const avg = out.slice(0, 10).reduce((a, r) => a + (r.song.difficulty ?? 0), 0) / 10;
    expect(avg).toBeLessThan(2.5);
  });
});
