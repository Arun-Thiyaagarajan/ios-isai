/**
 * Smart playlists: lists that fill themselves from your library and listening history.
 * They're computed when opened, so they're always current.
 */
import { sql, type SQL } from 'drizzle-orm';

import type { AppDatabase } from '../types';
import type { TrackItem } from './browse';

export const SMART_PLAYLIST_IDS = ['onRepeat', 'topSongs', 'recentlyAdded', 'forgotten', 'neverPlayed'] as const;
export type SmartPlaylistId = (typeof SMART_PLAYLIST_IDS)[number];

export type SmartPlaylistDefinition = {
  id: SmartPlaylistId;
  name: string;
  description: string;
};

export const SMART_PLAYLISTS: Record<SmartPlaylistId, SmartPlaylistDefinition> = {
  onRepeat: { id: 'onRepeat', name: 'On Repeat', description: 'Your most played songs this month' },
  topSongs: { id: 'topSongs', name: 'Top 25', description: 'Your most played songs of all time' },
  recentlyAdded: { id: 'recentlyAdded', name: 'Recently Added', description: 'Songs added in the last 30 days' },
  forgotten: { id: 'forgotten', name: 'Forgotten Favorites', description: 'Songs you loved but haven’t played in two months' },
  neverPlayed: { id: 'neverPlayed', name: 'Never Played', description: 'Songs waiting for their first listen' },
};

export function isSmartPlaylistId(value: unknown): value is SmartPlaylistId {
  return typeof value === 'string' && (SMART_PLAYLIST_IDS as readonly string[]).includes(value);
}

const DAY = 24 * 60 * 60 * 1000;

/** Start of the current calendar month (local time). */
export function startOfMonth(now: number): number {
  const date = new Date(now);
  return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
}

function tracks(db: AppDatabase, from: SQL, order: SQL, limit: number): TrackItem[] {
  const rows = db.all<Omit<TrackItem, 'isPlayable'> & { isPlayable: number | boolean }>(sql`
    SELECT s.id AS id, s.title AS title, s.artist_display AS artist, a.title AS album, s.album_id AS albumId,
           s.track_no AS trackNo, s.disc_no AS discNo, s.duration_ms AS durationMs,
           s.is_playable AS isPlayable, coalesce(s.artwork_override, a.artwork_key) AS artworkKey
    FROM songs s
    LEFT JOIN albums a ON a.id = s.album_id
    LEFT JOIN song_stats st ON st.song_id = s.id
    ${from}
    AND s.duplicate_of IS NULL
    ORDER BY ${order}
    LIMIT ${limit}
  `);
  return rows.map((row) => ({ ...row, isPlayable: Boolean(row.isPlayable) }));
}

/** The songs in a smart playlist right now. */
export function listSmartPlaylist(db: AppDatabase, id: SmartPlaylistId, now = Date.now()): TrackItem[] {
  switch (id) {
    case 'onRepeat': {
      const since = startOfMonth(now);
      return tracks(
        db,
        sql`JOIN (SELECT song_id, count(*) AS plays FROM play_events
                  WHERE started_at >= ${since} AND (completed = 1 OR ms_played >= 30000)
                  GROUP BY song_id) m ON m.song_id = s.id
            WHERE s.is_available = 1`,
        sql`m.plays DESC, s.title_sort`,
        50,
      );
    }
    case 'topSongs':
      return tracks(
        db,
        sql`WHERE s.is_available = 1 AND st.play_count > 0`,
        sql`st.play_count DESC, st.last_played_at DESC`,
        25,
      );
    case 'recentlyAdded':
      return tracks(db, sql`WHERE s.is_available = 1 AND s.date_added >= ${now - 30 * DAY}`, sql`s.date_added DESC`, 200);
    case 'forgotten':
      return tracks(
        db,
        sql`WHERE s.is_available = 1 AND st.play_count >= 3 AND st.last_played_at < ${now - 60 * DAY}`,
        sql`st.play_count DESC`,
        100,
      );
    case 'neverPlayed':
      return tracks(
        db,
        sql`WHERE s.is_available = 1 AND coalesce(st.play_count, 0) = 0 AND st.last_played_at IS NULL`,
        sql`s.date_added DESC`,
        200,
      );
  }
}
