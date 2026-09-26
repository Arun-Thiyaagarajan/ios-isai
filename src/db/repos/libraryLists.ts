/**
 * Sorted library lists for the Albums and Songs screens, with the letter of each row so an A–Z
 * rail can jump to it. Albums load in one go (thousands are fine); songs load in pages, and
 * `songLetterIndex` says where each letter starts.
 */
import { sql, type SQL } from 'drizzle-orm';

import type { AlbumSort, SongSort } from '@/features/library/viewOptions';

import type { AppDatabase } from '../types';
import type { AlbumSummary, TrackItem } from './browse';

/** First letter for the rail: A–Z, or "#" for digits, symbols and non-Latin scripts. */
function letterOf(expression: SQL): SQL {
  return sql`CASE WHEN upper(substr(${expression}, 1, 1)) BETWEEN 'A' AND 'Z'
    THEN upper(substr(${expression}, 1, 1)) ELSE '#' END`;
}

const direction = (descending: boolean) => (descending ? sql`DESC` : sql`ASC`);

// ─── Albums ─────────────────────────────────────────────────────────────────

export type SortedAlbum = AlbumSummary & { letter: string; addedAt: number };

const albumKey: Record<AlbumSort, SQL> = {
  title: sql`a.title_sort`,
  artist: sql`lower(a.display_artist)`,
  year: sql`a.year`,
  added: sql`added.added_at`,
  songs: sql`a.song_count`,
};

export function listAllAlbums(db: AppDatabase, sort: AlbumSort, descending: boolean): SortedAlbum[] {
  const key = albumKey[sort];
  const letterSource = sort === 'artist' ? sql`lower(a.display_artist)` : sql`a.title_sort`;
  return db.all<SortedAlbum>(sql`
    SELECT a.id AS id, a.title AS title, a.display_artist AS artist, a.year AS year,
           a.song_count AS songCount, a.artwork_key AS artworkKey, a.color_primary AS colorPrimary,
           ${letterOf(letterSource)} AS letter, added.added_at AS addedAt
    FROM albums a
    JOIN (
      SELECT album_id, max(date_added) AS added_at FROM songs WHERE is_available = 1 GROUP BY album_id
    ) added ON added.album_id = a.id
    WHERE a.song_count > 0
    -- Missing values (no year) always go last; ties fall back to the title.
    ORDER BY ${key} IS NULL, ${key} ${direction(descending)}, a.title_sort, a.id
  `);
}

// ─── Songs ──────────────────────────────────────────────────────────────────

const songKey: Record<SongSort, SQL> = {
  title: sql`s.title_sort`,
  artist: sql`lower(s.artist_display)`,
  album: sql`lower(a.title)`,
  added: sql`s.date_added`,
  duration: sql`s.duration_ms`,
  plays: sql`coalesce(st.play_count, 0)`,
};

function songLetterSource(sort: SongSort): SQL {
  return sort === 'artist' ? sql`lower(s.artist_display)` : sort === 'album' ? sql`lower(a.title)` : sql`s.title_sort`;
}

function songOrder(sort: SongSort, descending: boolean): SQL {
  const key = songKey[sort];
  return sql`${key} IS NULL, ${key} ${direction(descending)}, s.title_sort, s.id`;
}

const songFrom = sql`
  FROM songs s
  LEFT JOIN albums a ON a.id = s.album_id
  LEFT JOIN song_stats st ON st.song_id = s.id
  WHERE s.is_available = 1
`;

export function listSongsSorted(
  db: AppDatabase,
  offset: number,
  limit: number,
  sort: SongSort,
  descending: boolean,
): TrackItem[] {
  const rows = db.all<Omit<TrackItem, 'isPlayable'> & { isPlayable: number | boolean }>(sql`
    SELECT s.id AS id, s.title AS title, s.artist_display AS artist, a.title AS album, s.album_id AS albumId,
           s.track_no AS trackNo, s.disc_no AS discNo, s.duration_ms AS durationMs,
           s.is_playable AS isPlayable, coalesce(s.artwork_override, a.artwork_key) AS artworkKey
    ${songFrom}
    ORDER BY ${songOrder(sort, descending)}
    LIMIT ${limit} OFFSET ${offset}
  `);
  return rows.map((row) => ({ ...row, isPlayable: Boolean(row.isPlayable) }));
}

/** Every playable song id in this order (for "play all" and tapping a song). */
export function listSongIdsSorted(db: AppDatabase, sort: SongSort, descending: boolean): number[] {
  return db
    .all<{ id: number }>(sql`SELECT s.id AS id ${songFrom} AND s.is_playable = 1 ORDER BY ${songOrder(sort, descending)}`)
    .map((row) => row.id);
}

/** Where each letter first appears in the sorted song list (row index), in list order. */
export function songLetterIndex(
  db: AppDatabase,
  sort: SongSort,
  descending: boolean,
): { letter: string; index: number }[] {
  const rows = db.all<{ letter: string }>(sql`
    SELECT ${letterOf(songLetterSource(sort))} AS letter ${songFrom}
    ORDER BY ${songOrder(sort, descending)}
  `);
  return firstIndexes(rows.map((row) => row.letter));
}

/** First position of each letter, in the order the letters appear. */
export function firstIndexes(letters: string[]): { letter: string; index: number }[] {
  const seen = new Map<string, number>();
  letters.forEach((letter, index) => {
    if (!seen.has(letter)) seen.set(letter, index);
  });
  return [...seen.entries()].map(([letter, index]) => ({ letter, index }));
}
