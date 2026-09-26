/** @jest-environment node */
import { eq } from 'drizzle-orm';

import { recordPlayEvents } from '../repos/history';
import { listeningSummary, monthlyMinutes, periodStart, topAlbums, topArtists, topSongs } from '../repos/stats';
import { songs } from '../schema';
import { createTestDb, makeTrack as t, scanTracks } from '../testing/testDb';

const NOW = new Date(2026, 8, 20, 12).getTime(); // 20 Sept 2026
const DAY = 24 * 60 * 60 * 1000;

function setup() {
  const db = createTestDb();
  scanTracks(db, [
    t({ sourceId: '1', title: 'A', artist: 'Anu', album: 'One', albumArtist: 'Anu' }),
    t({ sourceId: '2', title: 'B', artist: 'Bala', album: 'Two', albumArtist: 'Bala' }),
  ]);
  const id = (s: string) => db.select({ id: songs.id }).from(songs).where(eq(songs.sourceId, s)).get()!.id;
  const listen = (songId: number, at: number, msPlayed = 180_000, completed = true) => ({
    songId,
    startedAt: at,
    msPlayed,
    durationMs: 180_000,
    completed,
  });
  recordPlayEvents(db, [
    listen(id('1'), NOW - DAY),
    listen(id('1'), NOW - 2 * DAY),
    listen(id('2'), NOW - 3 * DAY),
    listen(id('2'), NOW - 40 * DAY), // last month
    listen(id('2'), NOW - DAY, 5_000, false), // a skip: not counted
  ]);
  return db;
}

describe('listening stats', () => {
  it('summarizes listening in a period, ignoring skips', () => {
    const db = setup();
    expect(listeningSummary(db, periodStart('month', NOW))).toEqual({ minutes: 9, plays: 3, songs: 2, artists: 2 });
    expect(listeningSummary(db, 0).plays).toBe(4);
  });

  it('ranks top songs, artists and albums', () => {
    const db = setup();
    const since = periodStart('month', NOW);
    expect(topSongs(db, since).map((s) => [s.title, s.plays])).toEqual([
      ['A', 2],
      ['B', 1],
    ]);
    expect(topArtists(db, 0).map((a) => [a.name, a.plays])).toEqual([
      ['Anu', 2],
      ['Bala', 2],
    ]);
    expect(topAlbums(db, since)[0].title).toBe('One');
  });

  it('adds up minutes per month, oldest first', () => {
    const months = monthlyMinutes(setup(), 3, NOW);
    expect(months).toHaveLength(3);
    expect(months.map((m) => m.minutes)).toEqual([0, 3, 9]);
    expect(new Date(months[2].monthStart).getMonth()).toBe(8);
  });
});
