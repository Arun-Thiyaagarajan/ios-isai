/** @jest-environment node */
import { eq } from 'drizzle-orm';

import { buildM3u, m3uFileName, parseM3u } from '@/features/playlists/m3u';

import { importM3u, playlistForM3u } from '../repos/m3u';
import { addSongsToPlaylist, createPlaylist, getPlaylistEntries } from '../repos/playlists';
import { songs } from '../schema';
import { createTestDb, makeTrack as t, scanTracks } from '../testing/testDb';

describe('M3U text', () => {
  it('parses paths with #EXTINF details, ignoring comments and blank lines', () => {
    const text = '\uFEFF#EXTM3U\r\n#EXTINF:215,Anirudh - Vaathi Coming\r\nMusic\\Master\\Vaathi%20Coming.mp3\r\n\r\n# comment\r\nplain.flac\r\n';
    expect(parseM3u(text)).toEqual([
      { path: 'Music\\Master\\Vaathi%20Coming.mp3', durationMs: 215_000, artist: 'Anirudh', title: 'Vaathi Coming' },
      { path: 'plain.flac' },
    ]);
  });

  it('builds M3U8 that parses back to the same songs', () => {
    const text = buildM3u([{ title: 'Kanne', artist: 'Imman', durationMs: 240_400, path: 'Music/kanne.mp3' }]);
    expect(text).toBe('#EXTM3U\n#EXTINF:240,Imman - Kanne\nMusic/kanne.mp3\n');
    expect(parseM3u(text)[0]).toMatchObject({ title: 'Kanne', artist: 'Imman', path: 'Music/kanne.mp3' });
  });

  it('makes safe file names', () => {
    expect(m3uFileName('Road Trip / 2026')).toBe('Road Trip - 2026.m3u8');
    expect(m3uFileName('  ')).toBe('Playlist.m3u8');
  });
});

describe('M3U import and export', () => {
  function library() {
    const db = createTestDb();
    scanTracks(db, [
      t({ sourceId: '1', title: 'Vaathi Coming', artist: 'Anirudh', fileName: 'Vaathi Coming.mp3', folderPath: 'Music/Master', durationMs: 215_000 }),
      t({ sourceId: '2', title: 'Kannaana Kanne', artist: 'D. Imman', fileName: 'kanne.mp3', folderPath: 'Music', durationMs: 240_000 }),
    ]);
    return db;
  }
  const id = (db: ReturnType<typeof createTestDb>, title: string) =>
    db.select({ id: songs.id }).from(songs).where(eq(songs.title, title)).get()!.id;

  it('exports a playlist with folder-relative paths, in order', () => {
    const db = library();
    const playlist = createPlaylist(db, 'Mix');
    addSongsToPlaylist(db, playlist.id, [id(db, 'Kannaana Kanne'), id(db, 'Vaathi Coming')]);
    expect(playlistForM3u(db, playlist.id).map((s) => s.path)).toEqual(['Music/kanne.mp3', 'Music/Master/Vaathi Coming.mp3']);
  });

  it('imports by file name, then by title and artist, skipping unknown songs', () => {
    const db = library();
    const result = importM3u(db, 'From PC', [
      { path: 'C:\\Users\\me\\Music\\Vaathi%20Coming.mp3' },
      { path: '/sdcard/other-name.mp3', title: 'Kannaana Kanne', artist: 'D. Imman', durationMs: 241_000 },
      { path: 'missing.mp3', title: 'Not Here' },
    ]);
    expect(result).toMatchObject({ matched: 2, total: 3 });
    expect(getPlaylistEntries(db, result.playlistId).map((e) => e.songId)).toEqual([
      id(db, 'Vaathi Coming'),
      id(db, 'Kannaana Kanne'),
    ]);
  });
});
