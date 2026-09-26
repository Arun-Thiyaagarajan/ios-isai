import { and, asc, eq, inArray, isNull, lt, or, sql, type SQL } from 'drizzle-orm';

import { normalizeKey, sortKey } from '@/lib/normalize';

import {
  albums,
  artists,
  excludedPaths,
  folders,
  genres,
  libraryRoots,
  scanState,
  songArtists,
  songGenres,
  songs,
} from '../schema';
import type { AppDatabase } from '../types';

// ─── Scanned input ──────────────────────────────────────────────────────────

export type SongSource = 'mediastore' | 'bookmark' | 'documents';

/** One audio file as found by a platform scanner, before it becomes database rows. */
export type ScannedTrack = {
  source: SongSource;
  sourceId: string;
  rootId: number | null;
  uri: string;
  fileName: string;
  /** "/"-separated, no leading or trailing slash; "" for files at a root's top level. */
  folderPath: string;
  fileSize: number;
  mime: string | null;
  dateAdded: number;
  dateModified: number;
  durationMs: number;
  bitrate: number | null;
  title: string | null;
  artist: string | null;
  album: string | null;
  albumArtist: string | null;
  genre: string | null;
  year: number | null;
  trackNo: number | null;
  discNo: number | null;
  hasArt: boolean;
  isPlayable: boolean;
  unplayableReason: string | null;
};

export const UNKNOWN_ARTIST = 'Unknown Artist';
export const UNKNOWN_ALBUM = 'Unknown Album';

/** Files not seen for this long are removed for good (with their play counts). */
const PURGE_MISSING_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

const DISC_FOLDER = /^(cd|dis[ck])\s*\d+$/i;

function stripExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

/**
 * Albums without an album-artist tag are grouped per folder, so compilations stay together.
 * "Album/CD1" and "Album/CD2" count as the same folder.
 */
export function albumGroupHint(folderPath: string): string {
  const parts = folderPath.split('/').filter(Boolean);
  if (parts.length > 1 && DISC_FOLDER.test(parts[parts.length - 1])) {
    parts.pop();
  }
  return parts.join('/');
}

// ─── Scan lifecycle ─────────────────────────────────────────────────────────

/** Starts a scan and returns its generation number; rows not touched by it are "missing". */
export function beginScan(db: AppDatabase): number {
  const row = db.select().from(scanState).where(eq(scanState.key, 'generation')).get();
  const generation = (row ? Number(row.value) : 0) + 1;
  db.insert(scanState)
    .values({ key: 'generation', value: String(generation) })
    .onConflictDoUpdate({ target: scanState.key, set: { value: String(generation) } })
    .run();
  return generation;
}

/** Caches entity ids for the duration of one scan so each name is looked up once. */
export class ScanContext {
  readonly artists = new Map<string, number>();
  readonly albums = new Map<string, number>();
  readonly genres = new Map<string, number>();
  readonly folders = new Map<string, number>();
  constructor(readonly generation: number) {}
}

type Tx = Parameters<Parameters<AppDatabase['transaction']>[0]>[0];

function ensureArtist(tx: Tx, ctx: ScanContext, name: string): number {
  const norm = normalizeKey(name);
  const cached = ctx.artists.get(norm);
  if (cached !== undefined) {
    return cached;
  }
  const row = tx
    .insert(artists)
    .values({ name, nameSort: sortKey(name), nameNorm: norm })
    .onConflictDoUpdate({ target: artists.nameNorm, set: { nameNorm: norm } })
    .returning({ id: artists.id })
    .get();
  ctx.artists.set(norm, row.id);
  return row.id;
}

function ensureGenre(tx: Tx, ctx: ScanContext, name: string): number {
  const norm = normalizeKey(name);
  const cached = ctx.genres.get(norm);
  if (cached !== undefined) {
    return cached;
  }
  const row = tx
    .insert(genres)
    .values({ name, nameNorm: norm })
    .onConflictDoUpdate({ target: genres.nameNorm, set: { nameNorm: norm } })
    .returning({ id: genres.id })
    .get();
  ctx.genres.set(norm, row.id);
  return row.id;
}

