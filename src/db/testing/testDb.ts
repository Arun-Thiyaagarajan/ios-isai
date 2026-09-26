import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';

import {
  ScanContext,
  beginScan,
  finishScan,
  upsertTracks,
  type ScannedTrack,
} from '../repos/library';
import * as schema from '../schema';
import type { AppDatabase } from '../types';

/** Fresh in-memory database with every real migration applied (the same SQL the app runs). */
export function createTestDb(): AppDatabase {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(__dirname, '../../../drizzle') });
  return db;
}

let nextSource = 1;

export function insertSong(
  db: AppDatabase,
  overrides: Partial<typeof schema.songs.$inferInsert> = {},
): number {
  const n = nextSource++;
  const row = db
    .insert(schema.songs)
    .values({
      source: 'mediastore',
      sourceId: String(n),
      uri: `content://media/external/audio/media/${n}`,
      fileName: `song-${n}.mp3`,
      dateAdded: 1_700_000_000_000,
      dateModified: 1_700_000_000_000,
      title: `Song ${n}`,
      titleSort: `song ${n}`,
      artistDisplay: 'Artist',
      durationMs: 200_000,
      ...overrides,
    })
    .returning({ id: schema.songs.id })
    .get();
  return row.id;
}

/** A scanned file with sensible defaults, for library tests. */
export function makeTrack(overrides: Partial<ScannedTrack> = {}): ScannedTrack {
  return {
    source: 'mediastore',
    sourceId: '1',
    rootId: null,
    uri: 'content://media/1',
    fileName: 'song.mp3',
    folderPath: 'Music/Artist/Album',
    fileSize: 1000,
    mime: 'audio/mpeg',
    dateAdded: 1000,
    dateModified: 1000,
    durationMs: 200_000,
    bitrate: null,
    title: 'Song',
    artist: 'Artist',
    album: 'Album',
    albumArtist: null,
    genre: null,
    year: null,
    trackNo: null,
    discNo: null,
    hasArt: false,
    composer: null,
    comment: null,
    copyright: null,
    bpm: null,
    lyrics: null,
    isPlayable: true,
    unplayableReason: null,
    ...overrides,
  };
}

/** Runs a full scan of exactly these files (MediaStore source). */
export function scanTracks(db: AppDatabase, tracks: ScannedTrack[], now = Date.now()): void {
  const generation = beginScan(db);
  upsertTracks(db, new ScanContext(generation), tracks);
  finishScan(db, generation, { sources: ['mediastore'] }, now);
}
