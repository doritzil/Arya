import type { LibraryRepo } from './repo';
import { SEED_CATALOG } from './seedCatalog';
import { DEFAULT_PREFS, type CatalogSong, type Prefs, type Project, type Song } from './types';

/** In-memory repo for the web preview and tests. `demo` pre-fills the state shown in the designs. */
export function createMemoryRepo({ demo = false }: { demo?: boolean } = {}): LibraryRepo {
  let prefs: Prefs = demo
    ? { ...DEFAULT_PREFS, onboardingDone: true, genres: ['Classical', 'Film & TV', 'Pop', 'Rock'], level: 3 }
    : { ...DEFAULT_PREFS };
  const songs = new Map<string, Song>();
  const projects = new Map<string, Project>();
  let recoCache: CatalogSong[] = [];
  if (demo) for (const s of demoSongs()) songs.set(s.id, s);
  if (demo) for (const p of demoProjects()) projects.set(p.id, p);

  return {
    async load() {
      return { prefs, songs: [...songs.values()], projects: [...projects.values()], recoCache };
    },
    async savePrefs(p) {
      prefs = p;
    },
    async upsertSong(s) {
      songs.set(s.id, s);
    },
    async deleteSong(id) {
      songs.delete(id);
    },
    async upsertProject(p) {
      projects.set(p.id, p);
    },
    async deleteProject(id) {
      projects.delete(id);
    },
    async saveRecoCache(c) {
      recoCache = c;
    },
    async queueFeedback() {},
  };
}

const DAY = 86_400_000;
const at = (month: number, day: number, h = 16, m = 12) => new Date(2026, month - 1, day, h, m).getTime();

function fromCatalog(title: string, extra: Partial<Song>): Song {
  const c = SEED_CATALOG.find((s) => s.title === title);
  if (!c) throw new Error(`demo song missing: ${title}`);
  return {
    id: `song-${c.catalogId}`,
    catalogId: c.catalogId,
    title: c.title,
    artist: c.artist,
    genre: c.genre,
    difficulty: c.difficulty,
    status: 'learning',
    addedAt: Date.now() - DAY,
    favourite: false,
    durationSec: 302,
    ...(c.midiUrl ? { midiPath: c.midiUrl } : null),
    ...extra,
  };
}

function demoSongs(): Song[] {
  return [
    fromCatalog('River Flows in You', { addedAt: Date.now() - 60_000 }),
    fromCatalog('Married Life', { addedAt: at(9, 20) }),
    fromCatalog("Comptine d'un autre été", { addedAt: at(9, 18) }),
    fromCatalog('Nuvole Bianche', { addedAt: at(9, 12), favourite: true }),
    fromCatalog('Hello', { addedAt: at(9, 27) }),
    fromCatalog('Kiss the Rain', { addedAt: at(9, 26) }),
    fromCatalog('Canon in D', { status: 'learned', addedAt: at(8, 2), learnedAt: at(9, 1) }),
  ];
}

function project(p: Partial<Project> & Pick<Project, 'id' | 'name' | 'createdAt'>): Project {
  return { kind: 'song', updatedAt: p.createdAt, durationSec: 302, transcriptionStatus: 'done', hasEdits: false, ...p };
}

function demoProjects(): Project[] {
  const id = (t: string) => `song-${SEED_CATALOG.find((s) => s.title === t)?.catalogId}`;
  return [
    project({ id: 'p-nb-3', songId: id('Nuvole Bianche'), name: 'Nuvole Bianche — Sep 24, 2026 · 4:12 PM', createdAt: at(9, 24) }),
    project({ id: 'p-nb-2', songId: id('Nuvole Bianche'), name: 'Nuvole Bianche — Sep 19, 2026 · 5:40 PM', createdAt: at(9, 19, 17, 40), durationSec: 288 }),
    project({ id: 'p-nb-1', songId: id('Nuvole Bianche'), name: 'Nuvole Bianche — Sep 13, 2026 · 6:02 PM', createdAt: at(9, 13, 18, 2), durationSec: 271, transcriptionStatus: 'none' }),
    project({ id: 'p-ml-2', songId: id('Married Life'), name: 'Married Life — Sep 22, 2026 · 7:15 PM', createdAt: at(9, 22, 19, 15), durationSec: 142 }),
    project({ id: 'p-ml-1', songId: id('Married Life'), name: 'Married Life — Sep 21, 2026 · 8:01 PM', createdAt: at(9, 21, 20, 1), durationSec: 150 }),
    project({ id: 'p-comp-1', songId: id("Comptine d'un autre été"), name: "Comptine d'un autre été — Sep 20, 2026 · 6:30 PM", createdAt: at(9, 20, 18, 30), durationSec: 135 }),
    project({ id: 'p-idea-1', kind: 'idea', name: 'Rainy Sunday — Sep 23, 2026 · 8:05 PM', createdAt: at(9, 23, 20, 5), durationSec: 88 }),
    project({ id: 'p-idea-2', kind: 'idea', name: 'Chords for the chorus — Sep 18, 2026 · 9:47 PM', createdAt: at(9, 18, 21, 47), durationSec: 64, transcriptionStatus: 'none' }),
  ];
}