function ensureAlbum(
  tx: Tx,
  ctx: ScanContext,
  title: string,
  albumArtistId: number | null,
  groupHint: string,
): number {
  const titleNorm = normalizeKey(title);
  const key = `${titleNorm}\u0000${albumArtistId ?? ''}\u0000${groupHint}`;
  const cached = ctx.albums.get(key);
  if (cached !== undefined) {
    return cached;
  }
  // Manual lookup: SQLite unique indexes treat NULL artists as distinct, so upsert can't be used.
  const existing = tx
    .select({ id: albums.id })
    .from(albums)
    .where(
      and(
        eq(albums.titleNorm, titleNorm),
        albumArtistId === null ? isNull(albums.albumArtistId) : eq(albums.albumArtistId, albumArtistId),
        eq(albums.groupHint, groupHint),
      ),
    )
    .get();
  const id =
    existing?.id ??
    tx
      .insert(albums)
      .values({ title, titleSort: sortKey(title), titleNorm, albumArtistId, groupHint })
      .returning({ id: albums.id })
      .get().id;
  ctx.albums.set(key, id);
  return id;
}

function ensureFolder(tx: Tx, ctx: ScanContext, path: string): number | null {
  if (!path) {
    return null;
  }
  const cached = ctx.folders.get(path);
  if (cached !== undefined) {
    return cached;
  }
  const slash = path.lastIndexOf('/');
  const parentId = slash > 0 ? ensureFolder(tx, ctx, path.slice(0, slash)) : null;
  const name = slash >= 0 ? path.slice(slash + 1) : path;
  const row = tx
    .insert(folders)
    .values({ path, name, parentId })
    .onConflictDoUpdate({ target: folders.path, set: { parentId } })
    .returning({ id: folders.id })
    .get();
  ctx.folders.set(path, row.id);
  return row.id;
}

/** Writes one batch of scanned files (insert or update) in a single transaction. */
export function upsertTracks(db: AppDatabase, ctx: ScanContext, tracks: ScannedTrack[]): void {
  if (tracks.length === 0) {
    return;
  }
  db.transaction((tx) => {
    for (const track of tracks) {
      const title = track.title?.trim() || stripExtension(track.fileName);
      const artistName = track.artist?.trim() || UNKNOWN_ARTIST;
      const albumTitle = track.album?.trim() || UNKNOWN_ALBUM;
      const albumArtistName = track.albumArtist?.trim() || null;

      const artistId = ensureArtist(tx, ctx, artistName);
      const albumArtistId = albumArtistName ? ensureArtist(tx, ctx, albumArtistName) : null;
      const albumId = ensureAlbum(
        tx,
        ctx,
        albumTitle,
        albumArtistId,
        albumArtistId === null ? albumGroupHint(track.folderPath) : '',
      );
      const folderId = ensureFolder(tx, ctx, track.folderPath);

      const fields = {
        rootId: track.rootId,
        uri: track.uri,
        folderId,
        fileName: track.fileName,
        fileSize: track.fileSize,
        mime: track.mime,
        dateModified: track.dateModified,
        durationMs: track.durationMs,
        bitrate: track.bitrate,
        title,
        titleSort: sortKey(title),
        artistDisplay: artistName,
        albumId,
        albumArtistDisplay: albumArtistName,
        year: track.year,
        trackNo: track.trackNo,
        discNo: track.discNo,
        hasArt: track.hasArt,
        isPlayable: track.isPlayable,
        unplayableReason: track.unplayableReason,
        isAvailable: true,
        missingSince: null,
        tagsScannedAt: Date.now(),
        scanGeneration: ctx.generation,
      };

      const { id: songId } = tx
        .insert(songs)
        .values({ source: track.source, sourceId: track.sourceId, dateAdded: track.dateAdded, ...fields })
        // dateAdded is kept from the first time the file was seen.
        .onConflictDoUpdate({ target: [songs.source, songs.sourceId], set: fields })
        .returning({ id: songs.id })
        .get();

      tx.delete(songArtists).where(eq(songArtists.songId, songId)).run();
      tx.insert(songArtists).values({ songId, artistId, role: 'artist', position: 0 }).run();
      if (albumArtistId !== null && albumArtistId !== artistId) {
        tx.insert(songArtists).values({ songId, artistId: albumArtistId, role: 'album_artist', position: 0 }).run();
      }

      tx.delete(songGenres).where(eq(songGenres.songId, songId)).run();
      const genreNames = (track.genre ?? '')
        .split(';')
        .map((g) => g.trim())
        .filter(Boolean);
      for (const genreName of new Set(genreNames)) {
        tx.insert(songGenres).values({ songId, genreId: ensureGenre(tx, ctx, genreName) }).onConflictDoNothing().run();
      }
    }
  });
}

