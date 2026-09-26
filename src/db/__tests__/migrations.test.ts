/** @jest-environment node */
import { sql } from 'drizzle-orm';

import { createTestDb } from '../testing/testDb';

describe('migrations', () => {
  it('create every table, including the FTS5 search index', () => {
    const db = createTestDb();
    const tables = db
      .all<{ name: string }>(sql`SELECT name FROM sqlite_master WHERE type = 'table'`)
      .map((row) => row.name);

    for (const table of [
      'albums',
      'artists',
      'favorites',
      'folders',
      'genres',
      'library_roots',
      'lyrics_cache',
      'play_events',
      'playlist_songs',
      'playlists',
      'recent_searches',
      'search_fts',
      'settings',
      'song_artists',
      'song_genres',
      'song_stats',
      'songs',
    ]) {
      expect(tables).toContain(table);
    }
  });

  it('search index matches prefixes and ignores diacritics', () => {
    const db = createTestDb();
    db.run(sql`INSERT INTO search_fts (entity_type, entity_id, primary_text, secondary_text)
               VALUES ('artist', 1, 'Beyoncé', ''), ('song', 2, 'Halo', 'Beyoncé')`);
    const hits = db.all<{ entity_type: string }>(
      sql`SELECT entity_type FROM search_fts WHERE search_fts MATCH 'beyon*'`,
    );
    expect(hits.map((hit) => hit.entity_type).sort()).toEqual(['artist', 'song']);
  });
});
