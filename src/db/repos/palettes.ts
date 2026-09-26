import type { RawPalette } from '@modules/isai-library';
import { eq } from 'drizzle-orm';

import { artworkPalettes } from '../schema';
import type { AppDatabase } from '../types';

/** Colors saved for an artwork image, or undefined if it was never analysed. */
export function getArtworkPalette(db: AppDatabase, uri: string): RawPalette | undefined {
  const row = db.select().from(artworkPalettes).where(eq(artworkPalettes.uri, uri)).get();
  if (!row) {
    return undefined;
  }
  try {
    const value: unknown = JSON.parse(row.paletteJson);
    return value && typeof value === 'object' ? (value as RawPalette) : undefined;
  } catch {
    return undefined;
  }
}

export function saveArtworkPalette(db: AppDatabase, uri: string, palette: RawPalette): void {
  const paletteJson = JSON.stringify(palette);
  db.insert(artworkPalettes)
    .values({ uri, paletteJson })
    .onConflictDoUpdate({ target: artworkPalettes.uri, set: { paletteJson, updatedAt: Date.now() } })
    .run();
}