/** Known files for one source/root, to skip re-reading tags of unchanged files. */
export function getKnownFiles(
  db: AppDatabase,
  source: SongSource,
  rootId: number | null,
): Map<string, { dateModified: number; fileSize: number }> {
  const rows = db
    .select({ sourceId: songs.sourceId, dateModified: songs.dateModified, fileSize: songs.fileSize })
    .from(songs)
    .where(and(eq(songs.source, source), rootId === null ? isNull(songs.rootId) : eq(songs.rootId, rootId)))
    .all();
  return new Map(rows.map((r) => [r.sourceId, { dateModified: r.dateModified, fileSize: r.fileSize }]));
}

/** Marks unchanged files as seen by this scan without rewriting them. */
export function touchSongs(db: AppDatabase, generation: number, source: SongSource, sourceIds: string[]): void {
  const CHUNK = 500;
  db.transaction((tx) => {
    for (let i = 0; i < sourceIds.length; i += CHUNK) {
      tx.update(songs)
        .set({ scanGeneration: generation, isAvailable: true, missingSince: null })
        .where(and(eq(songs.source, source), inArray(songs.sourceId, sourceIds.slice(i, i + CHUNK))))
        .run();
    }
  });
}

export type ScanScope = { sources?: SongSource[]; rootIds?: number[] };

/**
 * Finishes a scan: files in the scanned scope that weren't seen are marked missing
 * (and purged after 30 days), counts are recomputed, empty entities are removed and
 * the search index is rebuilt.
 */
export function finishScan(db: AppDatabase, generation: number, scope: ScanScope, now = Date.now()): void {
  const conditions: SQL[] = [];
  if (scope.sources?.length) {
    conditions.push(inArray(songs.source, scope.sources));
  }
  if (scope.rootIds?.length) {
    conditions.push(inArray(songs.rootId, scope.rootIds));
  }

  db.transaction((tx) => {
    if (conditions.length > 0) {
      tx.update(songs)
        .set({ isAvailable: false, missingSince: sql`coalesce(${songs.missingSince}, ${now})` })
        .where(and(lt(songs.scanGeneration, generation), or(...conditions)))
        .run();
    }
    tx.delete(songs)
      .where(and(eq(songs.isAvailable, false), lt(songs.missingSince, now - PURGE_MISSING_AFTER_MS)))
      .run();

    tx.run(sql`
      UPDATE albums SET
        song_count = (SELECT count(*) FROM songs s WHERE s.album_id = albums.id AND s.is_available = 1),
        total_duration_ms = (SELECT coalesce(sum(s.duration_ms), 0) FROM songs s WHERE s.album_id = albums.id AND s.is_available = 1),
        year = (SELECT max(s.year) FROM songs s WHERE s.album_id = albums.id AND s.is_available = 1)
    `);
    tx.run(sql`
      UPDATE artists SET
        song_count = (SELECT count(*) FROM song_artists sa JOIN songs s ON s.id = sa.song_id
                      WHERE sa.artist_id = artists.id AND sa.role = 'artist' AND s.is_available = 1),
        album_count = (SELECT count(DISTINCT s.album_id) FROM song_artists sa JOIN songs s ON s.id = sa.song_id
                       WHERE sa.artist_id = artists.id AND s.is_available = 1)
    `);
    tx.run(sql`
      UPDATE genres SET song_count = (SELECT count(*) FROM song_genres sg JOIN songs s ON s.id = sg.song_id
                                      WHERE sg.genre_id = genres.id AND s.is_available = 1)
    `);
    tx.run(sql`
      UPDATE folders SET song_count = (SELECT count(*) FROM songs s WHERE s.folder_id = folders.id AND s.is_available = 1)
    `);

    // Entities no song refers to anymore (missing songs still hold theirs until purged).
    tx.run(sql`DELETE FROM albums WHERE NOT EXISTS (SELECT 1 FROM songs s WHERE s.album_id = albums.id)`);
    tx.run(sql`DELETE FROM genres WHERE NOT EXISTS (SELECT 1 FROM song_genres sg WHERE sg.genre_id = genres.id)`);
    tx.run(sql`
      DELETE FROM artists
      WHERE NOT EXISTS (SELECT 1 FROM song_artists sa WHERE sa.artist_id = artists.id)
        AND NOT EXISTS (SELECT 1 FROM albums a WHERE a.album_artist_id = artists.id)
    `);
    // Remove empty leaf folders repeatedly until only folders with music (or music below them) remain.
    for (let i = 0; i < 64; i++) {
      const before = tx.get<{ n: number }>(sql`SELECT count(*) AS n FROM folders`)?.n ?? 0;
      tx.run(sql`
        DELETE FROM folders
        WHERE NOT EXISTS (SELECT 1 FROM songs s WHERE s.folder_id = folders.id)
          AND NOT EXISTS (SELECT 1 FROM folders c WHERE c.parent_id = folders.id)
      `);
      const after = tx.get<{ n: number }>(sql`SELECT count(*) AS n FROM folders`)?.n ?? 0;
      if (after === before) {
        break;
      }
    }

    rebuildSearchIndex(tx);
  });
}

