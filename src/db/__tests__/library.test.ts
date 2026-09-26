/** @jest-environment node */
import { sql } from 'drizzle-orm';

import {
  ScanContext,
  albumGroupHint,
  beginScan,
  countSongs,
  finishScan,
  getKnownFiles,
  getLibraryStats,
  isPathExcluded,
  listMusicFolders,
  setFolderExcluded,
  setLastScanAt,
  touchSongs,
  upsertTracks,
  type ScannedTrack,
} from '../repos/library';
import { listSongs } from '../repos/browse';
import { createTestDb } from '../testing/testDb';

function track(overrides: Partial<ScannedTrack> = {}): ScannedTrack {
  return {
    source: 'mediastore',
    sourceId: '1',
    rootId: null,
    uri: 'content://media/1',
    fileName: 'song.mp3',
    folderPath: 'Music/Artist/Album',
    fileSize: 1000,
    mime: 'audio/mpeg',
    dateAdded: 1000,
    dateModified: 1000,
    durationMs: 200_000,
    bitrate: null,
    title: 'Song',
    artist: 'Artist',
    album: 'Album',
    albumArtist: null,
    genre: null,
    year: null,
    trackNo: null,
    discNo: null,
    hasArt: false,
    isPlayable: true,
    unplayableReason: null,
    ...overrides,
  };
}

function scan(db: ReturnType<typeof createTestDb>, tracks: ScannedTrack[], now = Date.now()) {
  const generation = beginScan(db);
  upsertTracks(db, new ScanContext(generation), tracks);
  finishScan(db, generation, { sources: ['mediastore'] }, now);
}

const count = (db: ReturnType<typeof createTestDb>, table: string) =>
  db.get<{ n: number }>(sql.raw(`SELECT count(*) AS n FROM ${table}`))!.n;

