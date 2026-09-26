/** @jest-environment node */
import { eq, sql } from 'drizzle-orm';

import { addSongsToPlaylist, createPlaylist, renamePlaylist } from '../repos/playlists';
import {
  addRecentSearch,
  buildMatchQuery,
  clearRecentSearches,
  ensureSearchIndex,
  listRecentSearches,
  reindexSongs,
  removeRecentSearch,
  searchLibrary,
} from '../repos/search';
import { lyricsCache, songs } from '../schema';
import { createTestDb, makeTrack as t, scanTracks } from '../testing/testDb';

function library() {
  const db = createTestDb();
  scanTracks(db, [
    t({ sourceId: '1', title: 'Jai Ho', artist: 'A.R. Rahman', album: 'Slumdog Millionaire', genre: 'Soundtrack' }),
    t({ sourceId: '2', title: 'Love Story', artist: 'Taylor Swift', album: 'Fearless', genre: 'Pop' }),
    t({ sourceId: '3', title: 'My Love', artist: 'Westlife', album: 'Coast to Coast' }),
    t({ sourceId: '4', title: 'Endless Love', artist: 'Diana Ross', album: 'Endless Love' }),
    t({ sourceId: '5', title: 'Beyoncé Song', artist: 'Beyoncé', album: 'Lemonade', fileName: 'track05_final_mix.flac' }),
    t({ sourceId: '6', title: 'Instrumental', artist: 'Various', album: 'Hits', albumArtist: 'Studio Orchestra' }),
  ]);
  const id = (title: string) => db.select({ id: songs.id }).from(songs).where(eq(songs.title, title)).get()!.id;
  return { db, id };
}

const titles = (r: ReturnType<typeof searchLibrary>) => r.songs.map((s) => s.title);

describe('buildMatchQuery', () => {
  it('quotes words and adds prefix matching', () => {
    expect(buildMatchQuery('  Love  STORY ')).toBe('"love"* "story"*');
  });

  it('removes punctuation and accents, and returns null for empty input', () => {
    expect(buildMatchQuery('A.R. Rahman!')).toBe('"a"* "r"* "rahman"*');
    expect(buildMatchQuery('Beyoncé')).toBe('"beyonce"*');
    expect(buildMatchQuery('  "(*)" ')).toBeNull();
  });
});

