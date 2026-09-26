/** @jest-environment node */
import { eq } from 'drizzle-orm';

import { recordPlayEvents } from '../repos/history';
import { listSmartPlaylist, startOfMonth } from '../repos/smartPlaylists';
import { songs } from '../schema';
import { createTestDb, makeTrack as t, scanTracks } from '../testing/testDb';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 8, 20, 12).getTime(); // 20 Sept 2026

function setup() {
  const db = createTestDb();
  scanTracks(db, [
    t({ sourceId: '1', title: 'Old Favorite', dateAdded: NOW - 400 * DAY }),
    t({ sourceId: '2', title: 'This Month', dateAdded: NOW - 200 * DAY }),
    t({ sourceId: '3', title: 'Brand New', dateAdded: NOW - 2 * DAY }),
  ]);
  const id = (sourceId: string) => db.select({ id: songs.id }).from(songs).where(eq(songs.sourceId, sourceId)).get()!.id;
  const play = (songId: number, at: number) => ({
    songId,
    startedAt: at,
    msPlayed: 200_000,
    durationMs: 200_000,
    completed: true,
  });
  // "Old Favorite": played a lot, but last 100 days ago.
  recordPlayEvents(db, [0, 1, 2, 3].map((i) => play(id('1'), NOW - (100 + i) * DAY)));
  // "This Month": played twice this month.
  recordPlayEvents(db, [play(id('2'), NOW - 1 * DAY), play(id('2'), NOW - 2 * DAY)]);
  return db;
}

const titles = (list: { title: string }[]) => list.map((s) => s.title);

describe('smart playlists', () => {
  it('On Repeat has this month’s plays', () => {
    expect(titles(listSmartPlaylist(setup(), 'onRepeat', NOW))).toEqual(['This Month']);
  });

  it('Top 25 ranks by all-time plays', () => {
    expect(titles(listSmartPlaylist(setup(), 'topSongs', NOW))).toEqual(['Old Favorite', 'This Month']);
  });

  it('Recently Added covers the last 30 days', () => {
    expect(titles(listSmartPlaylist(setup(), 'recentlyAdded', NOW))).toEqual(['Brand New']);
  });

  it('Forgotten Favorites are songs played often but not lately', () => {
    expect(titles(listSmartPlaylist(setup(), 'forgotten', NOW))).toEqual(['Old Favorite']);
  });

  it('Never Played lists songs with no plays', () => {
    expect(titles(listSmartPlaylist(setup(), 'neverPlayed', NOW))).toEqual(['Brand New']);
  });

  it('months start on the 1st', () => {
    expect(new Date(startOfMonth(NOW)).getDate()).toBe(1);
  });
});
