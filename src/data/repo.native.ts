/**
 * Native LibraryRepo: SQLite index (sqliteRepo) + project folders as source of truth (projectStore).
 *
 * - The SQLite connection opens lazily on first use, so `createRepo()` stays synchronous.
 * - First launch / empty or deleted DB: the projects index is rebuilt from Projects/*\/manifest.json.
 * - upsertProject mirrors the change into manifest.json (creating the folder if needed), so a later
 *   rebuild never reverts it; deleteProject removes the folder too.
 */
import type { LibraryRepo } from './repo';
import { deleteProjectDir, projectDirUri, rebuildIndex, syncProjectToFolder } from './projectStore';
import { createSqliteRepo, type SqliteLibraryRepo } from './sqliteRepo';

let shared: Promise<SqliteLibraryRepo> | null = null;

/** The underlying SQLite repo (search, feedback outbox, rebuild). Opens + migrates on first call. */
export function getSqliteRepo(): Promise<SqliteLibraryRepo> {
  if (!shared) {
    shared = (async () => {
      const repo = await createSqliteRepo({ folderPathFor: projectDirUri });
      const row = await repo.raw.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM projects');
      if ((row?.n ?? 0) === 0) {
        // Fresh or lost DB: folders are the truth. Cheap when there are none.
        await rebuildIndex(repo).catch((e: unknown) => console.warn('[repo] index rebuild failed', e));
      }
      return repo;
    })();
    shared.catch(() => {
      shared = null; // allow a retry after a failed open
    });
  }
  return shared;
}

export function createRepo(): LibraryRepo {
  const db = getSqliteRepo;
  return {
    load: async () => (await db()).load(),
    savePrefs: async (prefs) => (await db()).savePrefs(prefs),
    upsertSong: async (song) => (await db()).upsertSong(song),
    deleteSong: async (id) => (await db()).deleteSong(id),
    upsertProject: async (project) => {
      await syncProjectToFolder(project);
      await (await db()).upsertProject(project);
    },
    deleteProject: async (id) => {
      await (await db()).deleteProject(id);
      deleteProjectDir(id);
    },
    saveRecoCache: async (songs) => (await db()).saveRecoCache(songs),
    queueFeedback: async (catalogId, action) => (await db()).queueFeedback(catalogId, action),
  };
}
