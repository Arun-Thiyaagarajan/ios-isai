/** @jest-environment node */
import { getPlayableSongs, saveReplayGain, songsNeedingReplayGain } from '../repos/player';
import { createTestDb, makeTrack as t, scanTracks } from '../testing/testDb';

describe('ReplayGain storage', () => {
  it('keeps tags read during the scan (iOS) and passes them to the queue', () => {
    const db = createTestDb();
    scanTracks(db, [
      t({ sourceId: '1', source: 'documents', replayGain: { trackGain: -7.1, trackPeak: 0.98, albumGain: -6.5, albumPeak: 0.99 } }),
    ]);
    const [song] = getPlayableSongs(db, [1]);
    expect(song).toMatchObject({ rgTrackGain: -7.1, rgTrackPeak: 0.98, rgAlbumGain: -6.5, rgAlbumPeak: 0.99 });
    expect(songsNeedingReplayGain(db, 10)).toHaveLength(0);
  });

  it('lists Android songs until their tags are read, then stores them', () => {
    const db = createTestDb();
    scanTracks(db, [t({ sourceId: '1' }), t({ sourceId: '2', uri: 'content://media/2' })]);
    const pending = songsNeedingReplayGain(db, 10);
    expect(pending).toHaveLength(2);

    saveReplayGain(db, pending[0].id, { trackGain: -5, trackPeak: 1 });
    saveReplayGain(db, pending[1].id, {}); // no tags in that file: checked, nothing to apply
    expect(songsNeedingReplayGain(db, 10)).toHaveLength(0);
    expect(getPlayableSongs(db, [pending[0].id])[0].rgTrackGain).toBe(-5);
  });

  it('reads a file again after it changes', () => {
    const db = createTestDb();
    scanTracks(db, [t({ sourceId: '1', dateModified: 1 })]);
    const [song] = songsNeedingReplayGain(db, 10);
    saveReplayGain(db, song.id, { trackGain: -3 });
    scanTracks(db, [t({ sourceId: '1', dateModified: 2 })]);
    expect(songsNeedingReplayGain(db, 10)).toHaveLength(1);
  });
});
