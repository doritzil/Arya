/**
 * `LibraryRepo` on SQLite (expo-sqlite + Drizzle). This is the index/app-state half of persistence;
 * project folders (projectStore.ts) stay the source of truth for recordings — see repo.native.ts, which
 * composes the two.
 */
import { asc, eq, inArray, isNull } from 'drizzle-orm';
import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { migrate } from './migrations';
import type { LibraryRepo } from './repo';
import * as schema from './schema';
import { DEFAULT_PREFS, type CatalogSong, type Prefs, type Project, type RecommendationAction, type Song } from './types';

export const DB_NAME = 'aria.db';

export interface PendingFeedback {
  id: number;
  catalogId: string;
  action: RecommendationAction;
  at: number;
}

/** LibraryRepo plus native-only extras (search, feedback outbox, index maintenance). */
export interface SqliteLibraryRepo extends LibraryRepo {
  readonly db: ExpoSQLiteDatabase<typeof schema>;
  readonly raw: SQLiteDatabase;
  /** FTS5 search over project names and their song title/artist; returns project ids, best match first. */
  searchProjects(query: string, limit?: number): Promise<string[]>;
  pendingFeedback(limit?: number): Promise<PendingFeedback[]>;
  markFeedbackSent(ids: number[]): Promise<void>;
  /** Replace the whole projects index (used by projectStore.rebuildIndex). */
  replaceProjects(projects: Project[]): Promise<void>;
  recoCacheFetchedAt(): Promise<number | null>;
  close(): Promise<void>;
}

export interface SqliteRepoOptions {
  /** file:// URI of a project's folder — stored in `projects.folder_path`. */
  folderPathFor: (projectId: string) => string;
  /** Defaults to aria.db in the app's SQLite directory. */
  databaseName?: string;
  /** Pass an already-open database (tests). */
  database?: SQLiteDatabase;
}

export async function openAriaDatabase(name = DB_NAME): Promise<SQLiteDatabase> {
  // enableChangeListener lets drizzle's useLiveQuery re-run when tables change (§4).
  const db = await openDatabaseAsync(name, { enableChangeListener: true });
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA synchronous = NORMAL;');
  await migrate(db);
  return db;
}

// ---- row mapping ----

const undef = <T>(v: T | null): T | undefined => (v == null ? undefined : v);

function songFromRow(r: schema.SongRow): Song {
  const s: Song = {
    id: r.id,
    title: r.title,
    artist: r.artist,
    genre: r.genre,
    difficulty: r.difficulty,
    status: r.status,
    addedAt: r.addedAt,
    favourite: r.favourite,
  };
  const catalogId = undef(r.catalogId);
  const appleMusicId = undef(r.appleMusicId);
  const learnedAt = undef(r.learnedAt);
  const previewUrl = undef(r.previewUrl);
  const durationSec = undef(r.durationSec);
  const midiPath = undef(r.midiPath);
  if (catalogId !== undefined) s.catalogId = catalogId;
  if (appleMusicId !== undefined) s.appleMusicId = appleMusicId;
  if (learnedAt !== undefined) s.learnedAt = learnedAt;
  if (previewUrl !== undefined) s.previewUrl = previewUrl;
  if (durationSec !== undefined) s.durationSec = durationSec;
  if (midiPath !== undefined) s.midiPath = midiPath;
  return s;
}

function songToRow(s: Song): typeof schema.songs.$inferInsert {
  return {
    id: s.id,
    appleMusicId: s.appleMusicId ?? null,
    catalogId: s.catalogId ?? null,
    title: s.title,
    artist: s.artist,
    genre: s.genre,
    difficulty: s.difficulty,
    status: s.status,
    addedAt: s.addedAt,
    learnedAt: s.learnedAt ?? null,
    favourite: s.favourite,
    previewUrl: s.previewUrl ?? null,
    durationSec: s.durationSec ?? null,
    midiPath: s.midiPath ?? null,
  };
}

export function projectFromRow(r: schema.ProjectRow): Project {
  const p: Project = {
    id: r.id,
    kind: r.kind,
    name: r.name,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    durationSec: r.durationSec,
    transcriptionStatus: r.transcriptionStatus,
    hasEdits: r.hasEdits,
  };
  if (r.songId != null) p.songId = r.songId;
  return p;
}

function projectToRow(p: Project, folderPath: string): typeof schema.projects.$inferInsert {
  return {
    id: p.id,
    kind: p.kind,
    songId: p.songId ?? null,
    name: p.name,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    durationSec: p.durationSec,
    transcriptionStatus: p.transcriptionStatus,
    hasEdits: p.hasEdits,
    folderPath,
  };
}

