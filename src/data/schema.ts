/**
 * SQLite schema (Drizzle, expo-sqlite) — ARCHITECTURE.md §5.3.
 * SQLite is an index + app state; project folders are the source of truth (§5.1).
 *
 * Keep in sync with the hand-written SQL in ./migrations.ts (drizzle-kit isn't installed).
 * `projects_fts` (FTS5) has no Drizzle table: it is created and maintained by triggers in the migrations
 * and queried with raw SQL (see sqliteRepo.searchProjects).
 */
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { Genre, Level, RecommendationAction, TranscriptionStatus } from './types';

export const songs = sqliteTable(
  'songs',
  {
    id: text('id').primaryKey(),
    appleMusicId: text('apple_music_id'),
    /** reco-api catalog id */
    catalogId: text('catalog_id'),
    title: text('title').notNull(),
    artist: text('artist').notNull(),
    genre: text('genre').$type<Genre>().notNull(),
    difficulty: integer('difficulty').$type<Level | 0>().notNull() /* 0 = not rated */,
    status: text('status', { enum: ['learning', 'learned'] }).notNull(),
    /** epoch ms */
    addedAt: integer('added_at').notNull(),
    learnedAt: integer('learned_at'),
    favourite: integer('favourite', { mode: 'boolean' }).notNull().default(false),
    previewUrl: text('preview_url'),
    durationSec: real('duration_sec'),
    /** curated public-domain MIDI (unlocks Keyboard mode for the score, §6.6) */
    midiPath: text('midi_path'),
  },
  (t) => [index('songs_status_idx').on(t.status), index('songs_catalog_idx').on(t.catalogId)],
);

export const projects = sqliteTable(
  'projects',
  {
    id: text('id').primaryKey(),
    kind: text('kind', { enum: ['song', 'idea'] }).notNull(),
    songId: text('song_id').references(() => songs.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    durationSec: real('duration_sec').notNull().default(0),
    transcriptionStatus: text('transcription_status').$type<TranscriptionStatus>().notNull().default('none'),
    hasEdits: integer('has_edits', { mode: 'boolean' }).notNull().default(false),
    /** file:// URI of Documents/Projects/<id> */
    folderPath: text('folder_path').notNull(),
  },
  (t) => [index('projects_song_idx').on(t.songId), index('projects_created_idx').on(t.createdAt)],
);

/** key → JSON value: genres[], level, appleMusicHistoryEnabled, iCloudEnabled, onboardingDone, learningSort */
export const prefs = sqliteTable('prefs', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).notNull(),
});

/** Last recommendations feed, readable offline (FR-27). payload = CatalogSong JSON. */
export const recoCache = sqliteTable('reco_cache', {
  catalogId: text('catalog_id').primaryKey(),
  payload: text('payload', { mode: 'json' }).notNull(),
  rank: integer('rank').notNull(),
  fetchedAt: integer('fetched_at').notNull(),
});

/** Feedback outbox, flushed to reco-api when online. */
export const recoFeedback = sqliteTable(
  'reco_feedback',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    catalogId: text('catalog_id').notNull(),
    action: text('action').$type<RecommendationAction>().notNull(),
    at: integer('at').notNull(),
    sentAt: integer('sent_at'),
  },
  (t) => [index('reco_feedback_unsent_idx').on(t.sentAt)],
);

export type SongRow = typeof songs.$inferSelect;
export type ProjectRow = typeof projects.$inferSelect;
export type RecoFeedbackRow = typeof recoFeedback.$inferSelect;
