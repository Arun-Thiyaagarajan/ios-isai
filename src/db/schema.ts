/**
 * Isai database schema (SQLite via Drizzle).
 *
 * Two kinds of tables:
 * - Library tables are derived from the music files and can be rebuilt by rescanning.
 *   Rows are upserted (never dropped) so song ids stay stable for user data.
 * - User-data tables (playlists, favorites, history, stats, settings) must survive
 *   rescans and migrations.
 *
 * The full-text search table (`search_fts`) is created by a custom SQL migration
 * because Drizzle can't declare FTS5 virtual tables.
 * All timestamps are Unix epoch milliseconds.
 */
import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
  type AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core';

const now = sql`(unixepoch('subsec') * 1000)`;

// ─── Library tables ─────────────────────────────────────────────────────────

/** A granted source of music: an iOS security-scoped folder bookmark or an Android SAF tree. */
export const libraryRoots = sqliteTable('library_roots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  platform: text('platform', { enum: ['ios', 'android'] }).notNull(),
  displayName: text('display_name').notNull(),
  /** Base64 security-scoped bookmark (iOS). */
  bookmark: text('bookmark'),
  uri: text('uri'),
  isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(true),
  addedAt: integer('added_at').notNull().default(now),
});

export const folders = sqliteTable(
  'folders',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    parentId: integer('parent_id').references((): AnySQLiteColumn => folders.id, {
      onDelete: 'cascade',
    }),
    path: text('path').notNull().unique(),
    name: text('name').notNull(),
    songCount: integer('song_count').notNull().default(0),
  },
  (t) => [index('folders_parent_idx').on(t.parentId)],
);

export const artists = sqliteTable(
  'artists',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    /** Normalized for sorting: case/diacritics folded, optional leading article removed. */
    nameSort: text('name_sort').notNull(),
    /** Identity key used to merge spellings like "Beatles" / "beatles". */
    nameNorm: text('name_norm').notNull().unique(),
    artworkKey: text('artwork_key'),
    songCount: integer('song_count').notNull().default(0),
    albumCount: integer('album_count').notNull().default(0),
  },
  (t) => [index('artists_sort_idx').on(t.nameSort)],
);

export const albums = sqliteTable(
  'albums',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    title: text('title').notNull(),
    titleSort: text('title_sort').notNull(),
    titleNorm: text('title_norm').notNull(),
    albumArtistId: integer('album_artist_id').references(() => artists.id, {
      onDelete: 'set null',
    }),
    /** Disambiguates same-titled albums without an album artist (usually the folder path). */
    groupHint: text('group_hint').notNull().default(''),
    /** Album artist, the single track artist, or "Various Artists"; computed after each scan. */
    displayArtist: text('display_artist').notNull().default(''),
    year: integer('year'),
    artworkKey: text('artwork_key'),
    // Palette colors extracted natively when the thumbnail is generated.
    colorPrimary: text('color_primary'),
    colorSecondary: text('color_secondary'),
    colorOn: text('color_on'),
    songCount: integer('song_count').notNull().default(0),
    totalDurationMs: integer('total_duration_ms').notNull().default(0),
    isCompilation: integer('is_compilation', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [
    uniqueIndex('albums_identity_idx').on(t.titleNorm, t.albumArtistId, t.groupHint),
    index('albums_sort_idx').on(t.titleSort),
    index('albums_artist_idx').on(t.albumArtistId),
  ],
);

export const genres = sqliteTable('genres', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  nameNorm: text('name_norm').notNull().unique(),
  songCount: integer('song_count').notNull().default(0),
});

export const songs = sqliteTable(
  'songs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),

    // Where the file lives
    source: text('source', { enum: ['mediastore', 'bookmark', 'documents', 'ipod'] }).notNull(),
    /** MediaStore _ID on Android, root-relative path on iOS. */
    sourceId: text('source_id').notNull(),
    rootId: integer('root_id').references(() => libraryRoots.id, { onDelete: 'cascade' }),
    uri: text('uri').notNull(),
    folderId: integer('folder_id').references(() => folders.id, { onDelete: 'set null' }),
    fileName: text('file_name').notNull(),
    fileSize: integer('file_size').notNull().default(0),
    mime: text('mime'),
    dateAdded: integer('date_added').notNull(),
    dateModified: integer('date_modified').notNull(),
    /** size + duration + partial content hash; detects renames/moves and duplicates. */
    contentSig: text('content_sig'),

    // Audio properties
    codec: text('codec'),
    bitrate: integer('bitrate'),
    sampleRate: integer('sample_rate'),
    bitDepth: integer('bit_depth'),
    channels: integer('channels'),
    durationMs: integer('duration_ms').notNull().default(0),

    // Tags
    title: text('title').notNull(),
    titleSort: text('title_sort').notNull(),
    artistDisplay: text('artist_display').notNull().default(''),
    albumId: integer('album_id').references(() => albums.id, { onDelete: 'set null' }),
    albumArtistDisplay: text('album_artist_display'),
    year: integer('year'),
    trackNo: integer('track_no'),
    discNo: integer('disc_no'),
    hasArt: integer('has_art', { mode: 'boolean' }).notNull().default(false),
    artworkKey: text('artwork_key'),
    hasLyrics: integer('has_lyrics', { mode: 'boolean' }).notNull().default(false),
    rgTrackGain: real('rg_track_gain'),
    rgTrackPeak: real('rg_track_peak'),
    rgAlbumGain: real('rg_album_gain'),
    rgAlbumPeak: real('rg_album_peak'),

    // State
    isPlayable: integer('is_playable', { mode: 'boolean' }).notNull().default(true),
    unplayableReason: text('unplayable_reason'),
    isAvailable: integer('is_available', { mode: 'boolean' }).notNull().default(true),
    missingSince: integer('missing_since'),
    tagsScannedAt: integer('tags_scanned_at'),
    scanGeneration: integer('scan_generation').notNull().default(0),
    lastError: text('last_error'),
  },
  (t) => [
    uniqueIndex('songs_source_idx').on(t.source, t.sourceId),
    index('songs_album_track_idx').on(t.albumId, t.discNo, t.trackNo),
    index('songs_title_sort_idx').on(t.titleSort),
    index('songs_date_added_idx').on(t.dateAdded),
    index('songs_folder_idx').on(t.folderId),
    index('songs_available_idx').on(t.isAvailable),
    index('songs_content_sig_idx').on(t.contentSig).where(sql`${t.contentSig} IS NOT NULL`),
  ],
);

