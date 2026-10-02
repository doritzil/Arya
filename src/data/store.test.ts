import { createMemoryRepo } from './memoryRepo';
import { SEED_CATALOG } from './seedCatalog';
import { __setRepo, flushWrites, keyboardAvailability, useLibrary } from './store';
import type { Project, Song } from './types';

const hello = SEED_CATALOG.find((s) => s.title === 'Hello')!;
const gymno = SEED_CATALOG.find((s) => s.title === 'Gymnopédie No. 1')!;

beforeEach(async () => {
  __setRepo(createMemoryRepo());
  useLibrary.setState({ ready: false, songs: [], projects: [], feed: [], hidden: new Set() });
  await useLibrary.getState().hydrate();
  useLibrary.getState().setPrefs({ onboardingDone: true, genres: ['Rock', 'Classical', 'Pop'] });
});

const take = (song: Song, status: Project['transcriptionStatus'], at: number, id = `p${at}`): Project => ({
  id,
  kind: 'song',
  songId: song.id,
  name: `${song.title} — take`,
  createdAt: at,
  updatedAt: at,
  durationSec: 60,
  transcriptionStatus: status,
  hasEdits: false,
});

describe('learning loop', () => {
  it('moves recommended → learning → learned in one tap each (FR-36)', () => {
    const s = useLibrary.getState();
    s.refreshFeed();
    const first = useLibrary.getState().feed[0]!;
    const song = s.want(first);
    expect(useLibrary.getState().songs.find((x) => x.id === song.id)?.status).toBe('learning');
    s.refreshFeed();
    expect(useLibrary.getState().feed.some((x) => x.catalogId === first.catalogId)).toBe(false);
    s.markLearned(song.id);
    expect(useLibrary.getState().songs.find((x) => x.id === song.id)?.status).toBe('learned');
  });

  it('undoes Want to learn, and dismiss removes a card for good', () => {
    const s = useLibrary.getState();
    s.want(hello);
    s.undoWant(hello.catalogId);
    expect(useLibrary.getState().songs).toHaveLength(0);
    s.dismiss(gymno.catalogId);
    s.refreshFeed();
    expect(useLibrary.getState().feed.some((x) => x.catalogId === gymno.catalogId)).toBe(false);
  });
});

describe('keyboardAvailability (§6.6)', () => {
  it('is locked until a take has notes, then unlocks from the latest transcribed take', () => {
    const song = useLibrary.getState().want(hello);
    expect(keyboardAvailability(song, []).state).toBe('locked');
    expect(keyboardAvailability(song, [take(song, 'none', 1)]).state).toBe('locked');
    const running = { ...take(song, 'running', 2), transcriptionProgress: 0.4 };
    expect(keyboardAvailability(song, [running])).toEqual({ state: 'onTheWay', projectId: running.id, progress: 0.4 });
    const done = take(song, 'done', 3);
    expect(keyboardAvailability(song, [running, done, take(song, 'done', 1, 'old')])).toMatchObject({ state: 'myNotes', projectId: done.id });
  });

  it('unlocks public-domain pieces from the curated score, unless a take is chosen', () => {
    const song = useLibrary.getState().want(gymno);
    expect(keyboardAvailability(song, [])).toEqual({ state: 'score', catalogId: gymno.catalogId });
    const done = take(song, 'done', 5);
    expect(keyboardAvailability(song, [done], done.id).state).toBe('myNotes');
  });
  it('keeps pieces without a curated score locked (no placeholder notes)', () => {
    const canon = SEED_CATALOG.find((s) => s.title === 'Canon in D')!;
    expect(canon.midiUrl).toBeUndefined();
    expect(keyboardAvailability(useLibrary.getState().want(canon), []).state).toBe('locked');
  });
});

describe('project writes', () => {
  it('keeps "done" on disk when an earlier write is slower (no stale "running")', async () => {
    const base = createMemoryRepo();
    const saved: string[] = [];
    // The first write is slow; unserialized, it would land last and leave "running" on disk.
    let delay = 30;
    __setRepo({
      ...base,
      async upsertProject(p) {
        const d = delay;
        delay = 0;
        await new Promise((r) => setTimeout(r, d));
        saved.push(p.transcriptionStatus);
      },
    });
    const song = useLibrary.getState().want(hello);
    useLibrary.getState().addProject(take(song, 'queued', 1, 'w1'));
    useLibrary.getState().updateProject('w1', { transcriptionStatus: 'running', transcriptionProgress: 0.1 });
    useLibrary.getState().updateProject('w1', { transcriptionStatus: 'running', transcriptionProgress: 0.6 });
    useLibrary.getState().updateProject('w1', { transcriptionStatus: 'done', transcriptionProgress: 1 });
    await flushWrites();
    // Progress-only ticks aren't written; order is preserved.
    expect(saved).toEqual(['queued', 'running', 'done']);
  });
});

describe('removeSong', () => {
  it('takes the song off the list and keeps its recordings, unlinked', async () => {
    const song = useLibrary.getState().want(hello);
    useLibrary.getState().addProject(take(song, 'done', 5, 'r1'));
    useLibrary.getState().removeSong(song.id);
    const { songs, projects } = useLibrary.getState();
    expect(songs.some((s) => s.id === song.id)).toBe(false);
    const kept = projects.find((p) => p.id === 'r1');
    expect(kept).toBeDefined();
    expect(kept?.songId).toBeUndefined();
    await flushWrites();
  });
});
