/** @jest-environment node */
import { eq } from 'drizzle-orm';

import {
  getSongInfo,
  listFavoriteSongs,
  listMostPlayedTracks,
  listPlaylistSummaries,
  listPlaylistTracks,
  listRecentlyPlayedTracks,
} from '../repos/browse';
import { setFavorite } from '../repos/favorites';
import { markRecentlyPlayed, recordPlayEvents } from '../repos/history';
import { getPlayableSongs, listSongIds, loadSavedQueue, saveQueue } from '../repos/player';
import { addSongsToPlaylist, createPlaylist } from '../repos/playlists';
import { songs } from '../schema';
import { createTestDb, makeTrack as t, scanTracks } from '../testing/testDb';

function library() {
  const db = createTestDb();
  scanTracks(db, [
    t({ sourceId: '1', title: 'Alpha', album: 'Blue', uri: 'content://1' }),
    t({ sourceId: '2', title: 'Beta', album: 'Blue', uri: 'content://2' }),
    t({ sourceId: '3', title: 'Gamma', album: 'Red', uri: 'content://3', isPlayable: false, unplayableReason: 'WMA' }),
  ]);
  const id = (title: string) => db.select({ id: songs.id }).from(songs).where(eq(songs.title, title)).get()!.id;
  return { db, alpha: id('Alpha'), beta: id('Beta'), gamma: id('Gamma') };
}

describe('player queries', () => {
  it('returns songs in the requested order, keeping duplicates and dropping unknown ids', () => {
    const { db, alpha, beta } = library();
    const result = getPlayableSongs(db, [beta, 999, alpha, beta]);
    expect(result.map((s) => s.title)).toEqual(['Beta', 'Alpha', 'Beta']);
    expect(result[0]).toMatchObject({ uri: 'content://2', source: 'mediastore', isPlayable: true });
  });

  it('reports unplayable songs so the queue can skip them', () => {
    const { db, gamma } = library();
    expect(getPlayableSongs(db, [gamma])[0].isPlayable).toBe(false);
  });

  it('lists all song ids A–Z', () => {
    const { db, alpha, beta, gamma } = library();
    expect(listSongIds(db)).toEqual([alpha, beta, gamma]);
  });

  it('saves and restores the queue', () => {
    const { db, alpha, beta } = library();
    expect(loadSavedQueue(db)).toBeNull();
    const saved = { songIds: [alpha, beta], index: 1, positionMs: 4200, shuffle: true, originalOrder: [1, 0], repeat: 'all' as const };
    saveQueue(db, saved);
    expect(loadSavedQueue(db)).toEqual(saved);
  });
});

describe('playlists and favorites', () => {
  it('summarizes playlists with the first song’s artwork source', () => {
    const { db, alpha, beta } = library();
    const playlist = createPlaylist(db, 'Mix');
    addSongsToPlaylist(db, playlist.id, [beta, alpha]);
    const [summary] = listPlaylistSummaries(db);
    expect(summary).toMatchObject({ name: 'Mix', songCount: 2, totalDurationMs: 400_000 });
    expect(summary.albumId).not.toBeNull();
  });

  it('keeps missing songs in a playlist as placeholders', () => {
    const { db, alpha, beta } = library();
    const playlist = createPlaylist(db, 'Mix');
    addSongsToPlaylist(db, playlist.id, [alpha, beta]);
    db.update(songs).set({ isAvailable: false }).where(eq(songs.id, beta)).run();

    const tracks = listPlaylistTracks(db, playlist.id);
    expect(tracks.map((tr) => [tr.title, tr.missing])).toEqual([
      ['Alpha', false],
      ['Beta', true],
    ]);
    expect(tracks[1].isPlayable).toBe(false);
  });

  it('lists favorite songs newest first and reports favorite state', () => {
    const { db, alpha, beta } = library();
    setFavorite(db, 'song', alpha, true);
    setFavorite(db, 'song', beta, true);
    expect(listFavoriteSongs(db).map((s) => s.title).sort()).toEqual(['Alpha', 'Beta']);
    expect(getSongInfo(db, alpha)).toMatchObject({ title: 'Alpha', isFavorite: true, album: 'Blue' });
    setFavorite(db, 'song', alpha, false);
    expect(getSongInfo(db, alpha)?.isFavorite).toBe(false);
  });
});

describe('listening history', () => {
  it('shows a song in Recently Played as soon as it starts, without counting a play', () => {
    const { db, alpha, beta } = library();
    markRecentlyPlayed(db, alpha, 1000);
    markRecentlyPlayed(db, beta, 2000);
    expect(listRecentlyPlayedTracks(db, 10).map((s) => s.title)).toEqual(['Beta', 'Alpha']);
    expect(listMostPlayedTracks(db, 10)).toEqual([]);
  });

  it('keeps the newest time when a skip follows, and counts finished listens', () => {
    const { db, alpha, beta } = library();
    markRecentlyPlayed(db, alpha, 5000);
    recordPlayEvents(db, [{ songId: alpha, startedAt: 5000, msPlayed: 2000, durationMs: 200_000, completed: false }]);
    markRecentlyPlayed(db, beta, 6000);
    recordPlayEvents(db, [{ songId: beta, startedAt: 6000, msPlayed: 200_000, durationMs: 200_000, completed: true }]);
    markRecentlyPlayed(db, alpha, 3000); // an older timestamp never moves it back
    expect(listRecentlyPlayedTracks(db, 10).map((s) => s.title)).toEqual(['Beta', 'Alpha']);
    expect(listMostPlayedTracks(db, 10).map((s) => [s.title, s.playCount])).toEqual([['Beta', 1]]);
  });
});
