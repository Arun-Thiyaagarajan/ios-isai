import { desc, gt, isNotNull, sql } from 'drizzle-orm';

import { playEvents, songStats } from '../schema';
import type { AppDatabase } from '../types';

/** A listen reported by the audio engine when a track ends or is skipped. */
export type PlayEventInput = {
  songId: number;
  startedAt: number;
  msPlayed: number;
  durationMs: number;
  completed: boolean;
  context?: string | null;
};

/** Minimum listening time for a play to count, unless half the song is shorter. */
const MIN_COUNTED_MS = 30_000;

/**
 * A listen counts as a play when the song finished, or when the listener heard at least
 * 30 seconds or half the song (whichever is shorter). Anything less is a skip.
 */
export function countsAsPlay(msPlayed: number, durationMs: number, completed: boolean): boolean {
  if (completed) {
    return true;
  }
  const threshold = durationMs > 0 ? Math.min(MIN_COUNTED_MS, durationMs / 2) : MIN_COUNTED_MS;
  return msPlayed >= threshold;
}

/** Stores the raw event and updates the per-song counters in one transaction. */
export function recordPlayEvents(db: AppDatabase, events: PlayEventInput[]): void {
  if (events.length === 0) {
    return;
  }
  db.transaction((tx) => {
    for (const event of events) {
      tx.insert(playEvents)
        .values({
          songId: event.songId,
          startedAt: event.startedAt,
          msPlayed: event.msPlayed,
          completed: event.completed,
          context: event.context ?? null,
        })
        .run();

      const played = countsAsPlay(event.msPlayed, event.durationMs, event.completed);
      tx.insert(songStats)
        .values({
          songId: event.songId,
          playCount: played ? 1 : 0,
          skipCount: played ? 0 : 1,
          firstPlayedAt: played ? event.startedAt : null,
          lastPlayedAt: played ? event.startedAt : null,
        })
        .onConflictDoUpdate({
          target: songStats.songId,
          set: played
            ? {
                playCount: sql`${songStats.playCount} + 1`,
                firstPlayedAt: sql`coalesce(${songStats.firstPlayedAt}, ${event.startedAt})`,
                lastPlayedAt: sql`max(coalesce(${songStats.lastPlayedAt}, 0), ${event.startedAt})`,
              }
            : { skipCount: sql`${songStats.skipCount} + 1` },
        })
        .run();
    }
  });
}

export function recentlyPlayedSongIds(db: AppDatabase, limit = 20): number[] {
  return db
    .select({ id: songStats.songId })
    .from(songStats)
    .where(isNotNull(songStats.lastPlayedAt))
    .orderBy(desc(songStats.lastPlayedAt))
    .limit(limit)
    .all()
    .map((row) => row.id);
}

export function mostPlayedSongIds(db: AppDatabase, limit = 20): number[] {
  return db
    .select({ id: songStats.songId })
    .from(songStats)
    .where(gt(songStats.playCount, 0))
    .orderBy(desc(songStats.playCount), desc(songStats.lastPlayedAt))
    .limit(limit)
    .all()
    .map((row) => row.id);
}
