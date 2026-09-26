/** @jest-environment node */
import type { NativeQueueItem, PlaybackStateEvent } from '@modules/isai-audio';

import { countSongs, getLibraryStats } from '@/db/repos/library';
import { getLyrics } from '@/db/repos/lyrics';
import { listPlaylists } from '@/db/repos/playlists';
import { songs } from '@/db/schema';
import { createTestDb } from '@/db/testing/testDb';

import { demoAudio } from '../demoAudio';
import { seedDemoLibrary } from '../demoLibrary';

describe('demo library', () => {
  it('fills an empty library once', () => {
    const db = createTestDb();
    seedDemoLibrary(db);
    const stats = getLibraryStats(db);
    expect(stats.songs).toBe(20);
    expect(stats.albums).toBe(5);
    expect(listPlaylists(db)).toHaveLength(1);

    const withLyrics = db.select().from(songs).all().find((s) => s.title === 'Vinmeen Vithaiyil');
    expect(getLyrics(db, withLyrics!.id)?.content).toContain('[00:06.00]');

    seedDemoLibrary(db);
    expect(countSongs(db)).toBe(20);
  });
});

describe('demo audio engine', () => {
  const item = (key: string, durationMs = 180_000): NativeQueueItem => ({
    key,
    title: key,
    artist: 'A',
    album: null,
    artworkUri: null,
    durationMs,
  });

  it('plays, skips and reports state like the native engine', async () => {
    jest.useFakeTimers();
    const engine = demoAudio();
    const states: PlaybackStateEvent[] = [];
    const sub = engine.addListener('onPlaybackState', (e) => states.push(e));

    await engine.setQueue([item('a', 1000), item('b'), item('c')], 0, 0, true);
    expect(states.at(-1)).toMatchObject({ key: 'a', isPlaying: true, queueLength: 3 });

    // Song "a" ends by itself and "b" starts.
    jest.advanceTimersByTime(1000);
    expect(states.at(-1)).toMatchObject({ key: 'b', isPlaying: true, positionMs: 0 });

    await engine.skipToNext();
    expect(states.at(-1)?.key).toBe('c');

    await engine.pause();
    expect(states.at(-1)?.isPlaying).toBe(false);

    await engine.move(2, 0);
    expect((await engine.getState())?.keys).toEqual(['c', 'a', 'b']);
    expect(states.at(-1)?.key).toBe('c');

    sub.remove();
    jest.useRealTimers();
  });
});
