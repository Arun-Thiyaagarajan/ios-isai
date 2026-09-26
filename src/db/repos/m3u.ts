/**
 * Playlists to and from M3U files. Exported paths are relative to the music folder
 * ("Music/Album/Song.mp3"); imported entries are matched to library songs by file name first,
 * then by title and artist (from #EXTINF) with a close length.
 */
import { sql } from 'drizzle-orm';

import type { M3uEntry, M3uSong } from '@/features/playlists/m3u';
import { fileNameOf } from '@/features/playlists/m3u';
import { normalizeKey } from '@/lib/normalize';

import type { AppDatabase } from '../types';
import { addSongsToPlaylist, createPlaylist } from './playlists';

/** A playlist's songs as M3U lines, in playlist order (missing files are left out). */
export function playlistForM3u(db: AppDatabase, playlistId: number): M3uSong[] {
  return db.all<M3uSong>(sql`
    SELECT s.title AS title, s.artist_display AS artist, s.duration_ms AS durationMs,
           CASE WHEN f.path IS NULL OR f.path = '' THEN s.file_name ELSE f.path || '/' || s.file_name END AS path
    FROM playlist_songs ps
    JOIN songs s ON s.id = ps.song_id AND s.is_available = 1
    LEFT JOIN folders f ON f.id = s.folder_id
    WHERE ps.playlist_id = ${playlistId}
    ORDER BY ps.position
  `);
}

type Candidate = { id: number; fileName: string; title: string; artist: string; durationMs: number };

/** Library song ids for M3U entries, in order; null where no song matched. */
export function matchM3uEntries(db: AppDatabase, entries: M3uEntry[]): (number | null)[] {
  const songs = db.all<Candidate>(sql`
    SELECT id, file_name AS fileName, title, artist_display AS artist, duration_ms AS durationMs
    FROM songs WHERE is_available = 1 AND duplicate_of IS NULL
  `);
  const byFile = new Map<string, number>();
  const byTitle = new Map<string, Candidate[]>();
  for (const song of songs) {
    byFile.set(song.fileName.toLowerCase(), song.id);
    const key = normalizeKey(song.title);
    byTitle.set(key, [...(byTitle.get(key) ?? []), song]);
  }

  return entries.map((entry) => {
    const byName = byFile.get(fileNameOf(entry.path).toLowerCase());
    if (byName !== undefined) return byName;
    if (!entry.title) return null;
    const candidates = byTitle.get(normalizeKey(entry.title)) ?? [];
    const best = candidates.find(
      (song) =>
        (!entry.artist || normalizeKey(song.artist) === normalizeKey(entry.artist)) &&
        (!entry.durationMs || Math.abs(song.durationMs - entry.durationMs) <= 3000),
    );
    return best?.id ?? null;
  });
}

export type M3uImportResult = { playlistId: number; matched: number; total: number };

/** Creates a playlist from M3U entries; songs that aren't in the library are skipped. */
export function importM3u(db: AppDatabase, name: string, entries: M3uEntry[]): M3uImportResult {
  const ids = matchM3uEntries(db, entries).filter((id): id is number => id !== null);
  const playlist = createPlaylist(db, name);
  addSongsToPlaylist(db, playlist.id, ids);
  return { playlistId: playlist.id, matched: ids.length, total: entries.length };
}
