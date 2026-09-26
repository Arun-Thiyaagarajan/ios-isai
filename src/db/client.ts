import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from './schema';

export const DATABASE_NAME = 'isai.db';

// Opened once for the app's lifetime. The change listener lets live queries react to writes.
const sqlite = openDatabaseSync(DATABASE_NAME, { enableChangeListener: true });

sqlite.execSync(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA foreign_keys = ON;
  PRAGMA temp_store = MEMORY;
  PRAGMA cache_size = -16000;
`);

export const db = drizzle(sqlite, { schema });
