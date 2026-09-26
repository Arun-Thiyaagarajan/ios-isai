/**
 * Read-only queries for browsing the library (albums, artists, genres, folders).
 * Only available songs count; missing files stay hidden.
 */
import { sql } from 'drizzle-orm';

import type { AppDatabase } from '../types';

// ─── Summary ────────────────────────────────────────────────────────────────

export type LibraryCounts = {
  songs: number;
  albums: number;
  artists: number;
  genres: number;
  folders: number;
};

export function getLibraryCounts(db: AppDatabase): LibraryCounts {
  return (
    db.get<LibraryCounts>(sql`
      SELECT
        (SELECT count(*) FROM songs WHERE is_available = 1) AS songs,
        (SELECT count(*) FROM albums WHERE song_count > 0) AS albums,
        (SELECT count(*) FROM artists WHERE song_count > 0) AS artists,
        (SELECT count(*) FROM genres WHERE song_count > 0) AS genres,
        (SELECT count(*) FROM folders WHERE song_count > 0) AS folders
    `) ?? { songs: 0, albums: 0, artists: 0, genres: 0, folders: 0 }
  );
}

// ─── Albums ─────────────────────────────────────────────────────────────────

export type AlbumSummary = {
  id: number;
  title: string;
  artist: string;
  year: number | null;
  songCount: number;
  /** null = not generated yet, "" = album has no artwork, otherwise a file URI. */
  artworkKey: string | null;
  colorPrimary: string | null;
};

const albumColumns = sql`
  a.id AS id, a.title AS title, a.display_artist AS artist, a.year AS year,
  a.song_count AS songCount, a.artwork_key AS artworkKey, a.color_primary AS colorPrimary
`;

export type AlbumSort = 'title' | 'artist' | 'year';

const albumOrder: Record<AlbumSort, ReturnType<typeof sql>> = {
  title: sql`a.title_sort, a.id`,
  artist: sql`lower(a.display_artist), a.year, a.title_sort, a.id`,
  year: sql`a.year IS NULL, a.year DESC, a.title_sort, a.id`,
};

export function listAlbums(db: AppDatabase, offset: number, limit: number, sort: AlbumSort = 'title') {
  return db.all<AlbumSummary>(sql`
    SELECT ${albumColumns} FROM albums a
    WHERE a.song_count > 0
    ORDER BY ${albumOrder[sort]}
    LIMIT ${limit} OFFSET ${offset}
  `);
}

/** Albums whose newest song was added most recently. */
export function listRecentlyAddedAlbums(db: AppDatabase, limit: number) {
  return db.all<AlbumSummary>(sql`
    SELECT ${albumColumns} FROM albums a
    JOIN songs s ON s.album_id = a.id AND s.is_available = 1
    WHERE a.song_count > 0
    GROUP BY a.id
    ORDER BY max(s.date_added) DESC
    LIMIT ${limit}
  `);
}

export type AlbumDetail = AlbumSummary & {
  totalDurationMs: number;
  albumArtistId: number | null;
  colorSecondary: string | null;
};

export function getAlbum(db: AppDatabase, albumId: number): AlbumDetail | undefined {
  return db.get<AlbumDetail>(sql`
    SELECT ${albumColumns}, a.total_duration_ms AS totalDurationMs,
           a.album_artist_id AS albumArtistId, a.color_secondary AS colorSecondary
    FROM albums a WHERE a.id = ${albumId}
  `);
}

// ─── Songs (shared shape for every song list) ───────────────────────────────

export type TrackItem = {
  id: number;
  title: string;
  artist: string;
  album: string | null;
  albumId: number | null;
  trackNo: number | null;
  discNo: number | null;
  durationMs: number;
  isPlayable: boolean;
  artworkKey: string | null;
};

const trackColumns = sql`
  s.id AS id, s.title AS title, s.artist_display AS artist, a.title AS album, s.album_id AS albumId,
  s.track_no AS trackNo, s.disc_no AS discNo, s.duration_ms AS durationMs,
  s.is_playable AS isPlayable, a.artwork_key AS artworkKey
`;

function mapTracks(rows: (Omit<TrackItem, 'isPlayable'> & { isPlayable: number | boolean })[]): TrackItem[] {
  return rows.map((row) => ({ ...row, isPlayable: Boolean(row.isPlayable) }));
}

/** Every song, A–Z, one page at a time. Offset paging over the title index stays fast at 50k rows. */
export function listSongs(db: AppDatabase, offset: number, limit: number): TrackItem[] {
  return mapTracks(
    db.all(sql`
      SELECT ${trackColumns} FROM songs s LEFT JOIN albums a ON a.id = s.album_id
      WHERE s.is_available = 1
      ORDER BY s.title_sort, s.id
      LIMIT ${limit} OFFSET ${offset}
    `),
  );
}

/** Album tracks in disc/track order; untagged tracks follow, alphabetically. */
export function listAlbumTracks(db: AppDatabase, albumId: number): TrackItem[] {
  return mapTracks(
    db.all(sql`
      SELECT ${trackColumns} FROM songs s LEFT JOIN albums a ON a.id = s.album_id
      WHERE s.album_id = ${albumId} AND s.is_available = 1
      ORDER BY coalesce(s.disc_no, 1), s.track_no IS NULL, s.track_no, s.title_sort
    `),
  );
}

// ─── Artists ────────────────────────────────────────────────────────────────

