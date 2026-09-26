import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import type * as schema from './schema';

/**
 * Any synchronous Drizzle SQLite database with the Isai schema.
 * The app uses expo-sqlite; repository tests use better-sqlite3 in Node.
 * Repositories take this type so both work.
 */
export type AppDatabase = BaseSQLiteDatabase<'sync', any, typeof schema>;

export type Song = typeof schema.songs.$inferSelect;
export type Playlist = typeof schema.playlists.$inferSelect;
export type PlaylistSong = typeof schema.playlistSongs.$inferSelect;
export type FavoriteType = (typeof schema.favorites.$inferSelect)['entityType'];
