import { create } from 'zustand';

import { rankRecommendations } from '@/services/recommend';

import { createRepo } from './createRepo';
import type { LibraryRepo } from './repo';
import { SEED_CATALOG } from './seedCatalog';
import {
  DEFAULT_PREFS,
  type CatalogSong,
  type PickableGenre,
  type KeyboardAvailability,
  type Level,
  type Prefs,
  type Project,
  type Song,
} from './types';

interface LibraryState {
  ready: boolean;
  prefs: Prefs;
  songs: Song[];
  projects: Project[];
  /** Current "Picked for you" feed (cached for offline, FR-27). */
  feed: CatalogSong[];
  /** Catalog ids the user dismissed or said they know — excluded from the feed. */
  hidden: Set<string>;
  /** On-device Apple Music listening weights (FR-27); empty unless the user connected Apple Music. */
  genreWeights: Partial<Record<PickableGenre, number>>;
  setGenreWeights(w: Partial<Record<PickableGenre, number>>): void;

  hydrate(): Promise<void>;
  setPrefs(patch: Partial<Prefs>): void;
  setGenres(genres: PickableGenre[]): void;
  refreshFeed(): void;
  want(song: CatalogSong): Song;
  undoWant(catalogId: string): void;
  /** Takes the song off Learning / Library. Its recordings stay, unlinked, under Recordings. */
  removeSong(songId: string): void;
  dismiss(catalogId: string): void;
  markLearned(songId: string): void;
  toggleFavourite(songId: string): void;
  addProject(p: Project): void;
  updateProject(id: string, patch: Partial<Project>): void;
  deleteProject(id: string): void;
}

let repo: LibraryRepo | null = null;
const getRepo = () => (repo ??= createRepo());
/** Tests inject a repo before hydrating. */
export const __setRepo = (r: LibraryRepo) => {
  repo = r;
};

/**
 * Writes run one at a time, in the order they were made. Overlapping writes of the same project (e.g. a
 * stale "running" landing after "done") would otherwise leave the older state on disk.
 */
let writes: Promise<void> = Promise.resolve();
const persist = (fn: (r: LibraryRepo) => Promise<void>) => {
  writes = writes.then(() => fn(getRepo())).catch((e) => console.warn('[library] persist failed', e));
};
/** Resolves once every write queued so far has finished (tests, and before reading back from disk). */
export const flushWrites = () => writes;

