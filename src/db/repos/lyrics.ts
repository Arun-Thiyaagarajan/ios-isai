import { eq } from 'drizzle-orm';

import { lyricsCache } from '../schema';
import type { AppDatabase } from '../types';

export type SongLyrics = {
  /** As saved: plain text or LRC (time-synced); parse with `parseLyrics`. */
  content: string;
  source: 'embedded' | 'sidecar' | 'online' | 'user';
};

/** Saved lyrics for a song (from the file, a .lrc next to it, or Edit Info), or null. */
export function getLyrics(db: AppDatabase, songId: number): SongLyrics | null {
  const row = db.select().from(lyricsCache).where(eq(lyricsCache.songId, songId)).get();
  if (!row || row.content.trim() === '') {
    return null;
  }
  return { content: row.content, source: row.source };
}
