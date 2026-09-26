import { androidLibrary, iosLibrary, isLibraryAvailable, type ArtworkResult } from '@modules/isai-library';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { db } from '@/db/client';
import { clearAlbumArtwork, getArtworkSourceSong, setAlbumArtwork } from '@/db/repos/library';

/** One size serves grids, rows and album headers; expo-image downsamples for small views. */
const THUMBNAIL_SIZE = 600;
/** Artwork extraction reads files, so only a couple run at once to keep scrolling smooth. */
const MAX_CONCURRENT = 2;

/** Resolved results this session: file URI, or null for "no artwork". */
const resolved = new Map<number, string | null>();
const inFlight = new Map<number, Promise<string | null>>();
const waiting: (() => void)[] = [];
let active = 0;

function schedule<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      active += 1;
      task()
        .then(resolve, reject)
        .finally(() => {
          active -= 1;
          waiting.shift()?.();
        });
    };
    if (active < MAX_CONCURRENT) {
      run();
    } else {
      waiting.push(run);
    }
  });
}

async function extract(albumId: number): Promise<ArtworkResult | null | 'failed'> {
  const song = getArtworkSourceSong(db, albumId);
  if (!song) {
    return null;
  }
  const key = `album-${albumId}`;
  try {
    if (Platform.OS === 'android') {
      return await androidLibrary().getArtwork(song.uri, key, THUMBNAIL_SIZE);
    }
    const root = song.source === 'documents' ? 'documents' : song.bookmark;
    if (!root) {
      return 'failed';
    }
    // Bookmark songs are stored as "<rootId>/<path inside the folder>".
    const path = song.source === 'bookmark' ? song.sourceId.slice(song.sourceId.indexOf('/') + 1) : song.sourceId;
    return await iosLibrary().getArtwork(root, path, key, THUMBNAIL_SIZE);
  } catch {
    // Folder unavailable or file unreadable right now: don't record "no artwork", try again later.
    return 'failed';
  }
}

/** Makes sure an album has a thumbnail, generating it once. Resolves to its file URI or null. */
export function ensureAlbumArtwork(albumId: number): Promise<string | null> {
  if (!isLibraryAvailable) {
    return Promise.resolve(null);
  }
  if (resolved.has(albumId)) {
    return Promise.resolve(resolved.get(albumId)!);
  }
  let pending = inFlight.get(albumId);
  if (!pending) {
    pending = schedule(async () => {
      const result = await extract(albumId);
      if (result === 'failed') {
        return null;
      }
      setAlbumArtwork(db, albumId, result?.uri ?? null, result?.colors ?? null);
      resolved.set(albumId, result?.uri ?? null);
      return result?.uri ?? null;
    }).finally(() => inFlight.delete(albumId));
    inFlight.set(albumId, pending);
  }
  return pending;
}

/** The thumbnail file was deleted (the OS may clear caches): forget it so it's regenerated. */
export function artworkFileMissing(albumId: number): void {
  resolved.delete(albumId);
  clearAlbumArtwork(db, albumId);
}

/**
 * Artwork URI for an album, generating the thumbnail on first use.
 * `artworkKey` comes from the database row: null = not generated yet, "" = none.
 */
export function useAlbumArtwork(albumId: number | null, artworkKey: string | null) {
  // Keyed by album so a recycled list row never shows the previous album's result.
  const [state, setState] = useState<{ albumId: number; uri: string | null } | null>(null);

  const known =
    albumId === null
      ? null
      : resolved.has(albumId)
        ? resolved.get(albumId)!
        : artworkKey === null
          ? undefined
          : artworkKey || null;

  useEffect(() => {
    if (albumId === null || known !== undefined) {
      return;
    }
    let cancelled = false;
    ensureAlbumArtwork(albumId).then((uri) => {
      if (!cancelled) {
        setState({ albumId, uri });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [albumId, known]);

  const uri = known !== undefined ? known : state?.albumId === albumId ? state.uri : null;

  const onError = () => {
    if (albumId !== null) {
      artworkFileMissing(albumId);
      setState(null);
    }
  };

  return { uri, onError };
}
