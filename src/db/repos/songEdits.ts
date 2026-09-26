/**
 * Edit Song Info: reading a song's editable details and saving the user's changes.
 *
 * Edits are stored in `song_overrides` (only changed fields) and applied through the same
 * `upsertTracks` path the scanner uses, so albums, artists, genres, counts and search stay
 * consistent, and every later scan re-applies them. Writing tags into the audio file itself
 * isn't supported yet on either platform.
 */
import { eq, sql } from 'drizzle-orm';

import { fileExtension } from '@/features/library/formats';

import { songOverrides, songs } from '../schema';
import { parseOverride, type SongEditableFields, type SongOverride } from '../songFields';
import type { AppDatabase } from '../types';
import { ScanContext, refreshAggregates, sourceKey, upsertTracks, type ScannedTrack } from './library';
import { reindexSongs } from './search';

export type SongEditData = {
  songId: number;
  fields: SongEditableFields;
  lyrics: string;
  /** Cover shown now: the user's cover, else the album's; null when there is none. */
  artworkUri: string | null;
  /** The user picked or removed a cover in Isai (vs. the album's own artwork). */
  hasCustomArtwork: boolean;
  albumId: number | null;
  file: { name: string; format: string; folder: string };
};

type SongRow = {
  id: number;
  source: ScannedTrack['source'];
  sourceId: string;
  rootId: number | null;
  uri: string;
  fileName: string;
  folderPath: string | null;
  fileSize: number;
  mime: string | null;
  codec: string | null;
  dateAdded: number;
  dateModified: number;
  durationMs: number;
  bitrate: number | null;
  title: string;
  artist: string;
  album: string | null;
  albumId: number | null;
  albumArtist: string | null;
  composer: string | null;
  comment: string | null;
  copyright: string | null;
  bpm: number | null;
  year: number | null;
  trackNo: number | null;
  discNo: number | null;
  hasArt: number;
  isPlayable: number;
  unplayableReason: string | null;
  scanGeneration: number;
  genres: string | null;
  lyrics: string | null;
  lyricsSource: string | null;
  artworkOverride: string | null;
  albumArtwork: string | null;
};

function loadSong(db: AppDatabase, songId: number): SongRow | undefined {
  return db.get<SongRow>(sql`
    SELECT s.id AS id, s.source AS source, s.source_id AS sourceId, s.root_id AS rootId, s.uri AS uri,
           s.file_name AS fileName, f.path AS folderPath, s.file_size AS fileSize, s.mime AS mime, s.codec AS codec,
           s.date_added AS dateAdded, s.date_modified AS dateModified, s.duration_ms AS durationMs,
           s.bitrate AS bitrate, s.title AS title, s.artist_display AS artist, a.title AS album,
           s.album_id AS albumId, s.album_artist_display AS albumArtist, s.composer AS composer,
           s.comment AS comment, s.copyright AS copyright, s.bpm AS bpm, s.year AS year,
           s.track_no AS trackNo, s.disc_no AS discNo, s.has_art AS hasArt, s.is_playable AS isPlayable,
           s.unplayable_reason AS unplayableReason, s.scan_generation AS scanGeneration,
           (SELECT group_concat(g.name, '; ') FROM song_genres sg JOIN genres g ON g.id = sg.genre_id
            WHERE sg.song_id = s.id) AS genres,
           l.content AS lyrics, l.source AS lyricsSource,
           s.artwork_override AS artworkOverride, a.artwork_key AS albumArtwork
    FROM songs s
    LEFT JOIN albums a ON a.id = s.album_id
    LEFT JOIN folders f ON f.id = s.folder_id
    LEFT JOIN lyrics_cache l ON l.song_id = s.id
    WHERE s.id = ${songId}
  `);
}

export function getSongEditData(db: AppDatabase, songId: number): SongEditData | null {
  const row = loadSong(db, songId);
  if (!row) return null;
  const ext = fileExtension(row.fileName).toUpperCase();
  return {
    songId: row.id,
    fields: {
      title: row.title,
      artist: row.artist,
      album: row.album ?? '',
      albumArtist: row.albumArtist ?? '',
      composer: row.composer ?? '',
      genre: row.genres ?? '',
      year: row.year,
      trackNo: row.trackNo,
      discNo: row.discNo,
      bpm: row.bpm,
      comment: row.comment ?? '',
      copyright: row.copyright ?? '',
    },
    lyrics: row.lyrics ?? '',
    artworkUri: row.artworkOverride !== null ? row.artworkOverride || null : row.albumArtwork || null,
    hasCustomArtwork: row.artworkOverride !== null,
    albumId: row.albumId,
    file: {
      name: row.fileName,
      format: [ext || null, row.mime].filter(Boolean).join(' · ') || 'Unknown',
      folder: row.folderPath ?? '',
    },
  };
}

