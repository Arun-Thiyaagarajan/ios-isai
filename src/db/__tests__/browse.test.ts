/** @jest-environment node */
import {
  getAlbum,
  getLibraryCounts,
  listAlbumTracks,
  listAlbums,
  listArtistAlbums,
  listArtistSongs,
  listArtists,
  listFolderSongs,
  listGenreSongs,
  listGenres,
  listRecentlyAddedAlbums,
  listSubfolders,
} from '../repos/browse';
import { setAlbumArtwork } from '../repos/library';
import { createTestDb, makeTrack as t, scanTracks } from '../testing/testDb';

function library() {
  const db = createTestDb();
  scanTracks(db, [
    t({ sourceId: '1', title: 'Two', album: 'Blue', albumArtist: 'Band', artist: 'Band', trackNo: 2, discNo: 1, year: 2001, genre: 'Rock', folderPath: 'Music/Band/Blue', dateAdded: 100 }),
    t({ sourceId: '2', title: 'One', album: 'Blue', albumArtist: 'Band', artist: 'Band', trackNo: 1, discNo: 1, year: 2001, genre: 'Rock', folderPath: 'Music/Band/Blue', dateAdded: 100 }),
    t({ sourceId: '3', title: 'Bonus', album: 'Blue', albumArtist: 'Band', artist: 'Band', trackNo: 1, discNo: 2, year: 2001, folderPath: 'Music/Band/Blue', dateAdded: 100 }),
    t({ sourceId: '4', title: 'Hit A', album: 'Mix', artist: 'Singer A', genre: 'Pop', folderPath: 'Music/Mix', dateAdded: 300 }),
    t({ sourceId: '5', title: 'Hit B', album: 'Mix', artist: 'Singer B', genre: 'Pop', folderPath: 'Music/Mix', dateAdded: 200 }),
    t({ sourceId: '6', title: 'Solo', album: 'Alone', artist: 'Singer A', folderPath: 'Downloads', dateAdded: 50 }),
  ]);
  return db;
}

describe('browse queries', () => {
  it('counts everything', () => {
    expect(getLibraryCounts(library())).toEqual({ songs: 6, albums: 3, artists: 3, genres: 2, folders: 3 });
  });

  it('names album artists: tagged, single-artist and "Various Artists"', () => {
    const albums = listAlbums(library(), 0, 10);
    expect(albums.map((a) => [a.title, a.artist])).toEqual([
      ['Alone', 'Singer A'],
      ['Blue', 'Band'],
      ['Mix', 'Various Artists'],
    ]);
  });

  it('sorts albums by year with undated albums last', () => {
    expect(listAlbums(library(), 0, 10, 'year').map((a) => a.title)).toEqual(['Blue', 'Alone', 'Mix']);
  });

  it('orders album tracks by disc then track number', () => {
    const db = library();
    const blue = listAlbums(db, 0, 10).find((a) => a.title === 'Blue')!;
    expect(listAlbumTracks(db, blue.id).map((s) => s.title)).toEqual(['One', 'Two', 'Bonus']);
    expect(getAlbum(db, blue.id)).toMatchObject({ songCount: 3, totalDurationMs: 600_000, year: 2001 });
  });

  it('lists recently added albums newest first', () => {
    expect(listRecentlyAddedAlbums(library(), 2).map((a) => a.title)).toEqual(['Mix', 'Blue']);
  });

  it('finds an artist’s albums (including compilations) and songs', () => {
    const db = library();
    const singerA = listArtists(db, 0, 10).find((a) => a.name === 'Singer A')!;
    expect(singerA).toMatchObject({ songCount: 2, albumCount: 2 });
    expect(listArtistAlbums(db, singerA.id).map((a) => a.title).sort()).toEqual(['Alone', 'Mix']);
    expect(listArtistSongs(db, singerA.id).map((s) => s.title)).toEqual(['Hit A', 'Solo']);
  });

  it('uses album artwork as the artist picture once generated', () => {
    const db = library();
    const blue = listAlbums(db, 0, 10).find((a) => a.title === 'Blue')!;
    setAlbumArtwork(db, blue.id, 'file:///blue.jpg', { primary: '#112233', secondary: '#445566', on: '#FFFFFF' });
    const band = listArtists(db, 0, 10).find((a) => a.name === 'Band')!;
    expect(band).toMatchObject({ albumId: blue.id, artworkKey: 'file:///blue.jpg' });
  });

  it('lists genres and their songs', () => {
    const db = library();
    const genres = listGenres(db);
    expect(genres.map((g) => [g.name, g.songCount])).toEqual([
      ['Pop', 2],
      ['Rock', 2],
    ]);
    expect(listGenreSongs(db, genres[0].id).map((s) => s.title)).toEqual(['Hit A', 'Hit B']);
  });

  it('browses folders with totals that include sub-folders', () => {
    const db = library();
    expect(listSubfolders(db, null).map((f) => [f.path, f.totalSongs])).toEqual([
      ['Downloads', 1],
      ['Music', 5],
    ]);
    expect(listSubfolders(db, 'Music').map((f) => f.name)).toEqual(['Band', 'Mix']);
    expect(listFolderSongs(db, 'Music/Mix').map((s) => s.title)).toEqual(['Hit A', 'Hit B']);
  });

  it('does not count look-alike folder names as sub-folders', () => {
    const db = createTestDb();
    scanTracks(db, [
      t({ sourceId: '1', folderPath: 'My_Music' }),
      t({ sourceId: '2', folderPath: 'MyXMusic' }),
    ]);
    expect(listSubfolders(db, null).map((f) => [f.path, f.totalSongs])).toEqual([
      ['My_Music', 1],
      ['MyXMusic', 1],
    ]);
  });
});
