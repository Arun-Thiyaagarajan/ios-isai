/**
 * Listening statistics from the play history: time listened, top songs, artists and albums,
 * and minutes per month. Only real listens count (finished, or at least 30 seconds).
 */
import { sql } from 'drizzle-orm';

import type { AppDatabase } from '../types';

export type StatsPeriod = 'month' | 'year' | 'all';

/** Start of the period (epoch ms, local time); 0 for all time. */
export function periodStart(period: StatsPeriod, now = Date.now()): number {
  const date = new Date(now);
  if (period === 'month') return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
  if (period === 'year') return new Date(date.getFullYear(), 0, 1).getTime();
  return 0;
}

const counted = sql`(e.completed = 1 OR e.ms_played >= 30000)`;

export type ListeningSummary = { minutes: number; plays: number; songs: number; artists: number };

export function listeningSummary(db: AppDatabase, since: number): ListeningSummary {
  const row = db.get<{ ms: number | null; plays: number; songs: number; artists: number }>(sql`
    SELECT sum(e.ms_played) AS ms, count(*) AS plays, count(DISTINCT e.song_id) AS songs,
           count(DISTINCT lower(s.artist_display)) AS artists
    FROM play_events e JOIN songs s ON s.id = e.song_id
    WHERE e.started_at >= ${since} AND ${counted}
  `);
  return {
    minutes: Math.round((row?.ms ?? 0) / 60_000),
    plays: row?.plays ?? 0,
    songs: row?.songs ?? 0,
    artists: row?.artists ?? 0,
  };
}

export type TopSong = {
  id: number;
  title: string;
  artist: string;
  albumId: number | null;
  artworkKey: string | null;
  plays: number;
  minutes: number;
};

export function topSongs(db: AppDatabase, since: number, limit = 10): TopSong[] {
  return db.all<TopSong>(sql`
    SELECT s.id AS id, s.title AS title, s.artist_display AS artist, s.album_id AS albumId,
           coalesce(s.artwork_override, a.artwork_key) AS artworkKey,
           count(*) AS plays, round(sum(e.ms_played) / 60000.0) AS minutes
    FROM play_events e JOIN songs s ON s.id = e.song_id LEFT JOIN albums a ON a.id = s.album_id
    WHERE e.started_at >= ${since} AND ${counted}
    GROUP BY s.id
    ORDER BY plays DESC, minutes DESC
    LIMIT ${limit}
  `);
}

export type TopArtist = { name: string; plays: number; minutes: number; albumId: number | null; artworkKey: string | null };

export function topArtists(db: AppDatabase, since: number, limit = 10): TopArtist[] {
  return db.all<TopArtist>(sql`
    SELECT min(s.artist_display) AS name, count(*) AS plays, round(sum(e.ms_played) / 60000.0) AS minutes,
           max(s.album_id) AS albumId, max(a.artwork_key) AS artworkKey
    FROM play_events e JOIN songs s ON s.id = e.song_id LEFT JOIN albums a ON a.id = s.album_id
    WHERE e.started_at >= ${since} AND ${counted}
    GROUP BY lower(s.artist_display)
    ORDER BY plays DESC, minutes DESC
    LIMIT ${limit}
  `);
}

export type TopAlbum = { id: number; title: string; artist: string; artworkKey: string | null; plays: number };

export function topAlbums(db: AppDatabase, since: number, limit = 10): TopAlbum[] {
  return db.all<TopAlbum>(sql`
    SELECT a.id AS id, a.title AS title, a.display_artist AS artist, a.artwork_key AS artworkKey, count(*) AS plays
    FROM play_events e JOIN songs s ON s.id = e.song_id JOIN albums a ON a.id = s.album_id
    WHERE e.started_at >= ${since} AND ${counted}
    GROUP BY a.id
    ORDER BY plays DESC
    LIMIT ${limit}
  `);
}

export type MonthMinutes = { monthStart: number; minutes: number };

/** Minutes listened in each of the last `months` months (oldest first, current month last). */
export function monthlyMinutes(db: AppDatabase, months = 12, now = Date.now()): MonthMinutes[] {
  const today = new Date(now);
  const starts = Array.from({ length: months }, (_, i) =>
    new Date(today.getFullYear(), today.getMonth() - (months - 1 - i), 1).getTime(),
  );
  const rows = db.all<{ started_at: number; ms_played: number }>(sql`
    SELECT e.started_at, e.ms_played FROM play_events e
    WHERE e.started_at >= ${starts[0]} AND ${counted}
  `);
  const totals = new Array<number>(months).fill(0);
  for (const row of rows) {
    // Find the month this listen belongs to (the last start at or before it).
    let index = months - 1;
    while (index > 0 && row.started_at < starts[index]) index--;
    totals[index] += row.ms_played;
  }
  return starts.map((monthStart, i) => ({ monthStart, minutes: Math.round(totals[i] / 60_000) }));
}