export const useLibrary = create<LibraryState>((set, get) => ({
  ready: false,
  prefs: DEFAULT_PREFS,
  songs: [],
  projects: [],
  feed: [],
  hidden: new Set(),
  genreWeights: {},

  setGenreWeights(genreWeights) {
    set({ genreWeights });
    get().refreshFeed();
  },

  async hydrate() {
    const data = await getRepo().load();
    set({ ...data, feed: data.recoCache, ready: true });
    if (data.prefs.onboardingDone && data.recoCache.length === 0) get().refreshFeed();
  },

  setPrefs(patch) {
    const prefs = { ...get().prefs, ...patch };
    set({ prefs });
    persist((r) => r.savePrefs(prefs));
  },

  setGenres(genres) {
    get().setPrefs({ genres });
    get().refreshFeed();
  },

  refreshFeed() {
    const { prefs, songs, hidden, genreWeights } = get();
    const exclude = new Set([...hidden, ...songs.flatMap((s) => (s.catalogId ? [s.catalogId] : []))]);
    const learnedLevels = songs.flatMap((s) => (s.status === 'learned' && s.difficulty ? [s.difficulty] : []));
    const feed = rankRecommendations(SEED_CATALOG, {
      genres: prefs.genres,
      level: prefs.level,
      exclude,
      learnedLevels,
      genreWeights,
      limit: 20,
    }).map((r) => r.song);
    set({ feed });
    persist((r) => r.saveRecoCache(feed));
  },

  want(c) {
    const existing = get().songs.find((s) => s.catalogId === c.catalogId);
    if (existing) return existing;
    const song: Song = {
      id: `song-${c.catalogId}`,
      catalogId: c.catalogId,
      appleMusicId: c.appleMusicId,
      title: c.title,
      artist: c.artist,
      genre: c.genre,
      difficulty: c.difficulty,
      status: 'learning',
      addedAt: Date.now(),
      favourite: false,
      previewUrl: c.previewUrl,
      durationSec: c.durationSec,
      ...(c.midiUrl ? { midiPath: c.midiUrl } : null),
    };
    set({ songs: [...get().songs, song] });
    persist(async (r) => {
      await r.upsertSong(song);
      await r.queueFeedback(c.catalogId, 'want');
    });
    return song;
  },

  undoWant(catalogId) {
    const song = get().songs.find((s) => s.catalogId === catalogId);
    if (!song || get().projects.some((p) => p.songId === song.id)) return;
    set({ songs: get().songs.filter((s) => s.id !== song.id) });
    persist(async (r) => {
      await r.deleteSong(song.id);
      await r.queueFeedback(catalogId, 'undo_want');
    });
  },

  removeSong(songId) {
    const song = get().songs.find((s) => s.id === songId);
    if (!song) return;
    const unlinked = get()
      .projects.filter((p) => p.songId === songId)
      .map(({ songId: _songId, ...p }) => p as Project);
    const byId = new Map(unlinked.map((p) => [p.id, p]));
    set({
      songs: get().songs.filter((s) => s.id !== songId),
      projects: get().projects.map((p) => byId.get(p.id) ?? p),
    });
    persist(async (r) => {
      await r.deleteSong(songId);
      // Also clears songId in each take's manifest, so a rebuild from folders doesn't relink them.
      for (const p of unlinked) await r.upsertProject(p);
    });
    get().refreshFeed();
  },

  dismiss(catalogId) {
    const hidden = new Set(get().hidden).add(catalogId);
    set({ hidden, feed: get().feed.filter((s) => s.catalogId !== catalogId) });
    persist((r) => r.queueFeedback(catalogId, 'dismiss'));
  },

  markLearned(songId) {
    const songs = get().songs.map((s) =>
      s.id === songId ? { ...s, status: 'learned' as const, learnedAt: Date.now() } : s,
    );
    set({ songs });
    const s = songs.find((x) => x.id === songId);
    if (s) persist((r) => r.upsertSong(s));
  },

  toggleFavourite(songId) {
    const songs = get().songs.map((s) => (s.id === songId ? { ...s, favourite: !s.favourite } : s));
    set({ songs });
    const s = songs.find((x) => x.id === songId);
    if (s) persist((r) => r.upsertSong(s));
  },

  addProject(p) {
    set({ projects: [p, ...get().projects] });
    persist((r) => r.upsertProject(p));
  },

  updateProject(id, patch) {
    const before = get().projects.find((p) => p.id === id);
    if (!before) return;
    // Progress ticks are UI-only: write to disk only when a stored field actually changes.
    const changed = (Object.keys(patch) as (keyof Project)[]).some(
      (k) => k !== 'transcriptionProgress' && patch[k] !== before[k],
    );
    const updated = { ...before, ...patch, ...(changed ? { updatedAt: Date.now() } : null) };
    set({ projects: get().projects.map((p) => (p.id === id ? updated : p)) });
    if (changed) persist((r) => r.upsertProject(updated));
  },

  deleteProject(id) {
    set({ projects: get().projects.filter((p) => p.id !== id) });
    persist((r) => r.deleteProject(id));
  },
}));

// ── Derived selectors ────────────────────────────────────────────────────────────

export const takesFor = (projects: Project[], songId: string) =>
  projects.filter((p) => p.songId === songId).sort((a, b) => b.createdAt - a.createdAt);

/**
 * §6.6: Keyboard mode unlocks on notes, not on recording. Prefers the user's own notes when a take is
 * selected; otherwise the curated score for public-domain pieces, then the latest transcribed take.
 */
export function keyboardAvailability(
  song: Song,
  projects: Project[],
  preferProjectId?: string,
): KeyboardAvailability {
  const takes = takesFor(projects, song.id);
  const done = takes.filter((p) => p.transcriptionStatus === 'done');
  const preferred = preferProjectId ? done.find((p) => p.id === preferProjectId) : undefined;
  if (preferred) return { state: 'myNotes', projectId: preferred.id, createdAt: preferred.createdAt };
  if (song.midiPath) return { state: 'score', midiPath: song.midiPath };
  const latest = done[0];
  if (latest) return { state: 'myNotes', projectId: latest.id, createdAt: latest.createdAt };
  const running = takes.find((p) => p.transcriptionStatus === 'queued' || p.transcriptionStatus === 'running');
  if (running) return { state: 'onTheWay', projectId: running.id, progress: running.transcriptionProgress ?? 0 };
  return { state: 'locked' };
}

export const levelOf = (n: number): Level => Math.min(5, Math.max(1, Math.round(n))) as Level;
