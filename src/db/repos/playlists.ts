import { and, asc, count, eq, inArray, sql } from 'drizzle-orm';

import { normalizeKey } from '@/lib/normalize';

import { playlists, playlistSongs, songs } from '../schema';
import type { AppDatabase, Playlist, Song } from '../types';

/** Positions closer than this get renumbered so fractional reordering never runs out of precision. */
const MIN_GAP = 1e-6;

/**
 * Identifies a song independently of its database id, so playlist entries can be
 * re-linked after a reinstall or a MediaStore id change.
 */
export function songFingerprint(song: Pick<Song, 'title' | 'artistDisplay' | 'durationMs'>): string {
  // 2-second buckets tolerate small duration differences between encoders/scans.
  const bucket = Math.round(song.durationMs / 2000);
  return `${normalizeKey(song.title)}|${normalizeKey(song.artistDisplay)}|${bucket}`;
}

export type PlaylistSummary = Playlist & { songCount: number };

export function listPlaylists(db: AppDatabase): PlaylistSummary[] {
  return db
    .select({
      id: playlists.id,
      name: playlists.name,
      artworkUri: playlists.artworkUri,
      kind: playlists.kind,
      rulesJson: playlists.rulesJson,
      createdAt: playlists.createdAt,
      updatedAt: playlists.updatedAt,
      songCount: count(playlistSongs.id),
    })
    .from(playlists)
    .leftJoin(playlistSongs, eq(playlistSongs.playlistId, playlists.id))
    .groupBy(playlists.id)
    .orderBy(asc(sql`lower(${playlists.name})`))
    .all();
}

export function createPlaylist(db: AppDatabase, name: string): Playlist {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Playlist name cannot be empty');
  }
  return db.insert(playlists).values({ name: trimmed }).returning().get();
}

export function renamePlaylist(db: AppDatabase, playlistId: number, name: string): void {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Playlist name cannot be empty');
  }
  db.update(playlists)
    .set({ name: trimmed, updatedAt: Date.now() })
    .where(eq(playlists.id, playlistId))
    .run();
}

/** Everything needed to bring a deleted playlist back (Undo). */
export type DeletedPlaylist = { playlist: Playlist; entries: (typeof playlistSongs.$inferSelect)[] };

/** Deletes a playlist and returns what it held, so it can be restored exactly. */
export function deletePlaylist(db: AppDatabase, playlistId: number): DeletedPlaylist | null {
  return db.transaction((tx) => {
    const playlist = tx.select().from(playlists).where(eq(playlists.id, playlistId)).get();
    if (!playlist) return null;
    const entries = tx.select().from(playlistSongs).where(eq(playlistSongs.playlistId, playlistId)).all();
    tx.delete(playlists).where(eq(playlists.id, playlistId)).run();
    return { playlist, entries };
  });
}

/** Undo for deletePlaylist: same id, name, songs and order. */
export function restorePlaylist(db: AppDatabase, deleted: DeletedPlaylist): void {
  db.transaction((tx) => {
    tx.insert(playlists).values(deleted.playlist).onConflictDoNothing().run();
    if (deleted.entries.length > 0) {
      tx.insert(playlistSongs).values(deleted.entries).onConflictDoNothing().run();
    }
  });
}

export type PlaylistEntry = {
  entryId: number;
  songId: number | null;
  position: number;
  title: string | null;
  artist: string | null;
  durationMs: number | null;
};

/** Entries in order. Missing songs come back with `songId: null` so the UI can show them greyed out. */
export function getPlaylistEntries(db: AppDatabase, playlistId: number): PlaylistEntry[] {
  return db
    .select({
      entryId: playlistSongs.id,
      songId: playlistSongs.songId,
      position: playlistSongs.position,
      title: songs.title,
      artist: songs.artistDisplay,
      durationMs: songs.durationMs,
    })
    .from(playlistSongs)
    .leftJoin(songs, eq(songs.id, playlistSongs.songId))
    .where(eq(playlistSongs.playlistId, playlistId))
    .orderBy(asc(playlistSongs.position))
    .all();
}