describe('searchLibrary', () => {
  it('finds "A.R. Rahman" when typing "ar rahman" or "a.r. rahman"', () => {
    const { db } = library();
    expect(titles(searchLibrary(db, 'ar rahman'))).toEqual(['Jai Ho']);
    expect(titles(searchLibrary(db, 'a.r. rahman'))).toEqual(['Jai Ho']);
    expect(searchLibrary(db, 'ar rahman').artists.map((a) => a.name)).toEqual(['A.R. Rahman']);
  });

  it('finds every song containing a word, with title-start matches first', () => {
    const { db } = library();
    const result = titles(searchLibrary(db, 'love'));
    expect(result.sort()).toEqual(['Endless Love', 'Love Story', 'My Love']);
    expect(titles(searchLibrary(db, 'love'))[0]).toBe('Love Story');
  });

  it('matches partial words, any case, any order and across fields', () => {
    const { db } = library();
    expect(titles(searchLibrary(db, 'TAYL'))).toEqual(['Love Story']);
    expect(titles(searchLibrary(db, 'swift love'))).toEqual(['Love Story']);
    expect(titles(searchLibrary(db, 'slumdog'))).toEqual(['Jai Ho']);
  });

  it('ignores accents and searches genre, album artist and file name', () => {
    const { db } = library();
    expect(titles(searchLibrary(db, 'beyonce'))).toEqual(['Beyoncé Song']);
    expect(titles(searchLibrary(db, 'soundtrack'))).toEqual(['Jai Ho']);
    expect(titles(searchLibrary(db, 'orchestra'))).toEqual(['Instrumental']);
    expect(titles(searchLibrary(db, 'final_mix'))).toEqual(['Beyoncé Song']);
  });

  it('returns albums, genres and playlists, without duplicates', () => {
    const { db, id } = library();
    const playlist = createPlaylist(db, 'Love Mix');
    addSongsToPlaylist(db, playlist.id, [id('Love Story')]);

    const result = searchLibrary(db, 'love');
    expect(result.albums.map((a) => a.title)).toEqual(['Endless Love']);
    expect(result.playlists.map((p) => p.name)).toEqual(['Love Mix']);
    expect(new Set(result.songs.map((s) => s.id)).size).toBe(result.songs.length);
    expect(searchLibrary(db, 'pop').genres.map((g) => g.name)).toEqual(['Pop']);
  });

  it('finds renamed playlists immediately', () => {
    const { db } = library();
    const playlist = createPlaylist(db, 'Old Name');
    renamePlaylist(db, playlist.id, 'Road Trip');
    expect(searchLibrary(db, 'road').playlists.map((p) => p.name)).toEqual(['Road Trip']);
  });

  it('falls back to substring search inside words', () => {
    const { db } = library();
    expect(titles(searchLibrary(db, 'onad'))).toEqual(['Beyoncé Song']); // "Lemonade"
  });

  it('never throws on odd input and returns nothing for no match', () => {
    const { db } = library();
    for (const input of ['', '   ', '"', '*', 'AND', 'NEAR(', '(((', '%_\\']) {
      expect(() => searchLibrary(db, input)).not.toThrow();
    }
    const none = searchLibrary(db, 'zzzzqqq');
    expect(none.songs).toEqual([]);
    expect(none.artists).toEqual([]);
  });

  it('includes lyrics and reflects edits after re-indexing', () => {
    const { db, id } = library();
    const songId = id('My Love');
    db.insert(lyricsCache).values({ songId, source: 'user', isSynced: false, content: 'an empty street' }).run();
    db.update(songs).set({ title: 'Renamed Ballad' }).where(eq(songs.id, songId)).run();
    reindexSongs(db, [songId]);

    expect(titles(searchLibrary(db, 'empty street'))).toEqual(['Renamed Ballad']);
    expect(titles(searchLibrary(db, 'ballad'))).toEqual(['Renamed Ballad']);
    expect(titles(searchLibrary(db, 'my love'))).toEqual([]);
  });

  it('builds the index on startup when it is empty', () => {
    const { db } = library();
    const indexed = () => db.get<{ n: number }>(sql`SELECT count(*) AS n FROM search_fts`)!.n;
    db.run(sql`DELETE FROM search_fts`);
    expect(indexed()).toBe(0);
    // Even with an empty index, the substring fallback still finds songs.
    expect(titles(searchLibrary(db, 'jai'))).toEqual(['Jai Ho']);
    ensureSearchIndex(db);
    expect(indexed()).toBeGreaterThan(0);
    expect(searchLibrary(db, 'rahman').artists.map((x) => x.name)).toEqual(['A.R. Rahman']);
  });
});

describe('recent searches', () => {
  it('keeps the newest first, trims text and removes duplicates', () => {
    const { db } = library();
    addRecentSearch(db, ' love ', 1);
    addRecentSearch(db, 'rahman', 2);
    addRecentSearch(db, 'love', 3);
    addRecentSearch(db, '   ', 4);
    expect(listRecentSearches(db)).toEqual(['love', 'rahman']);
  });

  it('removes one or all, and keeps at most 20', () => {
    const { db } = library();
    for (let i = 0; i < 25; i++) addRecentSearch(db, `q${i}`, i);
    expect(listRecentSearches(db, 50)).toHaveLength(20);
    removeRecentSearch(db, 'q24');
    expect(listRecentSearches(db, 1)).toEqual(['q23']);
    clearRecentSearches(db);
    expect(listRecentSearches(db)).toEqual([]);
  });
});
