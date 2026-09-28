import { createMemoryRepo } from './memoryRepo';
import { SEED_CATALOG } from './seedCatalog';
import { __setRepo, keyboardAvailability, useLibrary } from './store';
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
    expect(keyboardAvailability(song, [])).toEqual({ state: 'score', midiPath: gymno.midiUrl });
    const done = take(song, 'done', 5);
    expect(keyboardAvailability(song, [done], done.id).state).toBe('myNotes');
  });
});
