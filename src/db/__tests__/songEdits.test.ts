/** @jest-environment node */
import { eq, sql } from 'drizzle-orm';

import { getAlbum, getSongInfo, listAlbums, listSongs } from '../repos/browse';
import { getSongEditData, saveSongEdits } from '../repos/songEdits';
import { searchLibrary } from '../repos/search';
import { songs } from '../schema';
import {
  applyOverride,
  changedFields,
  parseNumberInput,
  parseOverride,
  validateSongFields,
  type SongEditableFields,
} from '../songFields';
import { createTestDb, makeTrack as t, scanTracks } from '../testing/testDb';

const files = () => [
  t({ sourceId: '1', title: 'One', artist: 'Band', album: 'Blue', albumArtist: 'Band', trackNo: 1, year: 2001, genre: 'Rock', composer: 'Writer' }),
  t({ sourceId: '2', title: 'Two', artist: 'Band', album: 'Blue', albumArtist: 'Band', trackNo: 2, year: 2001, genre: 'Rock', lyrics: 'file words' }),
];

function setup() {
  const db = createTestDb();
  scanTracks(db, files());
  const id = (title: string) => db.select({ id: songs.id }).from(songs).where(eq(songs.title, title)).get()!.id;
  return { db, one: id('One'), two: id('Two') };
}

describe('getSongEditData', () => {
  it('returns every editable field with safe defaults', () => {
    const { db, one } = setup();
    const data = getSongEditData(db, one)!;
    expect(data.fields).toEqual({
      title: 'One',
      artist: 'Band',
      album: 'Blue',
      albumArtist: 'Band',
      composer: 'Writer',
      genre: 'Rock',
      year: 2001,
      trackNo: 1,
      discNo: null,
      bpm: null,
      comment: '',
      copyright: '',
    });
    expect(data.lyrics).toBe('');
    expect(data.file).toMatchObject({ name: 'song.mp3', folder: 'Music/Artist/Album' });
    expect(data.file.format).toContain('MP3');
    expect(data.hasCustomArtwork).toBe(false);
  });

  it('returns null for a song that does not exist', () => {
    const { db } = setup();
    expect(getSongEditData(db, 9999)).toBeNull();
  });
});

describe('saveSongEdits', () => {
  it('changes only the edited fields and updates lists and search immediately', () => {
    const { db, one } = setup();
    saveSongEdits(db, one, { changes: { title: 'Uno', bpm: 120, comment: 'live take' } });

    const data = getSongEditData(db, one)!;
    expect(data.fields).toMatchObject({ title: 'Uno', bpm: 120, comment: 'live take', artist: 'Band', trackNo: 1 });
    expect(listSongs(db, 0, 10).map((s) => s.title)).toContain('Uno');
    expect(searchLibrary(db, 'uno').songs.map((s) => s.id)).toEqual([one]);
    expect(searchLibrary(db, 'live take').songs.map((s) => s.id)).toEqual([one]);
  });

  it('keeps edits when the library is scanned again with the original tags', () => {
    const { db, one } = setup();
    saveSongEdits(db, one, { changes: { title: 'Uno', artist: 'Solo Artist' } });
    scanTracks(db, files());

    expect(getSongInfo(db, one)).toMatchObject({ title: 'Uno', artist: 'Solo Artist' });
    expect(getSongEditData(db, one)!.fields.composer).toBe('Writer');
  });

  it('moves a song to another album and removes the album left empty', () => {
    const { db, one, two } = setup();
    saveSongEdits(db, one, { changes: { album: 'Red', albumArtist: '' } });
    saveSongEdits(db, two, { changes: { album: 'Red', albumArtist: '' } });

    const titles = listAlbums(db, 0, 10).map((a) => a.title);
    expect(titles).toEqual(['Red']);
    const red = listAlbums(db, 0, 10)[0];
    expect(getAlbum(db, red.id)).toMatchObject({ songCount: 2, artist: 'Band' });
  });

  it('treats an emptied artist as unknown and replaces genres', () => {
    const { db, one } = setup();
    saveSongEdits(db, one, { changes: { artist: '', genre: 'Jazz; Blues' } });
    const data = getSongEditData(db, one)!;
    expect(data.fields.artist).toBe('Unknown Artist');
    expect(data.fields.genre.split('; ').sort()).toEqual(['Blues', 'Jazz']);
  });

  it('prefers the user’s lyrics, keeps them over rescans, and can hide file lyrics', () => {
    const { db, two } = setup();
    expect(getSongEditData(db, two)!.lyrics).toBe('file words');

    saveSongEdits(db, two, { changes: {}, lyrics: 'my own words' });
    scanTracks(db, files());
    expect(getSongEditData(db, two)!.lyrics).toBe('my own words');

    saveSongEdits(db, two, { changes: {}, lyrics: '' });
    scanTracks(db, files());
    expect(getSongEditData(db, two)!.lyrics).toBe('');
    const hasLyrics = db.get<{ h: number }>(sql`SELECT has_lyrics AS h FROM songs WHERE id = ${two}`)!.h;
    expect(hasLyrics).toBe(0);
  });

  it('keeps file lyrics when other fields are edited', () => {
    const { db, two } = setup();
    saveSongEdits(db, two, { changes: { title: 'Dos' } });
    expect(getSongEditData(db, two)!.lyrics).toBe('file words');
  });

  it('sets, removes and resets a custom cover', () => {
    const { db, one } = setup();
    saveSongEdits(db, one, { changes: {}, artwork: { kind: 'set', uri: 'file:///cover.jpg' } });
    expect(getSongEditData(db, one)).toMatchObject({ artworkUri: 'file:///cover.jpg', hasCustomArtwork: true });
    expect(listSongs(db, 0, 10).find((s) => s.id === one)?.artworkKey).toBe('file:///cover.jpg');

    saveSongEdits(db, one, { changes: {}, artwork: { kind: 'remove' } });
    expect(getSongEditData(db, one)).toMatchObject({ artworkUri: null, hasCustomArtwork: true });

    saveSongEdits(db, one, { changes: {}, artwork: { kind: 'reset' } });
    expect(getSongEditData(db, one)!.hasCustomArtwork).toBe(false);
  });

  it('throws a clear error for a song that no longer exists', () => {
    const { db } = setup();
    expect(() => saveSongEdits(db, 9999, { changes: { title: 'X' } })).toThrow('no longer in your library');
  });
});

