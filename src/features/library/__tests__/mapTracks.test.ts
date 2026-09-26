import type { MediaStoreRow } from '@modules/isai-library';

import { playability } from '../formats';
import { folderFileToTrack, mediaStoreRowToTrack } from '../mapTracks';

const row: MediaStoreRow = {
  id: '42',
  uri: 'content://media/external/audio/media/42',
  title: 'Song',
  artist: 'Artist',
  album: 'Album',
  albumArtist: null,
  genre: null,
  year: 2020,
  trackNo: 3,
  discNo: 1,
  durationMs: 1000,
  fileSize: 10,
  mime: 'audio/flac',
  dateAdded: 1,
  dateModified: 2,
  fileName: 'song.flac',
  relativePath: 'Music/Artist/Album/',
  volume: 'external_primary',
  bitrate: null,
  composer: 'A Composer',
};

describe('mediaStoreRowToTrack', () => {
  it('uses the relative path as the folder', () => {
    expect(mediaStoreRowToTrack(row).folderPath).toBe('Music/Artist/Album');
  });

  it('prefixes SD-card volumes', () => {
    expect(mediaStoreRowToTrack({ ...row, volume: '1234-ABCD' }).folderPath).toBe('1234-ABCD/Music/Artist/Album');
  });
});

describe('folderFileToTrack', () => {
  const file = { path: 'Artist/Album/01 Song.mp3', uri: 'file:///x', fileSize: 5, dateModified: 7 };

  it('prefixes bookmark ids and uses the root name as the top folder', () => {
    const track = folderFileToTrack({ kind: 'bookmark', rootId: 9, name: 'Music' }, file, undefined, 100);
    expect(track).toMatchObject({
      source: 'bookmark',
      sourceId: '9/Artist/Album/01 Song.mp3',
      rootId: 9,
      fileName: '01 Song.mp3',
      folderPath: 'Music/Artist/Album',
      dateAdded: 100,
      title: null,
    });
  });

  it('handles files at the top of the Documents folder', () => {
    const track = folderFileToTrack(
      { kind: 'documents', name: 'Isai' },
      { ...file, path: 'song.m4a' },
      { path: 'song.m4a', readable: true, durationMs: 1234, hasArt: true, title: 'T' },
      0,
    );
    expect(track).toMatchObject({ source: 'documents', sourceId: 'song.m4a', folderPath: 'Isai', title: 'T', durationMs: 1234 });
  });
});

describe('playability', () => {
  it('flags WMA as unsupported on both platforms', () => {
    expect(playability('ios', 'a.wma', null).isPlayable).toBe(false);
    expect(playability('android', 'a.bin', 'audio/x-ms-wma').isPlayable).toBe(false);
    expect(playability('ios', 'a.FLAC', null)).toEqual({ isPlayable: true, unplayableReason: null });
  });

  it('flags Ogg and Opus on iPhone only', () => {
    expect(playability('ios', 'a.opus', null).isPlayable).toBe(false);
    expect(playability('ios', 'a.ogg', null).unplayableReason).toMatch(/iPhone/);
    expect(playability('android', 'a.opus', 'audio/ogg').isPlayable).toBe(true);
  });
});