export type ArtistSummary = {
  id: number;
  name: string;
  songCount: number;
  albumCount: number;
  /** Artwork of one of the artist's albums, used as the artist picture. */
  albumId: number | null;
  artworkKey: string | null;
};

const artistArtwork = sql`
  (SELECT s.album_id FROM song_artists sa JOIN songs s ON s.id = sa.song_id
   WHERE sa.artist_id = ar.id AND s.is_available = 1 AND s.album_id IS NOT NULL
   ORDER BY s.has_art DESC LIMIT 1)
`;

export function listArtists(db: AppDatabase, offset: number, limit: number) {
  return db.all<ArtistSummary>(sql`
    SELECT x.id AS id, x.name AS name, x.song_count AS songCount, x.album_count AS albumCount,
           x.album_id AS albumId, al.artwork_key AS artworkKey
    FROM (SELECT ar.id, ar.name, ar.name_sort, ar.song_count, ar.album_count, ${artistArtwork} AS album_id
          FROM artists ar WHERE ar.song_count > 0
          ORDER BY ar.name_sort, ar.id LIMIT ${limit} OFFSET ${offset}) x
    LEFT JOIN albums al ON al.id = x.album_id
    ORDER BY x.name_sort, x.id
  `);
}

export function getArtist(db: AppDatabase, artistId: number): ArtistSummary | undefined {
  return db.get<ArtistSummary>(sql`
    SELECT ar.id AS id, ar.name AS name, ar.song_count AS songCount, ar.album_count AS albumCount,
           al.id AS albumId, al.artwork_key AS artworkKey
    FROM artists ar LEFT JOIN albums al ON al.id = ${artistArtwork}
    WHERE ar.id = ${artistId}
  `);
}

/** The artist's own albums plus albums they appear on, newest first. */
export function listArtistAlbums(db: AppDatabase, artistId: number) {
  return db.all<AlbumSummary>(sql`
    SELECT ${albumColumns} FROM albums a
    WHERE a.song_count > 0 AND (
      a.album_artist_id = ${artistId} OR a.id IN (
        SELECT s.album_id FROM song_artists sa JOIN songs s ON s.id = sa.song_id
        WHERE sa.artist_id = ${artistId} AND s.is_available = 1
      )
    )
    ORDER BY a.year IS NULL, a.year DESC, a.title_sort
  `);
}

export function listArtistSongs(db: AppDatabase, artistId: number): TrackItem[] {
  return mapTracks(
    db.all(sql`
      SELECT ${trackColumns} FROM songs s LEFT JOIN albums a ON a.id = s.album_id
      WHERE s.is_available = 1 AND s.id IN (
        SELECT song_id FROM song_artists WHERE artist_id = ${artistId} AND role = 'artist'
      )
      ORDER BY s.title_sort, s.id
    `),
  );
}

// ─── Genres ─────────────────────────────────────────────────────────────────

export type GenreSummary = { id: number; name: string; songCount: number };

export function listGenres(db: AppDatabase): GenreSummary[] {
  return db.all<GenreSummary>(sql`
    SELECT id, name, song_count AS songCount FROM genres
    WHERE song_count > 0 ORDER BY lower(name)
  `);
}

export function getGenre(db: AppDatabase, genreId: number): GenreSummary | undefined {
  return db.get<GenreSummary>(sql`SELECT id, name, song_count AS songCount FROM genres WHERE id = ${genreId}`);
}

export function listGenreSongs(db: AppDatabase, genreId: number): TrackItem[] {
  return mapTracks(
    db.all(sql`
      SELECT ${trackColumns} FROM songs s LEFT JOIN albums a ON a.id = s.album_id
      WHERE s.is_available = 1 AND s.id IN (SELECT song_id FROM song_genres WHERE genre_id = ${genreId})
      ORDER BY s.title_sort, s.id
    `),
  );
}

// ─── Folders ────────────────────────────────────────────────────────────────

export type FolderEntry = {
  id: number;
  path: string;
  name: string;
  /** Songs in this folder and every folder inside it. */
  totalSongs: number;
};

/** Sub-folders of a folder (or the top-level folders when `parentPath` is null). */
export function listSubfolders(db: AppDatabase, parentPath: string | null): FolderEntry[] {
  const parentFilter =
    parentPath === null
      ? sql`f.parent_id IS NULL`
      : sql`f.parent_id = (SELECT id FROM folders WHERE path = ${parentPath})`;
  return db.all<FolderEntry>(sql`
    SELECT f.id AS id, f.path AS path, f.name AS name,
      (SELECT coalesce(sum(d.song_count), 0) FROM folders d
       WHERE d.path = f.path OR substr(d.path, 1, length(f.path) + 1) = f.path || '/') AS totalSongs
    FROM folders f
    WHERE ${parentFilter}
    ORDER BY lower(f.name)
  `).filter((folder) => folder.totalSongs > 0);
}

/** Songs directly inside a folder, in file-name order (like a file manager). */
export function listFolderSongs(db: AppDatabase, path: string): TrackItem[] {
  return mapTracks(
    db.all(sql`
      SELECT ${trackColumns} FROM songs s LEFT JOIN albums a ON a.id = s.album_id
      WHERE s.is_available = 1 AND s.folder_id = (SELECT id FROM folders WHERE path = ${path})
      ORDER BY lower(s.file_name)
    `),
  );
}
