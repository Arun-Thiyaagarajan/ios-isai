import { sql } from 'drizzle-orm';

import { settings } from '../schema';
import type { AppDatabase } from '../types';

/** What the player needs to know about a song to queue it. */
export type PlayableSong = {
  id: number;
  title: string;
  artist: string;
  album: string | null;
  albumId: number | null;
  durationMs: number;
  isPlayable: boolean;
  source: 'mediastore' | 'bookmark' | 'documents' | 'ipod';
  sourceId: string;
  uri: string;
  bookmark: string | null;
  artworkKey: string | null;
  /** ReplayGain tags (null when the file has none, or they weren't read yet). */
  rgTrackGain: number | null;
  rgTrackPeak: number | null;
  rgAlbumGain: number | null;
  rgAlbumPeak: number | null;
};

/** Looks up songs for the queue, returned in the order of `ids` (duplicates kept, missing ones dropped). */
export function getPlayableSongs(db: AppDatabase, ids: number[]): PlayableSong[] {
  if (ids.length === 0) {
    return [];
  }
  const byId = new Map<number, PlayableSong>();
  const CHUNK = 500;
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    const rows = db.all<Omit<PlayableSong, 'isPlayable'> & { isPlayable: number }>(sql`
      SELECT s.id AS id, s.title AS title, s.artist_display AS artist, a.title AS album, s.album_id AS albumId,
             s.duration_ms AS durationMs, s.is_playable AS isPlayable, s.source AS source, s.source_id AS sourceId,
             s.uri AS uri, r.bookmark AS bookmark,
             coalesce(s.artwork_override, a.artwork_key) AS artworkKey,
             s.rg_track_gain AS rgTrackGain, s.rg_track_peak AS rgTrackPeak,
             s.rg_album_gain AS rgAlbumGain, s.rg_album_peak AS rgAlbumPeak
      FROM songs s
      LEFT JOIN albums a ON a.id = s.album_id
      LEFT JOIN library_roots r ON r.id = s.root_id
      WHERE s.is_available = 1 AND s.id IN (${sql.join(
        chunk.map((id) => sql`${id}`),
        sql`, `,
      )})
    `);
    for (const row of rows) {
      byId.set(row.id, { ...row, isPlayable: Boolean(row.isPlayable) });
    }
  }
  return ids.map((id) => byId.get(id)).filter((song): song is PlayableSong => song !== undefined);
}

/** All song ids in A–Z order, for "play from the Songs list". */
export function listSongIds(db: AppDatabase): number[] {
  return db
    .all<{ id: number }>(sql`SELECT id FROM songs WHERE is_available = 1 AND duplicate_of IS NULL ORDER BY title_sort, id`)
    .map((row) => row.id);
}

// ─── Saved queue ────────────────────────────────────────────────────────────

/** The queue as saved between launches (song ids, not queue keys). */
export type SavedQueue = {
  songIds: number[];
  index: number;
  positionMs: number;
  shuffle: boolean;
  /** Positions into `songIds` in pre-shuffle order. */
  originalOrder: number[] | null;
  repeat: 'off' | 'all' | 'one';
};

const QUEUE_KEY = 'player.queue';

export function loadSavedQueue(db: AppDatabase): SavedQueue | null {
  const row = db.get<{ value_json: string }>(sql`SELECT value_json FROM ${settings} WHERE key = ${QUEUE_KEY}`);
  if (!row) {
    return null;
  }
  try {
    const value = JSON.parse(row.value_json) as SavedQueue;
    return Array.isArray(value.songIds) ? value : null;
  } catch {
    return null;
  }
}

export function saveQueue(db: AppDatabase, queue: SavedQueue): void {
  const valueJson = JSON.stringify(queue);
  db.insert(settings)
    .values({ key: QUEUE_KEY, valueJson })
    .onConflictDoUpdate({ target: settings.key, set: { valueJson } })
    .run();
}

// ─── Volume levelling (ReplayGain) ──────────────────────────────────────────

/** Android songs whose ReplayGain tags haven't been read yet (the media database lacks them). */
export function songsNeedingReplayGain(db: AppDatabase, limit: number): { id: number; uri: string }[] {
  return db.all<{ id: number; uri: string }>(sql`
    SELECT id, uri FROM songs
    WHERE source = 'mediastore' AND is_available = 1 AND replay_gain_read_at IS NULL
    LIMIT ${limit}
  `);
}

export function saveReplayGain(
  db: AppDatabase,
  songId: number,
  tags: { trackGain?: number | null; trackPeak?: number | null; albumGain?: number | null; albumPeak?: number | null },
  now = Date.now(),
): void {
  db.run(sql`
    UPDATE songs SET
      rg_track_gain = ${tags.trackGain ?? null}, rg_track_peak = ${tags.trackPeak ?? null},
      rg_album_gain = ${tags.albumGain ?? null}, rg_album_peak = ${tags.albumPeak ?? null},
      replay_gain_read_at = ${now}
    WHERE id = ${songId}
  `);
}

/**
 * A song's artwork as the library has it now: its own cover (Edit Info), else its album's
 * thumbnail. `albumKey` is null when the album thumbnail hasn't been generated yet, "" for none.
 */
export function getSongArtwork(
  db: AppDatabase,
  songId: number,
): { override: string | null; albumKey: string | null } | undefined {
  return db.get<{ override: string | null; albumKey: string | null }>(sql`
    SELECT s.artwork_override AS override, a.artwork_key AS albumKey
    FROM songs s LEFT JOIN albums a ON a.id = s.album_id
    WHERE s.id = ${songId}
  `);
}
