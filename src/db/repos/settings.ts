import { settings } from '../schema';
import type { AppDatabase } from '../types';

/** Every stored setting, JSON-decoded. Unreadable values are skipped (defaults apply). */
export function readAllSettings(db: AppDatabase): Record<string, unknown> {
  const rows = db.select().from(settings).all();
  const result: Record<string, unknown> = {};
  for (const row of rows) {
    try {
      result[row.key] = JSON.parse(row.valueJson);
    } catch {
      // Corrupt value: ignore so the default is used.
    }
  }
  return result;
}

export function writeSetting(db: AppDatabase, key: string, value: unknown): void {
  const valueJson = JSON.stringify(value);
  db.insert(settings)
    .values({ key, valueJson })
    .onConflictDoUpdate({ target: settings.key, set: { valueJson } })
    .run();
}
