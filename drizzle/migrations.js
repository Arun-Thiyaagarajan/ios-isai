// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_init.sql';
import m0001 from './0001_search_fts.sql';
import m0002 from './0002_root_bookmark_text.sql';
import m0003 from './0003_album_display_artist.sql';
import m0004 from './0004_song_details_and_edits.sql';
import m0005 from './0005_search_index_v2.sql';
import m0006 from './0006_artwork_palettes.sql';
import m0007 from './0007_hide_duplicates.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003,
m0004,
m0005,
m0006,
m0007
    }
  }
  