/** Rebuilds the full-text index from scratch; a single set-based pass is fast even for 50k songs. */
export function rebuildSearchIndex(db: AppDatabase | Tx): void {
  db.run(sql`DELETE FROM search_fts`);
  db.run(sql`
    INSERT INTO search_fts (entity_type, entity_id, primary_text, secondary_text)
    SELECT 'song', s.id, s.title, s.artist_display || ' ' || coalesce(a.title, '')
    FROM songs s LEFT JOIN albums a ON a.id = s.album_id
    WHERE s.is_available = 1
  `);
  db.run(sql`
    INSERT INTO search_fts (entity_type, entity_id, primary_text, secondary_text)
    SELECT 'artist', id, name, '' FROM artists WHERE song_count > 0
  `);
  db.run(sql`
    INSERT INTO search_fts (entity_type, entity_id, primary_text, secondary_text)
    SELECT 'album', al.id, al.title, coalesce(ar.name, '')
    FROM albums al LEFT JOIN artists ar ON ar.id = al.album_artist_id
    WHERE al.song_count > 0
  `);
  db.run(sql`
    INSERT INTO search_fts (entity_type, entity_id, primary_text, secondary_text)
    SELECT 'genre', id, name, '' FROM genres WHERE song_count > 0
  `);
  db.run(sql`
    INSERT INTO search_fts (entity_type, entity_id, primary_text, secondary_text)
    SELECT 'playlist', id, name, '' FROM playlists
  `);
}

// ─── Roots (iOS folders) ────────────────────────────────────────────────────

export type LibraryRoot = typeof libraryRoots.$inferSelect;

export function listRoots(db: AppDatabase): LibraryRoot[] {
  return db.select().from(libraryRoots).orderBy(asc(libraryRoots.addedAt)).all();
}

export function addRoot(
  db: AppDatabase,
  root: { platform: 'ios' | 'android'; displayName: string; bookmark: string },
): LibraryRoot {
  return db.insert(libraryRoots).values(root).returning().get();
}

export function updateRootBookmark(db: AppDatabase, rootId: number, bookmark: string): void {
  db.update(libraryRoots).set({ bookmark }).where(eq(libraryRoots.id, rootId)).run();
}

/** Removing a folder removes its songs too (and their entries in the search index on next scan). */
export function removeRoot(db: AppDatabase, rootId: number): void {
  db.delete(libraryRoots).where(eq(libraryRoots.id, rootId)).run();
}

// ─── Reading ────────────────────────────────────────────────────────────────

