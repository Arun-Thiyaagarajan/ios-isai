/** @jest-environment node */
import { eq } from 'drizzle-orm';

import { getLyrics } from '../repos/lyrics';
import { saveSongEdits } from '../repos/songEdits';
import { songs } from '../schema';
import { createTestDb, makeTrack, scanTracks } from '../testing/testDb';

function songId(db: ReturnType<typeof createTestDb>, sourceId: string): number {
  return db.select({ id: songs.id }).from(songs).where(eq(songs.sourceId, sourceId)).get()!.id;
}

describe('getLyrics', () => {
  it('returns null when a song has no lyrics', () => {
    const db = createTestDb();
    scanTracks(db, [makeTrack({ sourceId: '1' })]);
    expect(getLyrics(db, songId(db, '1'))).toBeNull();
  });

  it('returns lyrics from the file, line by line', () => {
    const db = createTestDb();
    scanTracks(db, [makeTrack({ sourceId: '1', lyrics: 'First line\r\nSecond line\n\nVerse two' })]);
    expect(getLyrics(db, songId(db, '1'))).toEqual({
      lines: ['First line', 'Second line', '', 'Verse two'],
      source: 'embedded',
    });
  });

  it('strips LRC timestamps and header tags', () => {
    const db = createTestDb();
    scanTracks(db, [makeTrack({ sourceId: '1', lyrics: '[ar:Someone]\n[00:12.30]Hello\n[00:15.00][01:15.00]Chorus' })]);
    expect(getLyrics(db, songId(db, '1'))?.lines).toEqual(['Hello', 'Chorus']);
  });

  it('prefers lyrics typed in Edit Info', () => {
    const db = createTestDb();
    scanTracks(db, [makeTrack({ sourceId: '1', lyrics: 'from file' })]);
    const id = songId(db, '1');
    saveSongEdits(db, id, { changes: {}, lyrics: 'my words' });
    expect(getLyrics(db, id)).toEqual({ lines: ['my words'], source: 'user' });
  });
});
