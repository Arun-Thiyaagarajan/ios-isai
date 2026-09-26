import { eq } from 'drizzle-orm';

import { lyricsCache } from '../schema';
import type { AppDatabase } from '../types';

export type SongLyrics = {
  /** Plain text, one line per line; timestamps from synced lyrics are removed. */
  lines: string[];
  source: 'embedded' | 'sidecar' | 'online' | 'user';
};

/** "[01:23.45]" and "[ar:Artist]"-style tags at the start of LRC lines. */
const LRC_TAG = /^\s*(\[[^\]]*\]\s*)+/;

/** Saved lyrics for a song (from the file or typed in Edit Info), or null if there are none. */
export function getLyrics(db: AppDatabase, songId: number): SongLyrics | null {
  const row = db.select().from(lyricsCache).where(eq(lyricsCache.songId, songId)).get();
  if (!row || row.content.trim() === '') {
    return null;
  }
  const lines = row.content
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(LRC_TAG, '').trimEnd());
  // Drop blank lines at the ends (LRC headers leave some behind), keep the ones between verses.
  while (lines.length > 0 && lines[0].trim() === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
  return lines.length > 0 ? { lines, source: row.source } : null;
}