export type SongListItem = {
  id: number;
  title: string;
  artist: string;
  album: string | null;
  durationMs: number;
  isPlayable: boolean;
};

export function countSongs(db: AppDatabase): number {
  return db.get<{ n: number }>(sql`SELECT count(*) AS n FROM songs WHERE is_available = 1`)?.n ?? 0;
}

/** One page of songs in title order. Offset paging over the title index stays fast at 50k rows. */
export function listSongs(db: AppDatabase, offset: number, limit: number): SongListItem[] {
  return db
    .select({
      id: songs.id,
      title: songs.title,
      artist: songs.artistDisplay,
      album: albums.title,
      durationMs: songs.durationMs,
      isPlayable: songs.isPlayable,
    })
    .from(songs)
    .leftJoin(albums, eq(albums.id, songs.albumId))
    .where(eq(songs.isAvailable, true))
    .orderBy(asc(songs.titleSort), asc(songs.id))
    .limit(limit)
    .offset(offset)
    .all();
}

// ─── Music folders (include / exclude) ──────────────────────────────────────

/** True when `folderPath` is an excluded folder or inside one. */
export function isPathExcluded(folderPath: string, excluded: readonly string[]): boolean {
  return excluded.some((prefix) => folderPath === prefix || folderPath.startsWith(`${prefix}/`));
}

export function listExcludedPaths(db: AppDatabase): string[] {
  return db
    .select({ path: excludedPaths.pathPrefix })
    .from(excludedPaths)
    .all()
    .map((row) => row.path);
}

/** Hides (or shows again) every song in a folder and its subfolders. Takes effect on the next scan. */
export function setFolderExcluded(db: AppDatabase, path: string, excluded: boolean): void {
  if (excluded) {
    db.insert(excludedPaths).values({ pathPrefix: path }).onConflictDoNothing().run();
  } else {
    db.delete(excludedPaths).where(eq(excludedPaths.pathPrefix, path)).run();
  }
}

export type MusicFolder = {
  path: string;
  /** Last path segment, e.g. "Album". */
  name: string;
  songCount: number;
  excluded: boolean;
};

/** Folders that directly contain songs, plus excluded ones (so they can be turned back on). */
export function listMusicFolders(db: AppDatabase): MusicFolder[] {
  const byPath = new Map<string, MusicFolder>();
  const rows = db.all<{ path: string; name: string; song_count: number }>(
    sql`SELECT path, name, song_count FROM folders WHERE song_count > 0`,
  );
  for (const row of rows) {
    byPath.set(row.path, { path: row.path, name: row.name, songCount: row.song_count, excluded: false });
  }
  for (const path of listExcludedPaths(db)) {
    const name = path.slice(path.lastIndexOf('/') + 1);
    const existing = byPath.get(path);
    byPath.set(path, { path, name, songCount: existing?.songCount ?? 0, excluded: true });
  }
  return [...byPath.values()].sort((a, b) =>
    a.path.localeCompare(b.path, undefined, { sensitivity: 'base', numeric: true }),
  );
}

// ─── Library summary ────────────────────────────────────────────────────────

export type LibraryStats = { songs: number; albums: number; artists: number; lastScanAt: number | null };

export function getLibraryStats(db: AppDatabase): LibraryStats {
  const row = db.get<{ songs: number; albums: number; artists: number }>(sql`
    SELECT
      (SELECT count(*) FROM songs WHERE is_available = 1) AS songs,
      (SELECT count(*) FROM albums WHERE song_count > 0) AS albums,
      (SELECT count(*) FROM artists WHERE song_count > 0) AS artists
  `);
  const last = db.select().from(scanState).where(eq(scanState.key, 'lastScanAt')).get();
  return {
    songs: row?.songs ?? 0,
    albums: row?.albums ?? 0,
    artists: row?.artists ?? 0,
    lastScanAt: last ? Number(last.value) : null,
  };
}

export function setLastScanAt(db: AppDatabase, at: number): void {
  db.insert(scanState)
    .values({ key: 'lastScanAt', value: String(at) })
    .onConflictDoUpdate({ target: scanState.key, set: { value: String(at) } })
    .run();
}
