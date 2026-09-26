/** @jest-environment node */
import { eq } from 'drizzle-orm';

import { createBackup, isBackup, restoreBackup } from '../repos/backup';
import { getLyrics } from '../repos/lyrics';
import { isFavorite, setFavorite } from '../repos/favorites';
import { recordPlayEvents } from '../repos/history';
import { addSongsToPlaylist, createPlaylist, getPlaylistEntries, listPlaylists } from '../repos/playlists';
import { readAllSettings, writeSetting } from '../repos/settings';
import { saveSongEdits } from '../repos/songEdits';
import { songStats, songs } from '../schema';
import { createTestDb, makeTrack as t, scanTracks } from '../testing/testDb';

const files = () => [
  t({ sourceId: '1', title: 'Kannaana Kanne', artist: 'D. Imman', durationMs: 240_000, fileName: 'kanne.mp3' }),
  t({ sourceId: '2', title: 'Rowdy Baby', artist: 'Dhanush', durationMs: 280_000, fileName: 'rowdy.mp3' }),
];

function songId(db: ReturnType<typeof createTestDb>, title: string) {
  return db.select({ id: songs.id }).from(songs).where(eq(songs.title, title)).get()!.id;
}

describe('backup and restore', () => {
  it('round-trips playlists, favorites, play counts, edits, lyrics and settings to a fresh library', () => {
    const phone = createTestDb();
    scanTracks(phone, files());
    const kanne = songId(phone, 'Kannaana Kanne');
    const rowdy = songId(phone, 'Rowdy Baby');
    const road = createPlaylist(phone, 'Road Trip');
    addSongsToPlaylist(phone, road.id, [rowdy, kanne]);
    setFavorite(phone, 'song', kanne, true);
    recordPlayEvents(phone, [{ songId: rowdy, startedAt: 1000, msPlayed: 280_000, durationMs: 280_000, completed: true }]);
    saveSongEdits(phone, kanne, { changes: { genre: 'Melody' }, lyrics: 'my words' });
    writeSetting(phone, 'profileName', 'Arun');
    writeSetting(phone, 'profilePhotoUri', 'file:///photo.jpg');

    const backup = JSON.parse(JSON.stringify(createBackup(phone)));
    expect(isBackup(backup)).toBe(true);

    // A new phone: same music (different database ids), nothing else.
    const newPhone = createTestDb();
    scanTracks(newPhone, [...files()].reverse().map((f, i) => ({ ...f, sourceId: `x${i}` })));
    const summary = restoreBackup(newPhone, backup);

    expect(summary).toMatchObject({ playlists: 1, favorites: 1, songsMissing: 0 });
    const [playlist] = listPlaylists(newPhone);
    expect(playlist.name).toBe('Road Trip');
    expect(getPlaylistEntries(newPhone, playlist.id).map((e) => e.songId)).toEqual([
      songId(newPhone, 'Rowdy Baby'),
      songId(newPhone, 'Kannaana Kanne'),
    ]);
    expect(isFavorite(newPhone, 'song', songId(newPhone, 'Kannaana Kanne'))).toBe(true);
    expect(newPhone.select().from(songStats).where(eq(songStats.songId, songId(newPhone, 'Rowdy Baby'))).get()?.playCount).toBe(1);
    expect(getLyrics(newPhone, songId(newPhone, 'Kannaana Kanne'))?.content).toBe('my words');
    expect(readAllSettings(newPhone)).toMatchObject({ profileName: 'Arun' });
    expect(readAllSettings(newPhone).profilePhotoUri).toBeUndefined();
  });

  it('merges into a playlist with the same name instead of duplicating it', () => {
    const db = createTestDb();
    scanTracks(db, files());
    const playlist = createPlaylist(db, 'Road Trip');
    addSongsToPlaylist(db, playlist.id, [songId(db, 'Rowdy Baby')]);
    const backup = createBackup(db);
    addSongsToPlaylist(db, playlist.id, [songId(db, 'Kannaana Kanne')]);

    const summary = restoreBackup(db, backup);
    expect(summary.playlists).toBe(0);
    expect(listPlaylists(db)).toHaveLength(1);
    expect(getPlaylistEntries(db, playlist.id)).toHaveLength(2);
  });

  it('counts songs that aren’t on this phone', () => {
    const phone = createTestDb();
    scanTracks(phone, files());
    setFavorite(phone, 'song', songId(phone, 'Rowdy Baby'), true);
    const backup = createBackup(phone);

    const other = createTestDb();
    scanTracks(other, [files()[0]]);
    expect(restoreBackup(other, backup)).toMatchObject({ favorites: 0, songsMissing: 1 });
  });

  it('rejects files that aren’t Isai backups', () => {
    expect(isBackup({ format: 'something-else', version: 1, playlists: [], favorites: [] })).toBe(false);
    expect(isBackup({ format: 'isai-backup', version: 99, playlists: [], favorites: [] })).toBe(false);
    expect(isBackup(null)).toBe(false);
  });
});