/** Appends songs in the given order. Duplicates are allowed, as in most music players. */
export function addSongsToPlaylist(db: AppDatabase, playlistId: number, songIds: number[]): void {
  if (songIds.length === 0) {
    return;
  }
  db.transaction((tx) => {
    const rows = tx
      .select({
        id: songs.id,
        title: songs.title,
        artistDisplay: songs.artistDisplay,
        durationMs: songs.durationMs,
      })
      .from(songs)
      .where(inArray(songs.id, songIds))
      .all();
    const byId = new Map(rows.map((row) => [row.id, row]));

    const last = tx
      .select({ max: sql<number | null>`max(${playlistSongs.position})` })
      .from(playlistSongs)
      .where(eq(playlistSongs.playlistId, playlistId))
      .get();
    let position = (last?.max ?? 0) + 1;

    const values = [];
    for (const songId of songIds) {
      const song = byId.get(songId);
      if (!song) {
        continue;
      }
      values.push({ playlistId, songId, position, songFingerprint: songFingerprint(song) });
      position += 1;
    }
    if (values.length > 0) {
      tx.insert(playlistSongs).values(values).run();
      tx.update(playlists).set({ updatedAt: Date.now() }).where(eq(playlists.id, playlistId)).run();
    }
  });
}

/** Removes entries and returns them, so restorePlaylistEntries can put them back (Undo). */
export function removePlaylistEntries(
  db: AppDatabase,
  playlistId: number,
  entryIds: number[],
): (typeof playlistSongs.$inferSelect)[] {
  if (entryIds.length === 0) {
    return [];
  }
  return db.transaction((tx) => {
    const removed = tx
      .select()
      .from(playlistSongs)
      .where(and(eq(playlistSongs.playlistId, playlistId), inArray(playlistSongs.id, entryIds)))
      .all();
    tx.delete(playlistSongs)
      .where(and(eq(playlistSongs.playlistId, playlistId), inArray(playlistSongs.id, entryIds)))
      .run();
    tx.update(playlists).set({ updatedAt: Date.now() }).where(eq(playlists.id, playlistId)).run();
    return removed;
  });
}

/** Undo for removePlaylistEntries: the same rows, in their old places. */
export function restorePlaylistEntries(db: AppDatabase, entries: (typeof playlistSongs.$inferSelect)[]): void {
  if (entries.length === 0) {
    return;
  }
  db.transaction((tx) => {
    tx.insert(playlistSongs).values(entries).onConflictDoNothing().run();
    tx.update(playlists).set({ updatedAt: Date.now() }).where(eq(playlists.id, entries[0].playlistId)).run();
  });
}

/**
 * Moves one entry so it ends up at `toIndex` in the list.
 * Only the moved row is rewritten, unless neighbors are too close and the list is renumbered.
 */
export function movePlaylistEntry(
  db: AppDatabase,
  playlistId: number,
  entryId: number,
  toIndex: number,
): void {
  db.transaction((tx) => {
    const order = tx
      .select({ id: playlistSongs.id, position: playlistSongs.position })
      .from(playlistSongs)
      .where(eq(playlistSongs.playlistId, playlistId))
      .orderBy(asc(playlistSongs.position))
      .all();

    const fromIndex = order.findIndex((entry) => entry.id === entryId);
    if (fromIndex === -1) {
      throw new Error(`Entry ${entryId} is not in playlist ${playlistId}`);
    }
    const others = order.filter((entry) => entry.id !== entryId);
    const target = Math.max(0, Math.min(toIndex, others.length));
    if (target === fromIndex) {
      return;
    }

    const before = others[target - 1]?.position;
    const after = others[target]?.position;
    const position =
      before === undefined ? after! - 1 : after === undefined ? before + 1 : (before + after) / 2;

    const tooTight =
      (before !== undefined && position - before < MIN_GAP) ||
      (after !== undefined && after - position < MIN_GAP);

    if (tooTight) {
      // Renumber everything 1..n in the new order.
      const moved = order[fromIndex];
      const reordered = [...others.slice(0, target), moved, ...others.slice(target)];
      reordered.forEach((entry, index) => {
        tx.update(playlistSongs).set({ position: index + 1 }).where(eq(playlistSongs.id, entry.id)).run();
      });
    } else {
      tx.update(playlistSongs).set({ position }).where(eq(playlistSongs.id, entryId)).run();
    }
    tx.update(playlists).set({ updatedAt: Date.now() }).where(eq(playlists.id, playlistId)).run();
  });
}