/** FTS5 query from user text: each word as a quoted prefix term, AND-ed. */
export function ftsQuery(text: string): string | null {
  const terms = text
    .normalize('NFKC')
    .split(/\s+/)
    .map((t) => t.replace(/"/g, '').trim())
    .filter(Boolean);
  if (terms.length === 0) return null;
  return terms.map((t) => `"${t}"*`).join(' ');
}

export async function createSqliteRepo(opts: SqliteRepoOptions): Promise<SqliteLibraryRepo> {
  const raw = opts.database ?? (await openAriaDatabase(opts.databaseName));
  const db = drizzle(raw, { schema });

  const upsertProjectRow = (p: Project) => {
    const row = projectToRow(p, opts.folderPathFor(p.id));
    const { id: _id, ...set } = row;
    return db.insert(schema.projects).values(row).onConflictDoUpdate({ target: schema.projects.id, set });
  };

  const repo: SqliteLibraryRepo = {
    db,
    raw,

    async load() {
      const [prefRows, songRows, projectRows, recoRows] = await Promise.all([
        db.select().from(schema.prefs),
        db.select().from(schema.songs),
        db.select().from(schema.projects).orderBy(asc(schema.projects.createdAt)),
        db.select().from(schema.recoCache).orderBy(asc(schema.recoCache.rank)),
      ]);
      const stored: Record<string, unknown> = {};
      for (const r of prefRows) stored[r.key] = r.value;
      const prefs = { ...DEFAULT_PREFS, ...(stored as Partial<Prefs>) };
      return {
        prefs,
        songs: songRows.map(songFromRow),
        projects: projectRows.map(projectFromRow),
        recoCache: recoRows.map((r) => r.payload as CatalogSong),
      };
    },

    async savePrefs(p) {
      db.transaction((tx) => {
        for (const [key, value] of Object.entries(p)) {
          tx.insert(schema.prefs)
            .values({ key, value })
            .onConflictDoUpdate({ target: schema.prefs.key, set: { value } })
            .run();
        }
      });
    },

    async upsertSong(s) {
      const row = songToRow(s);
      const { id: _id, ...set } = row;
      await db.insert(schema.songs).values(row).onConflictDoUpdate({ target: schema.songs.id, set });
    },

    async deleteSong(id) {
      // projects.song_id → NULL via ON DELETE SET NULL (foreign_keys = ON)
      await db.delete(schema.songs).where(eq(schema.songs.id, id));
    },

    async upsertProject(p) {
      await upsertProjectRow(p);
    },

    async deleteProject(id) {
      await db.delete(schema.projects).where(eq(schema.projects.id, id));
    },

    async saveRecoCache(list) {
      const fetchedAt = Date.now();
      db.transaction((tx) => {
        tx.delete(schema.recoCache).run();
        list.forEach((song, rank) => {
          tx.insert(schema.recoCache)
            .values({ catalogId: song.catalogId, payload: song, rank, fetchedAt })
            .onConflictDoNothing()
            .run();
        });
      });
    },

    async queueFeedback(catalogId, action) {
      await db.insert(schema.recoFeedback).values({ catalogId, action, at: Date.now() });
    },

    // ---- extras ----

    async searchProjects(query, limit = 50) {
      const q = ftsQuery(query);
      if (!q) return [];
      const rows = await raw.getAllAsync<{ project_id: string }>(
        'SELECT project_id FROM projects_fts WHERE projects_fts MATCH ? ORDER BY rank LIMIT ?',
        q,
        limit,
      );
      return rows.map((r) => r.project_id);
    },

    async pendingFeedback(limit = 100) {
      const rows = await db
        .select()
        .from(schema.recoFeedback)
        .where(isNull(schema.recoFeedback.sentAt))
        .orderBy(asc(schema.recoFeedback.id))
        .limit(limit);
      return rows.map(({ id, catalogId, action, at }) => ({ id, catalogId, action, at }));
    },

    async markFeedbackSent(ids) {
      if (ids.length === 0) return;
      await db.update(schema.recoFeedback).set({ sentAt: Date.now() }).where(inArray(schema.recoFeedback.id, ids));
    },

    async replaceProjects(list) {
      db.transaction((tx) => {
        // Manifests may reference songs that were deleted since: drop those links instead of failing the FK.
        const songIds = new Set(tx.select({ id: schema.songs.id }).from(schema.songs).all().map((r) => r.id));
        tx.delete(schema.projects).run();
        for (const p of list) {
          const row = projectToRow(p, opts.folderPathFor(p.id));
          if (row.songId && !songIds.has(row.songId)) row.songId = null;
          tx.insert(schema.projects).values(row).run();
        }
      });
    },

    async recoCacheFetchedAt() {
      const row = await raw.getFirstAsync<{ t: number | null }>('SELECT MAX(fetched_at) AS t FROM reco_cache');
      return row?.t ?? null;
    },

    async close() {
      await raw.closeAsync();
    },
  };
  return repo;
}
