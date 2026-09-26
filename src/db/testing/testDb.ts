import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';

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
