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

  it('returns lyrics from the file as saved', () => {
    const db = createTestDb();
    scanTracks(db, [makeTrack({ sourceId: '1', lyrics: '[00:01.00]Hello\n[00:02.00]World' })]);
    expect(getLyrics(db, songId(db, '1'))).toEqual({
      content: '[00:01.00]Hello\n[00:02.00]World',
      source: 'embedded',
    });
  });

  it('prefers lyrics typed in Edit Info', () => {
    const db = createTestDb();
    scanTracks(db, [makeTrack({ sourceId: '1', lyrics: 'from file' })]);
    const id = songId(db, '1');
    saveSongEdits(db, id, { changes: {}, lyrics: 'my words' });
    expect(getLyrics(db, id)).toEqual({ content: 'my words', source: 'user' });
  });
});
