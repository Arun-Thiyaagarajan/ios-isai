/**
 * Library search on the SQLite FTS5 index `search_fts`.
 *
 * Index layout (one row per song, artist, album and genre):
 * - primary_text:   title / name                                 (weighted highest)
 * - secondary_text: artist, album, album artist, composer, genres (weighted medium)
 * - extra_text:     file name, lyrics, comment                    (weighted low)
 *
 * Names with dots are indexed twice ("A.R. Rahman" and "AR Rahman") so "ar rahman" matches.
 * Playlists are searched directly by name, so renames show up immediately.
 */
import { sql, type SQL } from 'drizzle-orm';

import { normalizeKey } from '@/lib/normalize';

import { recentSearches } from '../schema';
import type { AppDatabase } from '../types';
import type { AlbumSummary, ArtistSummary, GenreSummary, PlaylistSummary, TrackItem } from './browse';

/** Any database handle that can run statements, including a transaction. */
type Runner = Pick<AppDatabase, 'run' | 'all' | 'get'>;

/** "A.R. Rahman" → "A.R. Rahman AR Rahman"; text without dots is returned unchanged. */
function withDotless(column: SQL): SQL {
  return sql`CASE WHEN instr(${column}, '.') > 0 THEN ${column} || ' ' || replace(${column}, '.', '') ELSE ${column} END`;
}

const songPrimary = withDotless(sql`s.title`);
const songSecondary = sql`
  ${withDotless(sql`s.artist_display`)} || ' ' || coalesce(a.title, '') || ' ' ||
  ${withDotless(sql`coalesce(s.album_artist_display, '')`)} || ' ' || coalesce(s.composer, '') || ' ' ||
  coalesce((SELECT group_concat(g.name, ' ') FROM song_genres sg JOIN genres g ON g.id = sg.genre_id
            WHERE sg.song_id = s.id), '')
`;
const songExtra = sql`s.file_name || ' ' || coalesce(l.content, '') || ' ' || coalesce(s.comment, '')`;

function insertSongs(db: Runner, where: SQL) {
  db.run(sql`
    INSERT INTO search_fts (entity_type, entity_id, primary_text, secondary_text, extra_text)
    SELECT 'song', s.id, ${songPrimary}, ${songSecondary}, ${songExtra}
    FROM songs s
    LEFT JOIN albums a ON a.id = s.album_id
    LEFT JOIN lyrics_cache l ON l.song_id = s.id
    WHERE s.is_available = 1 AND ${where}
  `);
}

/** Re-indexes artists, albums and genres (small sets; fast). */
export function reindexCollections(db: Runner): void {
  db.run(sql`DELETE FROM search_fts WHERE entity_type IN ('artist', 'album', 'genre', 'playlist')`);
  db.run(sql`
    INSERT INTO search_fts (entity_type, entity_id, primary_text, secondary_text, extra_text)
    SELECT 'artist', id, ${withDotless(sql`name`)}, '', '' FROM artists WHERE song_count > 0
  `);
  db.run(sql`
    INSERT INTO search_fts (entity_type, entity_id, primary_text, secondary_text, extra_text)
    SELECT 'album', id, title, ${withDotless(sql`display_artist`)}, '' FROM albums WHERE song_count > 0
  `);
  db.run(sql`
    INSERT INTO search_fts (entity_type, entity_id, primary_text, secondary_text, extra_text)
    SELECT 'genre', id, name, '', '' FROM genres WHERE song_count > 0
  `);
}

/** Rebuilds the whole index; one set-based pass, fast even for 50k songs. */
export function rebuildSearchIndex(db: Runner): void {
  db.run(sql`DELETE FROM search_fts`);
  insertSongs(db, sql`1 = 1`);
  reindexCollections(db);
}

/** Re-indexes specific songs after an edit, plus the artist/album/genre rows they may affect. */
export function reindexSongs(db: Runner, songIds: number[]): void {
  if (songIds.length === 0) return;
  const ids = sql.join(
    songIds.map((id) => sql`${id}`),
    sql`, `,
  );
  db.run(sql`DELETE FROM search_fts WHERE entity_type = 'song' AND entity_id IN (${ids})`);
  insertSongs(db, sql`s.id IN (${ids})`);
  reindexCollections(db);
}

/** Builds the index if it's empty but the library isn't (e.g. right after an upgrade). */
export function ensureSearchIndex(db: AppDatabase): void {
  const row = db.get<{ indexed: number; songs: number }>(sql`
    SELECT (SELECT count(*) FROM search_fts) AS indexed,
           (SELECT count(*) FROM songs WHERE is_available = 1) AS songs
  `);
  if (row && row.indexed === 0 && row.songs > 0) {
    rebuildSearchIndex(db);
  }
}

