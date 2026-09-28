import type { CatalogSong, Prefs, Project, RecommendationAction, Song } from './types';

/**
 * Persistence boundary. Native: SQLite (Drizzle) index + project folders (sqliteRepo).
 * Web preview and tests: in-memory (memoryRepo). Screens never call this directly — they use the store.
 */
export interface LibraryRepo {
  load(): Promise<{ prefs: Prefs; songs: Song[]; projects: Project[]; recoCache: CatalogSong[] }>;
  savePrefs(prefs: Prefs): Promise<void>;
  upsertSong(song: Song): Promise<void>;
  deleteSong(id: string): Promise<void>;
  upsertProject(project: Project): Promise<void>;
  deleteProject(id: string): Promise<void>;
  saveRecoCache(songs: CatalogSong[]): Promise<void>;
  queueFeedback(catalogId: string, action: RecommendationAction): Promise<void>;
}
