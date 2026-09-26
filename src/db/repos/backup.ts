/**
 * Backup and restore of everything the listener made: playlists, favorites, play counts, edited
 * song info, their own lyrics, and settings. The music files themselves aren't included.
 *
 * Songs are stored by what they are (title, artist, length, file name), not by database id, so a
 * backup restores onto a re-scanned library or a new phone. Restoring merges: nothing already
 * there is deleted.
 */
import { and, asc, eq, sql } from 'drizzle-orm';

import { normalizeKey } from '@/lib/normalize';

import { favorites, lyricsCache, playlistSongs, playlists, songOverrides, songStats } from '../schema';
import { parseOverride, type SongOverride } from '../songFields';
import type { AppDatabase } from '../types';
import { addSongsToPlaylist, createPlaylist } from './playlists';
import { readAllSettings, writeSetting } from './settings';
import { saveSongEdits } from './songEdits';

export const BACKUP_FORMAT = 'isai-backup';
export const BACKUP_VERSION = 1;

/** How a song is recognised in a backup. */
export type SongRef = { title: string; artist: string; durationMs: number; fileName: string };

export type Backup = {
  format: typeof BACKUP_FORMAT;
  version: number;
  createdAt: number;
  settings: Record<string, unknown>;
  playlists: { name: string; createdAt: number; songs: SongRef[] }[];
  favorites: SongRef[];
  stats: { song: SongRef; playCount: number; skipCount: number; firstPlayedAt: number | null; lastPlayedAt: number | null }[];
  edits: { song: SongRef; fields: SongOverride }[];
  lyrics: { song: SongRef; content: string }[];
};

/** Settings that only make sense on this device (a photo file path). */
const DEVICE_ONLY_SETTINGS = new Set(['profilePhotoUri']);

type SongRow = { id: number; title: string; artist: string; durationMs: number; fileName: string };

function refOf(row: SongRow): SongRef {
  return { title: row.title, artist: row.artist, durationMs: row.durationMs, fileName: row.fileName };
}

/** Same song = same title and artist, lengths within about 2 seconds (encoders differ slightly). */
function fingerprint(ref: Pick<SongRef, 'title' | 'artist' | 'durationMs'>): string {
  return `${normalizeKey(ref.title)}|${normalizeKey(ref.artist)}|${Math.round(ref.durationMs / 2000)}`;
}

function allSongs(db: AppDatabase): SongRow[] {
  return db.all<SongRow>(sql`
    SELECT id, title, artist_display AS artist, duration_ms AS durationMs, file_name AS fileName FROM songs
  `);
}

export function createBackup(db: AppDatabase, now = Date.now()): Backup {
  const byId = new Map(allSongs(db).map((row) => [row.id, row]));
  const ref = (songId: number | null) => (songId !== null && byId.has(songId) ? refOf(byId.get(songId)!) : null);

  const settings = readAllSettings(db);
  for (const key of DEVICE_ONLY_SETTINGS) delete settings[key];

  const lists = db.select().from(playlists).orderBy(asc(playlists.createdAt)).all();
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: now,
    settings,
    playlists: lists.map((playlist) => ({
      name: playlist.name,
      createdAt: playlist.createdAt,
      songs: db
        .select({ songId: playlistSongs.songId })
        .from(playlistSongs)
        .where(eq(playlistSongs.playlistId, playlist.id))
        .orderBy(asc(playlistSongs.position))
        .all()
        .map((entry) => ref(entry.songId))
        .filter((r): r is SongRef => r !== null),
    })),
    favorites: db
      .select({ id: favorites.entityId })
      .from(favorites)
      .where(eq(favorites.entityType, 'song'))
      .all()
      .map((row) => ref(row.id))
      .filter((r): r is SongRef => r !== null),
    stats: db
      .select()
      .from(songStats)
      .all()
      .flatMap((row) => {
        const song = ref(row.songId);
        return song
          ? [{ song, playCount: row.playCount, skipCount: row.skipCount, firstPlayedAt: row.firstPlayedAt, lastPlayedAt: row.lastPlayedAt }]
          : [];
      }),
    edits: db
      .select()
      .from(songOverrides)
      .all()
      .flatMap((row) => {
        const song = ref(row.songId);
        return song ? [{ song, fields: parseOverride(row.dataJson) }] : [];
      }),
    lyrics: db
      .select()
      .from(lyricsCache)
      .where(eq(lyricsCache.source, 'user'))
      .all()
      .flatMap((row) => {
        const song = ref(row.songId);
        return song ? [{ song, content: row.content }] : [];
      }),
  };
}