// ─── Querying ───────────────────────────────────────────────────────────────

const MAX_TOKENS = 8;

/** Lower-cased, accent-free words of a query, punctuation removed: "A.R. Rahman!" → ["a", "r", "rahman"]. */
export function queryTokens(input: string): string[] {
  return normalizeKey(input)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_TOKENS);
}

/**
 * FTS5 query: every word must match the start of some word, in any order: `"ar"* "rahman"*`.
 * Words are quoted, so user input can never break the query syntax. Null for an empty query.
 */
export function buildMatchQuery(input: string): string | null {
  const tokens = queryTokens(input);
  return tokens.length ? tokens.map((t) => `"${t}"*`).join(' ') : null;
}

export type SearchResults = {
  songs: TrackItem[];
  artists: ArtistSummary[];
  albums: AlbumSummary[];
  genres: GenreSummary[];
  playlists: PlaylistSummary[];
};

export const emptyResults: SearchResults = { songs: [], artists: [], albums: [], genres: [], playlists: [] };

const LIMITS = { songs: 50, artists: 5, albums: 8, genres: 4, playlists: 6 };

/** Column weights for bm25: entity_type and entity_id are unindexed (0), then title, details, extra. */
const rank = sql`bm25(search_fts, 0, 0, 10.0, 4.0, 1.0)`;

function searchSongs(db: AppDatabase, match: string, prefix: string): TrackItem[] {
  const rows = db.all<Omit<TrackItem, 'isPlayable'> & { isPlayable: number }>(sql`
    SELECT s.id AS id, s.title AS title, s.artist_display AS artist, a.title AS album, s.album_id AS albumId,
           s.track_no AS trackNo, s.disc_no AS discNo, s.duration_ms AS durationMs, s.is_playable AS isPlayable,
           coalesce(s.artwork_override, a.artwork_key) AS artworkKey
    FROM search_fts
    JOIN songs s ON s.id = search_fts.entity_id
    LEFT JOIN albums a ON a.id = s.album_id
    LEFT JOIN song_stats st ON st.song_id = s.id
    WHERE search_fts MATCH ${match} AND search_fts.entity_type = 'song' AND s.is_available = 1
    ORDER BY ${rank}
      - CASE WHEN lower(s.title) LIKE ${prefix} THEN 5 ELSE 0 END
      - min(coalesce(st.play_count, 0), 20) * 0.05
    LIMIT ${LIMITS.songs}
  `);
  return rows.map((row) => ({ ...row, isPlayable: Boolean(row.isPlayable) }));
}