export const songArtists = sqliteTable(
  'song_artists',
  {
    songId: integer('song_id')
      .notNull()
      .references(() => songs.id, { onDelete: 'cascade' }),
    artistId: integer('artist_id')
      .notNull()
      .references(() => artists.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['artist', 'album_artist', 'composer'] }).notNull(),
    position: integer('position').notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.songId, t.artistId, t.role] }),
    index('song_artists_artist_idx').on(t.artistId, t.role),
  ],
);

export const songGenres = sqliteTable(
  'song_genres',
  {
    songId: integer('song_id')
      .notNull()
      .references(() => songs.id, { onDelete: 'cascade' }),
    genreId: integer('genre_id')
      .notNull()
      .references(() => genres.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.songId, t.genreId] }), index('song_genres_genre_idx').on(t.genreId)],
);

export const excludedPaths = sqliteTable('excluded_paths', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  pathPrefix: text('path_prefix').notNull().unique(),
});

/** Scanner bookkeeping, e.g. MediaStore version and last generation seen. */
export const scanState = sqliteTable('scan_state', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

// ─── User-data tables ───────────────────────────────────────────────────────

export const playlists = sqliteTable('playlists', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  artworkUri: text('artwork_uri'),
  kind: text('kind', { enum: ['manual', 'smart'] }).notNull().default('manual'),
  /** Smart playlist rules (future). */
  rulesJson: text('rules_json'),
  createdAt: integer('created_at').notNull().default(now),
  updatedAt: integer('updated_at').notNull().default(now),
});

export const playlistSongs = sqliteTable(
  'playlist_songs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    playlistId: integer('playlist_id')
      .notNull()
      .references(() => playlists.id, { onDelete: 'cascade' }),
    /** Null while the song is missing; re-linked later through `songFingerprint`. */
    songId: integer('song_id').references(() => songs.id, { onDelete: 'set null' }),
    /** Fractional index: moving a song only rewrites that one row. */
    position: real('position').notNull(),
    /** title|artist|duration bucket (see songFingerprint), for re-linking after reinstall or id changes. */
    songFingerprint: text('song_fingerprint').notNull(),
    addedAt: integer('added_at').notNull().default(now),
  },
  (t) => [
    index('playlist_songs_order_idx').on(t.playlistId, t.position),
    index('playlist_songs_song_idx').on(t.songId),
  ],
);

export const favorites = sqliteTable(
  'favorites',
  {
    entityType: text('entity_type', { enum: ['song', 'album', 'artist', 'playlist'] }).notNull(),
    entityId: integer('entity_id').notNull(),
    createdAt: integer('created_at').notNull().default(now),
  },
  (t) => [
    primaryKey({ columns: [t.entityType, t.entityId] }),
    index('favorites_recent_idx').on(t.entityType, t.createdAt),
  ],
);

export const playEvents = sqliteTable(
  'play_events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    songId: integer('song_id')
      .notNull()
      .references(() => songs.id, { onDelete: 'cascade' }),
    startedAt: integer('started_at').notNull(),
    msPlayed: integer('ms_played').notNull(),
    completed: integer('completed', { mode: 'boolean' }).notNull(),
    /** Where playback started, e.g. "album:12" or "playlist:3". */
    context: text('context'),
  },
  (t) => [index('play_events_started_idx').on(t.startedAt), index('play_events_song_idx').on(t.songId)],
);

/** Denormalized per-song counters, updated with every play event. */
export const songStats = sqliteTable(
  'song_stats',
  {
    songId: integer('song_id')
      .primaryKey()
      .references(() => songs.id, { onDelete: 'cascade' }),
    playCount: integer('play_count').notNull().default(0),
    skipCount: integer('skip_count').notNull().default(0),
    firstPlayedAt: integer('first_played_at'),
    lastPlayedAt: integer('last_played_at'),
  },
  (t) => [
    index('song_stats_play_count_idx').on(t.playCount),
    index('song_stats_last_played_idx').on(t.lastPlayedAt),
  ],
);

export const recentSearches = sqliteTable('recent_searches', {
  query: text('query').primaryKey(),
  usedAt: integer('used_at').notNull(),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  valueJson: text('value_json').notNull(),
});

export const lyricsCache = sqliteTable('lyrics_cache', {
  songId: integer('song_id')
    .primaryKey()
    .references(() => songs.id, { onDelete: 'cascade' }),
  source: text('source', { enum: ['embedded', 'sidecar', 'online'] }).notNull(),
  isSynced: integer('is_synced', { mode: 'boolean' }).notNull(),
  content: text('content').notNull(),
  updatedAt: integer('updated_at').notNull().default(now),
});
