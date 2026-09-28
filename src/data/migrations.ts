/**
 * Hand-written SQL migrations (drizzle-kit isn't installed). Applied in order inside a transaction;
 * progress is tracked with `PRAGMA user_version`. Never edit a shipped migration — append a new one.
 * Must match ./schema.ts.
 */

export interface Migration {
  version: number;
  name: string;
  statements: string[];
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'init',
    statements: [
      `CREATE TABLE songs (
        id TEXT PRIMARY KEY NOT NULL,
        apple_music_id TEXT,
        catalog_id TEXT,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        genre TEXT NOT NULL,
        difficulty INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('learning', 'learned')),
        added_at INTEGER NOT NULL,
        learned_at INTEGER,
        favourite INTEGER NOT NULL DEFAULT 0,
        preview_url TEXT,
        duration_sec REAL,
        midi_path TEXT
      )`,
      `CREATE INDEX songs_status_idx ON songs (status)`,
      `CREATE INDEX songs_catalog_idx ON songs (catalog_id)`,

      `CREATE TABLE projects (
        id TEXT PRIMARY KEY NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('song', 'idea')),
        song_id TEXT REFERENCES songs (id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        duration_sec REAL NOT NULL DEFAULT 0,
        transcription_status TEXT NOT NULL DEFAULT 'none',
        has_edits INTEGER NOT NULL DEFAULT 0,
        folder_path TEXT NOT NULL
      )`,
      `CREATE INDEX projects_song_idx ON projects (song_id)`,
      `CREATE INDEX projects_created_idx ON projects (created_at)`,

      `CREATE TABLE prefs (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      )`,

      `CREATE TABLE reco_cache (
        catalog_id TEXT PRIMARY KEY NOT NULL,
        payload TEXT NOT NULL,
        rank INTEGER NOT NULL,
        fetched_at INTEGER NOT NULL
      )`,

      `CREATE TABLE reco_feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        catalog_id TEXT NOT NULL,
        action TEXT NOT NULL,
        at INTEGER NOT NULL,
        sent_at INTEGER
      )`,
      `CREATE INDEX reco_feedback_unsent_idx ON reco_feedback (sent_at)`,

      // FTS5 search over project names + their song's title/artist (FR-21, FR-37), kept in sync by triggers.
      `CREATE VIRTUAL TABLE projects_fts USING fts5(
        project_id UNINDEXED,
        name,
        song_title,
        song_artist,
        tokenize = 'unicode61 remove_diacritics 2'
      )`,
      `CREATE TRIGGER projects_fts_ai AFTER INSERT ON projects BEGIN
        INSERT INTO projects_fts (project_id, name, song_title, song_artist)
        SELECT new.id, new.name, s.title, s.artist FROM (SELECT 1) LEFT JOIN songs s ON s.id = new.song_id;
      END`,
      `CREATE TRIGGER projects_fts_au AFTER UPDATE OF name, song_id ON projects BEGIN
        DELETE FROM projects_fts WHERE project_id = old.id;
        INSERT INTO projects_fts (project_id, name, song_title, song_artist)
        SELECT new.id, new.name, s.title, s.artist FROM (SELECT 1) LEFT JOIN songs s ON s.id = new.song_id;
      END`,
      `CREATE TRIGGER projects_fts_ad AFTER DELETE ON projects BEGIN
        DELETE FROM projects_fts WHERE project_id = old.id;
      END`,
      `CREATE TRIGGER songs_fts_au AFTER UPDATE OF title, artist ON songs BEGIN
        UPDATE projects_fts SET song_title = new.title, song_artist = new.artist
        WHERE project_id IN (SELECT id FROM projects WHERE song_id = new.id);
      END`,
      `CREATE TRIGGER songs_fts_ad AFTER DELETE ON songs BEGIN
        UPDATE projects_fts SET song_title = NULL, song_artist = NULL
        WHERE project_id IN (SELECT id FROM projects WHERE song_id = old.id);
      END`,
    ],
  },
];

export const LATEST_VERSION = MIGRATIONS.reduce((v, m) => Math.max(v, m.version), 0);

/** Minimal surface of expo-sqlite's SQLiteDatabase we need (keeps this testable with a fake). */
export interface MigrationDb {
  execAsync(source: string): Promise<void>;
  getFirstAsync<T>(source: string): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

/** Applies pending migrations; returns the versions applied. */
export async function migrate(db: MigrationDb, migrations: Migration[] = MIGRATIONS): Promise<number[]> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  const pending = [...migrations].sort((a, b) => a.version - b.version).filter((m) => m.version > current);
  for (const m of pending) {
    await db.withTransactionAsync(async () => {
      for (const s of m.statements) await db.execAsync(s);
      // PRAGMA can't take bound parameters; version is a trusted integer.
      await db.execAsync(`PRAGMA user_version = ${Math.trunc(m.version)}`);
    });
  }
  return pending.map((m) => m.version);
}
