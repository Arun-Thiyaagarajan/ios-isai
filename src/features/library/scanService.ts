import { androidLibrary, iosLibrary, isLibraryAvailable } from '@modules/isai-library';
import { Linking, Platform } from 'react-native';

import { db } from '@/db/client';
import { queryClient } from '@/db/queryClient';
import { queryKeys } from '@/db/queryKeys';
import {
  ScanContext,
  addRoot,
  beginScan,
  finishScan,
  getKnownFiles,
  removeRoot,
  isPathExcluded,
  listExcludedPaths,
  listRoots,
  setLastScanAt,
  touchSongs,
  updateRootBookmark,
  upsertTracks,
  type ScanScope,
} from '@/db/repos/library';

import { folderFileToTrack, iosFolderPath, mediaStoreRowToTrack, type IosRoot } from './mapTracks';
import { useScanStore } from './scanStore';

/** Shorter files (ringtones, notification sounds) are skipped. A setting later. */
const MIN_DURATION_MS = 10_000;
const MEDIASTORE_PAGE = 500;
const TAG_BATCH = 25;

/** Name shown for the app's own folder; matches "On My iPhone › Isai" in the Files app. */
const DOCUMENTS_NAME = 'Isai';

let running: Promise<void> | null = null;

/** Let the UI thread breathe between batches. */
const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function setProgress(found: number, step: string) {
  useScanStore.setState({ found, step });
}

/**
 * Scans the device for music and updates the library. Only one scan runs at a time;
 * calling this while a scan is running returns the same promise.
 */
export function scanLibrary(): Promise<void> {
  if (!isLibraryAvailable) {
    return Promise.resolve();
  }
  running ??= (async () => {
    useScanStore.setState({ status: 'scanning', found: 0, step: null, error: null });
    try {
      const status = Platform.OS === 'android' ? await scanAndroid() : await scanIos();
      const finishedAt = Date.now();
      if (status === 'done') {
        setLastScanAt(db, finishedAt);
      }
      useScanStore.setState({ status, step: null, lastScanAt: finishedAt });
    } catch (error) {
      useScanStore.setState({
        status: 'error',
        step: null,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      running = null;
      queryClient.invalidateQueries({ queryKey: queryKeys.library.all });
    }
  })();
  return running;
}

// ─── Android ────────────────────────────────────────────────────────────────

async function scanAndroid(): Promise<'done' | 'needsPermission'> {
  const lib = androidLibrary();
  const permission = await lib.getPermissionsAsync();
  if (!permission.granted) {
    return 'needsPermission';
  }

  const excluded = listExcludedPaths(db);
  const generation = beginScan(db);
  const ctx = new ScanContext(generation);
  let afterId = 0;
  let found = 0;
  for (;;) {
    const rows = await lib.queryAudio(afterId, MEDIASTORE_PAGE, MIN_DURATION_MS);
    if (rows.length === 0) {
      break;
    }
    // Songs in switched-off folders aren't stored, so they end up hidden after the scan.
    const tracks = rows.map(mediaStoreRowToTrack).filter((t) => !isPathExcluded(t.folderPath, excluded));
    upsertTracks(db, ctx, tracks);
    found += tracks.length;
    afterId = Number(rows[rows.length - 1].id);
    setProgress(found, 'Reading your music library');
    await yieldToUi();
    if (rows.length < MEDIASTORE_PAGE) {
      break;
    }
  }
  setProgress(found, 'Organizing albums and artists');
  await yieldToUi();
  finishScan(db, generation, { sources: ['mediastore'] });
  return 'done';
}

/**
 * Asks for access to audio files. If Android won't show the prompt again,
 * opens the app's system settings instead.
 */
export async function requestLibraryAccess(): Promise<boolean> {
  const lib = androidLibrary();
  const current = await lib.getPermissionsAsync();
  if (current.granted) {
    return true;
  }
  if (!current.canAskAgain && current.status === 'denied') {
    await Linking.openSettings();
    return false;
  }
  const result = await lib.requestPermissionsAsync();
  return result.granted;
}

// ─── iOS ────────────────────────────────────────────────────────────────────

async function scanIos(): Promise<'done'> {
  const lib = iosLibrary();
  const excluded = listExcludedPaths(db);
  const generation = beginScan(db);
  const ctx = new ScanContext(generation);
  const scope: ScanScope = { sources: ['documents'], rootIds: [] };
  const unavailable: string[] = [];
  let found = 0;

  const roots: { ref: string; root: IosRoot }[] = [
    { ref: 'documents', root: { kind: 'documents', name: DOCUMENTS_NAME } },
    ...listRoots(db)
      .filter((r) => r.isEnabled && r.bookmark)
      .map((r) => ({
        ref: r.bookmark!,
        root: { kind: 'bookmark' as const, rootId: r.id, name: r.displayName },
      })),
  ];

  for (const { ref, root } of roots) {
    const source = root.kind === 'documents' ? 'documents' : 'bookmark';
    const rootId = root.kind === 'bookmark' ? root.rootId : null;
    if (rootId !== null) {
      // Included even if the folder can't be opened, so its songs show as unavailable.
      scope.rootIds!.push(rootId);
    }

    setProgress(found, `Looking in “${root.name}”`);
    let listing;
    try {
      listing = await lib.listAudioFiles(ref);
    } catch {
      unavailable.push(root.name);
      continue;
    }
    if (listing.refreshedBookmark && rootId !== null) {
      updateRootBookmark(db, rootId, listing.refreshedBookmark);
    }

    const known = getKnownFiles(db, source, rootId);
    const idFor = (path: string) => (rootId === null ? path : `${rootId}/${path}`);
    const unchanged: string[] = [];
    const included = listing.files.filter(
      (file) => !isPathExcluded(iosFolderPath(root, file.path), excluded),
    );
    const changed = included.filter((file) => {
      const previous = known.get(idFor(file.path));
      const same =
        previous !== undefined &&
        previous.dateModified === file.dateModified &&
        previous.fileSize === file.fileSize;
      if (same) {
        unchanged.push(idFor(file.path));
      }
      return !same;
    });

    touchSongs(db, generation, source, unchanged);
    found += unchanged.length;

    for (let i = 0; i < changed.length; i += TAG_BATCH) {
      const batch = changed.slice(i, i + TAG_BATCH);
      const tags = await lib.readTags(
        ref,
        batch.map((f) => f.path),
      );
      const tagsByPath = new Map(tags.map((t) => [t.path, t]));
      const now = Date.now();
      upsertTracks(
        db,
        ctx,
        batch.map((file) => folderFileToTrack(root, file, tagsByPath.get(file.path), now)),
      );
      found += batch.length;
      setProgress(found, `Reading songs in “${root.name}”`);
      await yieldToUi();
    }
  }

  setProgress(found, 'Organizing albums and artists');
  await yieldToUi();
  finishScan(db, generation, scope);
  useScanStore.setState({ unavailableFolders: unavailable });
  return 'done';
}

/** Shows the folder picker, remembers the chosen folder and scans it. Returns false if cancelled. */
export async function addMusicFolder(): Promise<boolean> {
  const picked = await iosLibrary().pickFolder();
  if (!picked) {
    return false;
  }
  addRoot(db, { platform: 'ios', displayName: picked.name, bookmark: picked.bookmark });
  queryClient.invalidateQueries({ queryKey: queryKeys.library.all });
  await scanLibrary();
  return true;
}

/** Forgets a picked folder; its songs disappear from the library. */
export async function removeMusicFolder(rootId: number): Promise<void> {
  removeRoot(db, rootId);
  await scanLibrary();
}