/** Checks a parsed file really is an Isai backup this version can read. */
export function isBackup(value: unknown): value is Backup {
  const v = value as Partial<Backup> | null;
  return (
    !!v &&
    v.format === BACKUP_FORMAT &&
    typeof v.version === 'number' &&
    v.version <= BACKUP_VERSION &&
    Array.isArray(v.playlists) &&
    Array.isArray(v.favorites)
  );
}

export type RestoreSummary = {
  playlists: number;
  favorites: number;
  songsFound: number;
  songsMissing: number;
};

export function restoreBackup(db: AppDatabase, backup: Backup): RestoreSummary {
  const rows = allSongs(db);
  const byFingerprint = new Map(rows.map((row) => [fingerprint(row), row.id]));
  const byFileName = new Map(rows.map((row) => [row.fileName.toLowerCase(), row.id]));
  const missing = new Set<string>();
  const found = new Set<number>();
  const match = (ref: SongRef): number | null => {
    const id = byFingerprint.get(fingerprint(ref)) ?? byFileName.get(ref.fileName.toLowerCase()) ?? null;
    if (id === null) missing.add(fingerprint(ref));
    else found.add(id);
    return id;
  };

  let playlistCount = 0;
  let favoriteCount = 0;

  // Playlists: new ones are created; one with the same name gets the songs it doesn't have yet.
  for (const saved of backup.playlists) {
    const ids = saved.songs.map(match).filter((id): id is number => id !== null);
    const existing = db
      .select({ id: playlists.id })
      .from(playlists)
      .where(sql`lower(${playlists.name}) = lower(${saved.name})`)
      .get();
    if (existing) {
      const present = new Set(
        db
          .select({ songId: playlistSongs.songId })
          .from(playlistSongs)
          .where(eq(playlistSongs.playlistId, existing.id))
          .all()
          .map((row) => row.songId),
      );
      addSongsToPlaylist(db, existing.id, ids.filter((id) => !present.has(id)));
    } else {
      const created = createPlaylist(db, saved.name);
      addSongsToPlaylist(db, created.id, ids);
      playlistCount++;
    }
  }

  for (const ref of backup.favorites) {
    const id = match(ref);
    if (id === null) continue;
    const already = db
      .select()
      .from(favorites)
      .where(and(eq(favorites.entityType, 'song'), eq(favorites.entityId, id)))
      .get();
    if (!already) {
      db.insert(favorites).values({ entityType: 'song', entityId: id }).run();
      favoriteCount++;
    }
  }

  // Play counts: keep the higher numbers and the wider date range.
  for (const saved of backup.stats ?? []) {
    const id = match(saved.song);
    if (id === null) continue;
    db.insert(songStats)
      .values({
        songId: id,
        playCount: saved.playCount,
        skipCount: saved.skipCount,
        firstPlayedAt: saved.firstPlayedAt,
        lastPlayedAt: saved.lastPlayedAt,
      })
      .onConflictDoUpdate({
        target: songStats.songId,
        set: {
          playCount: sql`max(${songStats.playCount}, ${saved.playCount})`,
          skipCount: sql`max(${songStats.skipCount}, ${saved.skipCount})`,
          firstPlayedAt: sql`min(coalesce(${songStats.firstPlayedAt}, ${saved.firstPlayedAt}), coalesce(${saved.firstPlayedAt}, ${songStats.firstPlayedAt}))`,
          lastPlayedAt: sql`max(coalesce(${songStats.lastPlayedAt}, 0), coalesce(${saved.lastPlayedAt}, 0))`,
        },
      })
      .run();
  }

  // Edited song info and the listener's own lyrics, applied like edits made on this phone.
  for (const edit of backup.edits ?? []) {
    const id = match(edit.song);
    if (id !== null) saveSongEdits(db, id, { changes: edit.fields });
  }
  for (const saved of backup.lyrics ?? []) {
    const id = match(saved.song);
    if (id !== null) saveSongEdits(db, id, { changes: {}, lyrics: saved.content });
  }

  for (const [key, value] of Object.entries(backup.settings ?? {})) {
    if (!DEVICE_ONLY_SETTINGS.has(key)) writeSetting(db, key, value);
  }

  return { playlists: playlistCount, favorites: favoriteCount, songsFound: found.size, songsMissing: missing.size };
}

