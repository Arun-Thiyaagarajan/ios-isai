/** @jest-environment node */
import {
  firstIndexes,
  listAllAlbums,
  listAllArtists,
  listSongIdsSorted,
  listSongsSorted,
  songLetterIndex,
} from '../repos/libraryLists';
import { createTestDb, makeTrack as t, scanTracks } from '../testing/testDb';

function library() {
  const db = createTestDb();
  scanTracks(db, [
    t({ sourceId: '1', title: 'Beta', artist: 'Zed', album: 'Mango', albumArtist: 'Zed', year: 2001, durationMs: 200_000, dateAdded: 100 }),
    t({ sourceId: '2', title: 'alpha', artist: 'Anu', album: 'Kite', albumArtist: 'Anu', year: 2019, durationMs: 100_000, dateAdded: 300 }),
    t({ sourceId: '3', title: 'Charlie', artist: 'Anu', album: 'Kite', albumArtist: 'Anu', year: 2019, durationMs: 300_000, dateAdded: 200 }),
    t({ sourceId: '4', title: '99 Luftballons', artist: 'Nena', album: '1983', albumArtist: 'Nena', durationMs: 150_000, dateAdded: 50 }),
  ]);
  return db;
}

describe('listAllAlbums', () => {
  it('sorts by title A–Z and Z–A with rail letters', () => {
    const db = library();
    expect(listAllAlbums(db, 'title', false).map((a) => [a.title, a.letter])).toEqual([
      ['1983', '#'],
      ['Kite', 'K'],
      ['Mango', 'M'],
    ]);
    expect(listAllAlbums(db, 'title', true).map((a) => a.title)).toEqual(['Mango', 'Kite', '1983']);
  });

  it('sorts by artist, year (missing years last), recently added and song count', () => {
    const db = library();
    expect(listAllAlbums(db, 'artist', false).map((a) => a.artist)).toEqual(['Anu', 'Nena', 'Zed']);
    expect(listAllAlbums(db, 'year', true).map((a) => a.title)).toEqual(['Kite', 'Mango', '1983']);
    expect(listAllAlbums(db, 'year', false).map((a) => a.title)).toEqual(['Mango', 'Kite', '1983']);
    expect(listAllAlbums(db, 'added', true).map((a) => a.title)).toEqual(['Kite', 'Mango', '1983']);
    expect(listAllAlbums(db, 'songs', true)[0].title).toBe('Kite');
  });
});

describe('sorted songs', () => {
  it('pages songs in the chosen order', () => {
    const db = library();
    expect(listSongsSorted(db, 0, 10, 'title', false).map((s) => s.title)).toEqual([
      '99 Luftballons',
      'alpha',
      'Beta',
      'Charlie',
    ]);
    expect(listSongsSorted(db, 0, 2, 'duration', true).map((s) => s.title)).toEqual(['Charlie', 'Beta']);
    expect(listSongsSorted(db, 1, 2, 'added', true).map((s) => s.title)).toEqual(['Charlie', 'Beta']);
  });

  it('lists ids and letter positions in the same order', () => {
    const db = library();
    expect(listSongIdsSorted(db, 'title', false)).toHaveLength(4);
    expect(songLetterIndex(db, 'title', false)).toEqual([
      { letter: '#', index: 0 },
      { letter: 'A', index: 1 },
      { letter: 'B', index: 2 },
      { letter: 'C', index: 3 },
    ]);
  });
});

describe('firstIndexes', () => {
  it('keeps the first position of each letter, in order', () => {
    expect(firstIndexes(['A', 'A', 'B', '#', 'B'])).toEqual([
      { letter: 'A', index: 0 },
      { letter: 'B', index: 2 },
      { letter: '#', index: 3 },
    ]);
  });
});

describe('listAllArtists', () => {
  it('sorts by name, album count and song count', () => {
    const db = library();
    expect(listAllArtists(db, 'name', false).map((a) => [a.name, a.letter])).toEqual([
      ['Anu', 'A'],
      ['Nena', 'N'],
      ['Zed', 'Z'],
    ]);
    expect(listAllArtists(db, 'name', true).map((a) => a.name)).toEqual(['Zed', 'Nena', 'Anu']);
    expect(listAllArtists(db, 'songs', true)[0].name).toBe('Anu');
  });
});