describe('library scanning', () => {
  it('builds songs, artists, albums, genres and folders', () => {
    const db = createTestDb();
    scan(db, [
      track({ sourceId: '1', title: 'One', genre: 'Rock; Indie', trackNo: 1 }),
      track({ sourceId: '2', title: 'Two', genre: 'Rock', trackNo: 2 }),
      track({ sourceId: '3', title: 'Other', artist: 'Someone Else', album: 'Else', folderPath: 'Music/Else' }),
    ]);

    expect(countSongs(db)).toBe(3);
    expect(count(db, 'artists')).toBe(2);
    expect(count(db, 'albums')).toBe(2);
    expect(count(db, 'genres')).toBe(2);
    // Music, Music/Artist, Music/Artist/Album, Music/Else
    expect(count(db, 'folders')).toBe(4);

    const album = db.get<{ song_count: number; total_duration_ms: number }>(
      sql`SELECT song_count, total_duration_ms FROM albums WHERE title = 'Album'`,
    );
    expect(album).toEqual({ song_count: 2, total_duration_ms: 400_000 });
  });

  it('falls back to the file name and "Unknown" names when tags are missing', () => {
    const db = createTestDb();
    scan(db, [track({ title: null, artist: '  ', album: null, fileName: '01 Intro.flac' })]);
    expect(listSongs(db, 0, 10)[0]).toMatchObject({
      title: '01 Intro',
      artist: 'Unknown Artist',
      album: 'Unknown Album',
    });
  });

  it('merges artist spellings that differ only by case or accents', () => {
    const db = createTestDb();
    scan(db, [
      track({ sourceId: '1', artist: 'Beyoncé' }),
      track({ sourceId: '2', artist: 'beyonce' }),
    ]);
    expect(count(db, 'artists')).toBe(1);
  });

  it('keeps an album together across CD1/CD2 folders, and separates same-named albums by artist', () => {
    const db = createTestDb();
    scan(db, [
      track({ sourceId: '1', album: 'Live', folderPath: 'Music/Live/CD1' }),
      track({ sourceId: '2', album: 'Live', folderPath: 'Music/Live/CD2' }),
      track({ sourceId: '3', album: 'Greatest Hits', albumArtist: 'A' }),
      track({ sourceId: '4', album: 'Greatest Hits', albumArtist: 'B' }),
    ]);
    const titles = db
      .all<{ title: string }>(sql`SELECT title FROM albums ORDER BY title`)
      .map((r) => r.title);
    expect(titles).toEqual(['Greatest Hits', 'Greatest Hits', 'Live']);
    expect(albumGroupHint('Music/Live/Disc 2')).toBe('Music/Live');
  });

  it('updates changed files in place and keeps their id and date added', () => {
    const db = createTestDb();
    scan(db, [track({ title: 'Old', dateAdded: 1000 })]);
    const [before] = listSongs(db, 0, 1);
    scan(db, [track({ title: 'New', dateAdded: 9999, dateModified: 2000 })]);
    const [after] = listSongs(db, 0, 1);
    expect(after.id).toBe(before.id);
    expect(after.title).toBe('New');
    const dateAdded = db.get<{ date_added: number }>(sql`SELECT date_added FROM songs`)!.date_added;
    expect(dateAdded).toBe(1000);
  });

  it('marks files that disappeared as missing, then purges them after 30 days', () => {
    const db = createTestDb();
    const day = 24 * 60 * 60 * 1000;
    scan(db, [track({ sourceId: '1' }), track({ sourceId: '2', title: 'Gone' })], 0);
    scan(db, [track({ sourceId: '1' })], day);

    expect(countSongs(db)).toBe(1);
    expect(count(db, 'songs')).toBe(2); // still stored, hidden

    scan(db, [track({ sourceId: '1' })], 32 * day);
    expect(count(db, 'songs')).toBe(1);
  });

  it('brings a missing file back when it reappears', () => {
    const db = createTestDb();
    scan(db, [track({ sourceId: '1' })], 0);
    scan(db, [], 1000);
    expect(countSongs(db)).toBe(0);
    scan(db, [track({ sourceId: '1' })], 2000);
    expect(countSongs(db)).toBe(1);
  });

  it('touches unchanged files without rewriting them', () => {
    const db = createTestDb();
    scan(db, [track({ source: 'documents', sourceId: 'a.mp3' })]);
    const known = getKnownFiles(db, 'documents', null);
    expect(known.get('a.mp3')).toEqual({ dateModified: 1000, fileSize: 1000 });

    const generation = beginScan(db);
    touchSongs(db, generation, 'documents', ['a.mp3']);
    finishScan(db, generation, { sources: ['documents'] });
    expect(countSongs(db)).toBe(1);
  });

  it('only marks missing within the scanned scope', () => {
    const db = createTestDb();
    const generation = beginScan(db);
    upsertTracks(db, new ScanContext(generation), [
      track({ source: 'mediastore', sourceId: '1' }),
      track({ source: 'documents', sourceId: 'x.mp3' }),
    ]);
    finishScan(db, generation, { sources: ['mediastore', 'documents'] });

    const next = beginScan(db);
    finishScan(db, next, { sources: ['documents'] });
    expect(countSongs(db)).toBe(1); // the MediaStore song wasn't in scope
  });

  it('fills the search index', () => {
    const db = createTestDb();
    scan(db, [track({ title: 'Halo', artist: 'Beyoncé', album: 'I Am' })]);
    const hits = db.all<{ entity_type: string }>(
      sql`SELECT entity_type FROM search_fts WHERE search_fts MATCH 'beyon*'`,
    );
    expect(hits.map((h) => h.entity_type).sort()).toEqual(['artist', 'song']);
  });

  it('lists songs alphabetically ignoring "The" and case, in pages', () => {
    const db = createTestDb();
    scan(db, [
      track({ sourceId: '1', title: 'the zebra' }),
      track({ sourceId: '2', title: 'Apple' }),
      track({ sourceId: '3', title: 'banana' }),
    ]);
    expect(listSongs(db, 0, 2).map((s) => s.title)).toEqual(['Apple', 'banana']);
    expect(listSongs(db, 2, 2).map((s) => s.title)).toEqual(['the zebra']);
  });

  it('lists music folders with counts, including excluded ones so they can be re-enabled', () => {
    const db = createTestDb();
    scan(db, [
      track({ sourceId: '1', folderPath: 'Music/A' }),
      track({ sourceId: '2', folderPath: 'Music/A' }),
      track({ sourceId: '3', folderPath: 'Music/B' }),
    ]);
    setFolderExcluded(db, 'Music/B', true);
    setFolderExcluded(db, 'Old/Stuff', true);

    expect(listMusicFolders(db)).toEqual([
      { path: 'Music/A', name: 'A', songCount: 2, excluded: false },
      { path: 'Music/B', name: 'B', songCount: 1, excluded: true },
      { path: 'Old/Stuff', name: 'Stuff', songCount: 0, excluded: true },
    ]);

    setFolderExcluded(db, 'Old/Stuff', false);
    expect(listMusicFolders(db).map((f) => f.path)).toEqual(['Music/A', 'Music/B']);
  });

  it('matches excluded folders and everything inside them, but not look-alike names', () => {
    expect(isPathExcluded('Music/Podcasts', ['Music/Podcasts'])).toBe(true);
    expect(isPathExcluded('Music/Podcasts/2024', ['Music/Podcasts'])).toBe(true);
    expect(isPathExcluded('Music/PodcastsOld', ['Music/Podcasts'])).toBe(false);
  });

  it('summarizes the library', () => {
    const db = createTestDb();
    scan(db, [track({ sourceId: '1' }), track({ sourceId: '2', artist: 'B', album: 'Other' })]);
    setLastScanAt(db, 1234);
    expect(getLibraryStats(db)).toEqual({ songs: 2, albums: 2, artists: 2, lastScanAt: 1234 });
  });
});