/** Plain substring search, used when the index finds nothing (e.g. text in the middle of a word). */
function searchSongsFallback(db: AppDatabase, query: string): TrackItem[] {
  const like = `%${query.toLowerCase().replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const rows = db.all<Omit<TrackItem, 'isPlayable'> & { isPlayable: number }>(sql`
    SELECT s.id AS id, s.title AS title, s.artist_display AS artist, a.title AS album, s.album_id AS albumId,
           s.track_no AS trackNo, s.disc_no AS discNo, s.duration_ms AS durationMs, s.is_playable AS isPlayable,
           coalesce(s.artwork_override, a.artwork_key) AS artworkKey
    FROM songs s LEFT JOIN albums a ON a.id = s.album_id
    WHERE s.is_available = 1 AND (
      lower(s.title) LIKE ${like} ESCAPE '\\' OR lower(s.artist_display) LIKE ${like} ESCAPE '\\'
      OR lower(coalesce(a.title, '')) LIKE ${like} ESCAPE '\\' OR lower(s.file_name) LIKE ${like} ESCAPE '\\'
    )
    ORDER BY s.title_sort
    LIMIT ${LIMITS.songs}
  `);
  return rows.map((row) => ({ ...row, isPlayable: Boolean(row.isPlayable) }));
}

function searchArtists(db: AppDatabase, match: string): ArtistSummary[] {
  return db.all<ArtistSummary>(sql`
    SELECT ar.id AS id, ar.name AS name, ar.song_count AS songCount, ar.album_count AS albumCount,
           al.id AS albumId, al.artwork_key AS artworkKey
    FROM search_fts
    JOIN artists ar ON ar.id = search_fts.entity_id
    LEFT JOIN albums al ON al.id = (
      SELECT s.album_id FROM song_artists sa JOIN songs s ON s.id = sa.song_id
      WHERE sa.artist_id = ar.id AND s.is_available = 1 AND s.album_id IS NOT NULL
      ORDER BY s.has_art DESC LIMIT 1
    )
    WHERE search_fts MATCH ${match} AND search_fts.entity_type = 'artist'
    ORDER BY ${rank}, ar.song_count DESC
    LIMIT ${LIMITS.artists}
  `);
}

function searchAlbums(db: AppDatabase, match: string): AlbumSummary[] {
  return db.all<AlbumSummary>(sql`
    SELECT a.id AS id, a.title AS title, a.display_artist AS artist, a.year AS year,
           a.song_count AS songCount, a.artwork_key AS artworkKey, a.color_primary AS colorPrimary
    FROM search_fts JOIN albums a ON a.id = search_fts.entity_id
    WHERE search_fts MATCH ${match} AND search_fts.entity_type = 'album'
    ORDER BY ${rank}
    LIMIT ${LIMITS.albums}
  `);
}

function searchGenres(db: AppDatabase, match: string): GenreSummary[] {
  return db.all<GenreSummary>(sql`
    SELECT g.id AS id, g.name AS name, g.song_count AS songCount
    FROM search_fts JOIN genres g ON g.id = search_fts.entity_id
    WHERE search_fts MATCH ${match} AND search_fts.entity_type = 'genre'
    ORDER BY ${rank}
    LIMIT ${LIMITS.genres}
  `);
}

/** Playlists are few, so every query word is matched against the name directly. */
function searchPlaylists(db: AppDatabase, tokens: string[]): PlaylistSummary[] {
  const conditions = tokens.map((token) => {
    const like = `%${token.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    return sql`lower(p.name) LIKE ${like} ESCAPE '\\'`;
  });
  return db.all<PlaylistSummary>(sql`
    SELECT p.id AS id, p.name AS name,
      (SELECT count(*) FROM playlist_songs ps WHERE ps.playlist_id = p.id) AS songCount,
      0 AS totalDurationMs,
      first.album_id AS albumId, al.artwork_key AS artworkKey
    FROM playlists p
    LEFT JOIN songs first ON first.id = (
      SELECT ps.song_id FROM playlist_songs ps JOIN songs s ON s.id = ps.song_id
      WHERE ps.playlist_id = p.id AND s.is_available = 1 ORDER BY ps.position LIMIT 1
    )
    LEFT JOIN albums al ON al.id = first.album_id
    WHERE ${sql.join(conditions, sql` AND `)}
    ORDER BY lower(p.name)
    LIMIT ${LIMITS.playlists}
  `);
}

/** Searches everything. Never throws on odd input; returns empty groups instead. */
export function searchLibrary(db: AppDatabase, input: string): SearchResults {
  const tokens = queryTokens(input);
  const match = buildMatchQuery(input);
  if (!match) {
    return emptyResults;
  }
  const prefix = `${input.trim().toLowerCase().replace(/[%_\\]/g, '')}%`;
  try {
    const songs = searchSongs(db, match, prefix);
    return {
      songs: songs.length > 0 ? songs : searchSongsFallback(db, input.trim()),
      artists: searchArtists(db, match),
      albums: searchAlbums(db, match),
      genres: searchGenres(db, match),
      playlists: searchPlaylists(db, tokens),
    };
  } catch {
    return { ...emptyResults, songs: searchSongsFallback(db, input.trim()), playlists: searchPlaylists(db, tokens) };
  }
}

// ─── Recent searches ────────────────────────────────────────────────────────

const MAX_RECENT = 20;

export function addRecentSearch(db: AppDatabase, query: string, at = Date.now()): void {
  const text = query.trim().replace(/\s+/g, ' ');
  if (!text) return;
  db.insert(recentSearches)
    .values({ query: text, usedAt: at })
    .onConflictDoUpdate({ target: recentSearches.query, set: { usedAt: at } })
    .run();
  db.run(sql`
    DELETE FROM recent_searches WHERE query NOT IN (
      SELECT query FROM recent_searches ORDER BY used_at DESC LIMIT ${MAX_RECENT}
    )
  `);
}

export function listRecentSearches(db: AppDatabase, limit = 10): string[] {
  return db
    .all<{ query: string }>(sql`SELECT query FROM recent_searches ORDER BY used_at DESC LIMIT ${limit}`)
    .map((row) => row.query);
}

export function removeRecentSearch(db: AppDatabase, query: string): void {
  db.run(sql`DELETE FROM recent_searches WHERE query = ${query}`);
}

export function clearRecentSearches(db: AppDatabase): void {
  db.run(sql`DELETE FROM recent_searches`);
}
