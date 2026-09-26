import { androidLibrary, iosLibrary, isLibraryAvailable, type RawPalette } from '@modules/isai-library';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { db } from '@/db/client';
import { getArtworkPalette, saveArtworkPalette } from '@/db/repos/palettes';
import { useAlbumArtwork } from '@/features/library/artwork';
import type { QueueItem } from '@/features/player/queue';

import { FALLBACK_SWATCHES, normalizePalette, type Swatches } from './palette';

export type PlayerPalette = {
  swatches: Swatches;
  /** True when the song has no artwork (or its colors couldn't be read): brand ink colors. */
  isFallback: boolean;
  /** The artwork these colors came from; changes exactly when the colors change. */
  artworkUri: string | null;
};

const FALLBACK: PlayerPalette = { swatches: FALLBACK_SWATCHES, isFallback: true, artworkUri: null };

/** Colors by artwork URI for this session (null = image has no usable colors). */
const memory = new Map<string, Swatches | null>();
const inFlight = new Map<string, Promise<Swatches | null>>();

/** Memory first, then the database; undefined when this image was never analysed. */
function cached(uri: string): Swatches | null | undefined {
  if (memory.has(uri)) {
    return memory.get(uri);
  }
  const raw = getArtworkPalette(db, uri);
  if (raw === undefined) {
    return undefined;
  }
  const swatches = normalizePalette(raw);
  memory.set(uri, swatches);
  return swatches;
}

async function readImageColors(uri: string): Promise<RawPalette | null> {
  if (!isLibraryAvailable) {
    return null;
  }
  const lib = Platform.OS === 'android' ? androidLibrary() : iosLibrary();
  if (typeof lib.getImageColors !== 'function') {
    return null; // Built before the player themes: no native color reader yet.
  }
  try {
    return await lib.getImageColors(uri);
  } catch {
    return null;
  }
}

/** Analyses an image once (shared between callers), saving the result for next time. */
function analyse(uri: string): Promise<Swatches | null> {
  let pending = inFlight.get(uri);
  if (!pending) {
    pending = readImageColors(uri)
      .then((raw) => {
        if (raw) {
          saveArtworkPalette(db, uri, raw);
        }
        const swatches = normalizePalette(raw);
        memory.set(uri, swatches);
        return swatches;
      })
      .finally(() => inFlight.delete(uri));
    inFlight.set(uri, pending);
  }
  return pending;
}

/**
 * Colors from the current song's artwork, for player themes.
 * - Instant for artwork seen before (memory, then the database).
 * - New artwork is analysed natively in the background; meanwhile the previous song's colors stay
 *   up, so skipping quickly never flashes through other colors.
 * - No artwork, or unreadable colors: the brand ink palette.
 */
export function usePlayerPalette(item: QueueItem | null): PlayerPalette {
  const { uri } = useAlbumArtwork(item?.albumId ?? null, item?.artworkUri ?? null);
  const [loaded, setLoaded] = useState<{ uri: string; swatches: Swatches | null } | null>(null);
  const [shown, setShown] = useState<PlayerPalette>(FALLBACK);

  const fromCache = uri ? cached(uri) : undefined;

  useEffect(() => {
    if (!uri || fromCache !== undefined) {
      return;
    }
    let cancelled = false;
    analyse(uri).then((swatches) => {
      if (!cancelled) {
        setLoaded({ uri, swatches });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [uri, fromCache]);

  // What this song's colors are right now: undefined while they're still being worked out.
  let current: PlayerPalette | undefined;
  if (!item) {
    current = FALLBACK;
  } else if (uri) {
    const swatches = fromCache !== undefined ? fromCache : loaded?.uri === uri ? loaded.swatches : undefined;
    if (swatches !== undefined) {
      current = swatches ? { swatches, isFallback: false, artworkUri: uri } : { ...FALLBACK, artworkUri: uri };
    }
  } else if (item.artworkUri !== null) {
    // The album is known to have no artwork ("" in the database).
    current = FALLBACK;
  }
  // (item.artworkUri === null: the thumbnail is still being generated; keep the previous colors.)

  if (current && (current.artworkUri !== shown.artworkUri || current.isFallback !== shown.isFallback)) {
    setShown(current);
  }
  return current ?? shown;
}