describe('song field helpers', () => {
  const base: SongEditableFields = {
    title: 'T', artist: 'A', album: 'B', albumArtist: '', composer: '', genre: '',
    year: 2000, trackNo: 1, discNo: null, bpm: null, comment: '', copyright: '',
  };

  it('validates titles and number ranges', () => {
    expect(validateSongFields(base)).toEqual({});
    expect(validateSongFields({ ...base, title: '  ' }).title).toBeDefined();
    expect(validateSongFields({ ...base, year: 999 }).year).toBeDefined();
    expect(validateSongFields({ ...base, trackNo: 0 }).trackNo).toBeDefined();
    expect(validateSongFields({ ...base, discNo: Number.NaN }).discNo).toBeDefined();
    expect(validateSongFields({ ...base, bpm: 1000 }).bpm).toBeDefined();
  });

  it('parses number inputs strictly', () => {
    expect(parseNumberInput(' 2019 ')).toBe(2019);
    expect(parseNumberInput('')).toBeNull();
    expect(parseNumberInput('12a')).toBeNaN();
    expect(parseNumberInput('-3')).toBeNaN();
  });

  it('reports only changed fields, comparing trimmed text', () => {
    expect(changedFields(base, { ...base, title: ' T ' })).toEqual({});
    expect(changedFields(base, { ...base, title: 'New ', year: null })).toEqual({ title: 'New', year: null });
  });

  it('ignores corrupt or unknown stored edits', () => {
    expect(parseOverride('not json')).toEqual({});
    expect(parseOverride('null')).toEqual({});
    expect(parseOverride('{"title":"Ok","year":"1999","bpm":1.5,"hacker":true,"trackNo":3}')).toEqual({
      title: 'Ok',
      trackNo: 3,
    });
  });

  it('applies edits over file tags, blank text meaning "none"', () => {
    const tags = {
      title: 'T', artist: 'A', album: 'B', albumArtist: 'C', composer: null, genre: null,
      year: 1, trackNo: 1, discNo: 1, bpm: null, comment: null, copyright: null,
    };
    expect(applyOverride(tags, { albumArtist: ' ', year: null, composer: ' Me ' })).toMatchObject({
      albumArtist: null,
      year: null,
      composer: 'Me',
      title: 'T',
    });
  });
});
