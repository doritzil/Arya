/** Shared domain types. Mirrors ARCHITECTURE.md §5. */

export type Level = 1 | 2 | 3 | 4 | 5;
export type SongStatus = 'recommended' | 'learning' | 'learned' | 'idea';

/** The 12 genres offered in onboarding and Edit genres (handoff §3.1), in display order. */
export const GENRES = [
  'Pop',
  'Film & TV',
  'K-pop',
  'Classical',
  'Anime',
  'Musicals',
  'Jazz',
  'R&B',
  'Video games',
  'Rock',
  'Lo-fi',
  'Worship',
] as const;
/** Catalog-only genres that can appear on cards but aren't offered as picks. */
export const EXTRA_GENRES = ['Contemporary', 'Indie'] as const;
export type PickableGenre = (typeof GENRES)[number];
export type Genre = PickableGenre | (typeof EXTRA_GENRES)[number];

/** A song from the recommendation catalog (reco-api). Only lives in the reco cache until wanted. */
export interface CatalogSong {
  catalogId: string;
  appleMusicId?: string;
  title: string;
  artist: string;
  genre: Genre;
  /** Hand-curated for the seed catalog; undefined for songs found on Apple Music (not rated yet). */
  difficulty?: Level;
  previewUrl?: string;
  durationSec?: number;
  /** Curated public-domain MIDI — unlocks Keyboard mode for the score (§6.6). */
  midiUrl?: string;
}

/** A song on the learning list or in the library (SQLite `songs`). */
export interface Song {
  id: string;
  catalogId?: string;
  appleMusicId?: string;
  title: string;
  artist: string;
  genre: Genre;
  difficulty?: Level;
  status: 'learning' | 'learned';
  addedAt: number;
  learnedAt?: number;
  favourite: boolean;
  previewUrl?: string;
  durationSec?: number;
  midiPath?: string;
}

export type TranscriptionStatus = 'none' | 'queued' | 'running' | 'done' | 'failed';

/** One recording (SQLite `projects`, mirrored from the project folder's manifest.json). */
export interface Project {
  id: string;
  kind: 'song' | 'idea';
  songId?: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  durationSec: number;
  transcriptionStatus: TranscriptionStatus;
  /** 0–1 while running. Not persisted. */
  transcriptionProgress?: number;
  hasEdits: boolean;
}

export type RecommendationAction = 'want' | 'dismiss' | 'know' | 'undo_want';

export interface Prefs {
  onboardingDone: boolean;
  genres: PickableGenre[];
  level: Level;
  appleMusicHistoryEnabled: boolean;
  iCloudEnabled: boolean;
  learningSort: 'recent' | 'title' | 'takes';
}

export const DEFAULT_PREFS: Prefs = {
  onboardingDone: false,
  genres: [],
  level: 2,
  appleMusicHistoryEnabled: false,
  iCloudEnabled: false,
  learningSort: 'recent',
};

/** §6.6 — which notes Keyboard mode can show for a song. */
export type KeyboardAvailability =
  | { state: 'score'; midiPath: string }
  | { state: 'myNotes'; projectId: string; createdAt: number }
  | { state: 'onTheWay'; projectId: string; progress: number }
  | { state: 'locked' };