/** What to do with the cover: keep it, use a new image (file URI), remove it, or go back to the album's. */
export type ArtworkChange =
  | { kind: 'keep' }
  | { kind: 'set'; uri: string }
  | { kind: 'remove' }
  | { kind: 'reset' };

export type SongEditInput = {
  /** Only the fields that changed (see `changedFields`). */
  changes: SongOverride;
  /** New lyrics; undefined leaves them untouched, "" removes them. */
  lyrics?: string;
  artwork?: ArtworkChange;
};

/**
 * Saves edits and brings the library up to date (albums, artists, genres, counts, search).
 * Throws if the song no longer exists.
 */
export function saveSongEdits(db: AppDatabase, songId: number, input: SongEditInput): void {
  const row = loadSong(db, songId);
  if (!row) {
    throw new Error('This song is no longer in your library.');
  }
  const key = sourceKey(row.source, row.sourceId);

  // 1. Remember the edits (merged with earlier ones) so every future scan re-applies them.
  if (Object.keys(input.changes).length > 0) {
    const existing = db.select().from(songOverrides).where(eq(songOverrides.songId, songId)).get();
    const merged: SongOverride = { ...parseOverride(existing?.dataJson), ...input.changes };
    const dataJson = JSON.stringify(merged);
    db.insert(songOverrides)
      .values({ songId, sourceKey: key, dataJson, updatedAt: Date.now() })
      .onConflictDoUpdate({ target: songOverrides.songId, set: { sourceKey: key, dataJson, updatedAt: Date.now() } })
      .run();

    // 2. Re-run the scanner's write path for this song with its current details; it applies the edits.
    const track: ScannedTrack = {
      source: row.source,
      sourceId: row.sourceId,
      rootId: row.rootId,
      uri: row.uri,
      fileName: row.fileName,
      folderPath: row.folderPath ?? '',
      fileSize: row.fileSize,
      mime: row.mime,
      dateAdded: row.dateAdded,
      dateModified: row.dateModified,
      durationMs: row.durationMs,
      bitrate: row.bitrate,
      title: row.title,
      artist: row.artist,
      album: row.album,
      albumArtist: row.albumArtist,
      genre: row.genres,
      year: row.year,
      trackNo: row.trackNo,
      discNo: row.discNo,
      hasArt: Boolean(row.hasArt),
      composer: row.composer,
      comment: row.comment,
      copyright: row.copyright,
      bpm: row.bpm,
      // Keep lyrics that came from the file; the user's own lyrics are handled below.
      lyrics: row.lyricsSource === 'embedded' ? row.lyrics : null,
      isPlayable: Boolean(row.isPlayable),
      unplayableReason: row.unplayableReason,
    };
    upsertTracks(db, new ScanContext(row.scanGeneration), [track]);
  }

  // 3. Lyrics typed by the user ("" hides lyrics even if the file has some).
  if (input.lyrics !== undefined) {
    const content = input.lyrics.trim();
    db.run(sql`
      INSERT INTO lyrics_cache (song_id, source, is_synced, content, updated_at)
      VALUES (${songId}, 'user', 0, ${content}, ${Date.now()})
      ON CONFLICT (song_id) DO UPDATE SET source = 'user', is_synced = 0, content = excluded.content,
        updated_at = excluded.updated_at
    `);
    db.update(songs).set({ hasLyrics: content !== '' }).where(eq(songs.id, songId)).run();
  }

  // 4. Cover.
  const artwork = input.artwork ?? { kind: 'keep' };
  if (artwork.kind !== 'keep') {
    const artworkOverride = artwork.kind === 'set' ? artwork.uri : artwork.kind === 'remove' ? '' : null;
    db.update(songs).set({ artworkOverride }).where(eq(songs.id, songId)).run();
  }

  // 5. Counts, album artists, empty albums/artists, and search.
  refreshAggregates(db);
  reindexSongs(db, [songId]);
}
