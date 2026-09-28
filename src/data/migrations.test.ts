/// <reference types="jest" />
import { LATEST_VERSION, MIGRATIONS, migrate, type MigrationDb } from './migrations';

function fakeDb(initialVersion = 0) {
  let version = initialVersion;
  const executed: string[] = [];
  const db: MigrationDb = {
    async execAsync(sql) {
      const m = /PRAGMA user_version = (\d+)/.exec(sql);
      if (m) version = Number(m[1]);
      executed.push(sql);
    },
    async getFirstAsync<T>() {
      return { user_version: version } as T;
    },
    async withTransactionAsync(task) {
      await task();
    },
  };
  return { db, executed, version: () => version };
}

describe('migrate', () => {
  it('applies all migrations to a new database and records user_version', async () => {
    const f = fakeDb();
    expect(await migrate(f.db)).toEqual(MIGRATIONS.map((m) => m.version));
    expect(f.version()).toBe(LATEST_VERSION);
    expect(f.executed.some((s) => s.includes('USING fts5'))).toBe(true);
  });

  it('is a no-op when up to date', async () => {
    const f = fakeDb(LATEST_VERSION);
    expect(await migrate(f.db)).toEqual([]);
    expect(f.executed).toEqual([]);
  });

  it('creates every table the Drizzle schema declares', () => {
    const sql = MIGRATIONS.flatMap((m) => m.statements).join('\n');
    for (const t of ['songs', 'projects', 'prefs', 'reco_cache', 'reco_feedback', 'projects_fts']) {
      expect(sql).toMatch(new RegExp(`CREATE (VIRTUAL )?TABLE ${t}\\b`));
    }
  });
});
