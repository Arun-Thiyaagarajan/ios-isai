/** @jest-environment node */
import { eq } from 'drizzle-orm';

import { isFavorite, listFavoriteIds, toggleFavorite } from '../repos/favorites';
import {
  countsAsPlay,
  mostPlayedSongIds,
  recentlyPlayedSongIds,
  recordPlayEvents,
} from '../repos/history';
import {
  addSongsToPlaylist,
  createPlaylist,
  deletePlaylist,
  getPlaylistEntries,
  listPlaylists,
  movePlaylistEntry,
  removePlaylistEntries,
  renamePlaylist,
  restorePlaylist,
  restorePlaylistEntries,
  songFingerprint,
} from '../repos/playlists';
import { readAllSettings, writeSetting } from '../repos/settings';
import { songs } from '../schema';
import { createTestDb, insertSong } from '../testing/testDb';

describe('settings repo', () => {
  it('round-trips JSON values and overwrites', () => {
    const db = createTestDb();
    writeSetting(db, 'themePreference', 'dark');
    writeSetting(db, 'oledBlack', true);
    writeSetting(db, 'themePreference', 'light');
    expect(readAllSettings(db)).toEqual({ themePreference: 'light', oledBlack: true });
  });
});

describe('playlists repo', () => {
  function setup() {
    const db = createTestDb();
    const ids = ['A', 'B', 'C', 'D'].map((title) => insertSong(db, { title }));
    const playlist = createPlaylist(db, '  Road Trip ');
    addSongsToPlaylist(db, playlist.id, ids);
    const titles = () => getPlaylistEntries(db, playlist.id).map((entry) => entry.title);
    const entryId = (title: string) =>
      getPlaylistEntries(db, playlist.id).find((entry) => entry.title === title)!.entryId;
    return { db, ids, playlist, titles, entryId };
  }

  it('creates with a trimmed name and appends in order', () => {
    const { db, playlist, titles } = setup();
    expect(playlist.name).toBe('Road Trip');
    expect(titles()).toEqual(['A', 'B', 'C', 'D']);
    expect(listPlaylists(db)[0].songCount).toBe(4);
  });

  it('rejects empty names', () => {
    expect(() => createPlaylist(createTestDb(), '   ')).toThrow();
  });

  it('moves entries to the front, middle and end', () => {
    const { db, playlist, titles, entryId } = setup();
    movePlaylistEntry(db, playlist.id, entryId('D'), 0);
    expect(titles()).toEqual(['D', 'A', 'B', 'C']);
    movePlaylistEntry(db, playlist.id, entryId('D'), 2);
    expect(titles()).toEqual(['A', 'B', 'D', 'C']);
    movePlaylistEntry(db, playlist.id, entryId('A'), 3);
    expect(titles()).toEqual(['B', 'D', 'C', 'A']);
  });

  it('stays correct after many moves into the same gap (renumbering)', () => {
    const { db, playlist, titles, entryId } = setup();
    for (let i = 0; i < 60; i++) {
      movePlaylistEntry(db, playlist.id, entryId(i % 2 === 0 ? 'C' : 'D'), 1);
    }
    expect(titles()).toEqual(['A', 'D', 'C', 'B']);
  });

  it('removes entries, renames and deletes', () => {
    const { db, playlist, titles, entryId } = setup();
    removePlaylistEntries(db, playlist.id, [entryId('B')]);
    expect(titles()).toEqual(['A', 'C', 'D']);
    renamePlaylist(db, playlist.id, 'Night Drive');
    expect(listPlaylists(db)[0].name).toBe('Night Drive');
    deletePlaylist(db, playlist.id);
    expect(listPlaylists(db)).toEqual([]);
  });

  it('undoes removing entries and deleting the playlist', () => {
    const { db, playlist, titles, entryId } = setup();
    const removed = removePlaylistEntries(db, playlist.id, [entryId('B'), entryId('D')]);
    expect(titles()).toEqual(['A', 'C']);
    restorePlaylistEntries(db, removed);
    expect(titles()).toEqual(['A', 'B', 'C', 'D']);

    const deleted = deletePlaylist(db, playlist.id)!;
    expect(listPlaylists(db)).toEqual([]);
    restorePlaylist(db, deleted);
    expect(listPlaylists(db)[0]).toMatchObject({ id: playlist.id, name: 'Road Trip', songCount: 4 });
    expect(titles()).toEqual(['A', 'B', 'C', 'D']);
  });

  it('keeps entries of deleted songs so they can be re-linked', () => {
    const { db, ids, playlist } = setup();
    db.delete(songs).where(eq(songs.id, ids[0])).run();
    const entries = getPlaylistEntries(db, playlist.id);
    expect(entries).toHaveLength(4);
    expect(entries[0].songId).toBeNull();
  });

  it('fingerprints ignore case, diacritics and tiny duration differences', () => {
    const a = songFingerprint({ title: 'Café  Song', artistDisplay: 'ARTIST', durationMs: 200_400 });
    const b = songFingerprint({ title: 'cafe song', artistDisplay: 'artist', durationMs: 200_900 });
    expect(a).toBe(b);
  });
});

describe('favorites repo', () => {
  it('toggles and lists most recent first', () => {
    const db = createTestDb();
    expect(toggleFavorite(db, 'song', 1)).toBe(true);
    expect(toggleFavorite(db, 'song', 2)).toBe(true);
    expect(isFavorite(db, 'song', 1)).toBe(true);
    expect(toggleFavorite(db, 'song', 1)).toBe(false);
    expect(listFavoriteIds(db, 'song')).toEqual([2]);
    expect(listFavoriteIds(db, 'album')).toEqual([]);
  });
});

describe('history repo', () => {
  it('decides what counts as a play', () => {
    expect(countsAsPlay(10_000, 200_000, true)).toBe(true);
    expect(countsAsPlay(30_000, 200_000, false)).toBe(true);
    expect(countsAsPlay(29_000, 200_000, false)).toBe(false);
    expect(countsAsPlay(21_000, 40_000, false)).toBe(true); // half of a short song
  });

  it('updates play counts, skips and recency', () => {
    const db = createTestDb();
    const a = insertSong(db);
    const b = insertSong(db);
    recordPlayEvents(db, [
      { songId: a, startedAt: 1000, msPlayed: 200_000, durationMs: 200_000, completed: true },
      { songId: a, startedAt: 2000, msPlayed: 200_000, durationMs: 200_000, completed: true },
      { songId: b, startedAt: 3000, msPlayed: 200_000, durationMs: 200_000, completed: true },
      { songId: b, startedAt: 4000, msPlayed: 5_000, durationMs: 200_000, completed: false },
    ]);
    expect(mostPlayedSongIds(db)).toEqual([a, b]);
    expect(recentlyPlayedSongIds(db)).toEqual([b, a]);
  });
});
