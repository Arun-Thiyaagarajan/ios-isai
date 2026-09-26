/** @jest-environment node */
import { listSongs } from '../repos/browse';
import { countSongs, setDuplicateHiding } from '../repos/library';
import { searchLibrary } from '../repos/search';
import { createTestDb, makeTrack as t, scanTracks } from '../testing/testDb';

function library() {
  const db = createTestDb();
  scanTracks(db, [
    // The same song twice: a 128 kbps copy and a 320 kbps copy (a second or so apart in length).
    t({ sourceId: '1', title: 'Vaathi Coming', artist: 'Anirudh', durationMs: 200_000, bitrate: 128_000, fileSize: 3_000_000 }),
    t({ sourceId: '2', title: 'vaathi coming', artist: 'ANIRUDH', durationMs: 201_000, bitrate: 320_000, fileSize: 8_000_000 }),
    // Same title, different artist: not a duplicate.
    t({ sourceId: '3', title: 'Vaathi Coming', artist: 'Someone Else', durationMs: 200_000 }),
  ]);
  return db;
}

describe('hide duplicates', () => {
  it('shows every copy while off', () => {
    const db = library();
    expect(countSongs(db)).toBe(3);
  });

  it('keeps only the best copy of each song when on, and brings them back when off', () => {
    const db = library();
    setDuplicateHiding(db, true);
    expect(countSongs(db)).toBe(2);
    const kept = listSongs(db, 0, 10).find((s) => s.artist.toLowerCase() === 'anirudh');
    expect(kept?.title).toBe('vaathi coming'); // the 320 kbps copy
    expect(searchLibrary(db, 'vaathi').songs).toHaveLength(2);

    setDuplicateHiding(db, false);
    expect(countSongs(db)).toBe(3);
  });

  it('stays applied after a rescan', () => {
    const db = library();
    setDuplicateHiding(db, true);
    scanTracks(db, [
      t({ sourceId: '1', title: 'Vaathi Coming', artist: 'Anirudh', durationMs: 200_000, bitrate: 128_000, fileSize: 3_000_000 }),
      t({ sourceId: '2', title: 'vaathi coming', artist: 'ANIRUDH', durationMs: 201_000, bitrate: 320_000, fileSize: 8_000_000 }),
      t({ sourceId: '3', title: 'Vaathi Coming', artist: 'Someone Else', durationMs: 200_000 }),
      t({ sourceId: '4', title: 'New Song', artist: 'Anirudh' }),
    ]);
    expect(countSongs(db)).toBe(3);
  });
});
