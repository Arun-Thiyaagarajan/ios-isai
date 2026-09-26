import { androidLibrary, iosLibrary, isLibraryAvailable } from '@modules/isai-library';
import { AppState, Linking, Platform } from 'react-native';

import { db } from '@/db/client';
import { queryClient } from '@/db/queryClient';
import { queryKeys } from '@/db/queryKeys';
import {
  ScanContext,
  addRoot,
  beginScan,
  finishScan,
  getKnownFiles,
  getLibraryStats,
  isUnchanged,
  markTagsRefreshed,
  needsTagRefresh,
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
import { saveReplayGain, songsNeedingReplayGain } from '@/db/repos/player';
import { useSettings } from '@/features/settings/settingsStore';

import { folderFileToTrack, iosFolderPath, mediaStoreRowToTrack, type IosRoot } from './mapTracks';
import { useScanStore } from './scanStore';

/** Shorter files (ringtones, notification sounds) are skipped. A setting later. */
const MIN_DURATION_MS = 10_000;
const MEDIASTORE_PAGE = 500;
const TAG_BATCH = 25;
/** Coming back to the app checks for new music at most this often. */
const FOREGROUND_CHECK_INTERVAL_MS = 30_000;

/** Name shown for the app's own folder; matches "On My iPhone › Isai" in the Files app. */
const DOCUMENTS_NAME = 'Isai';

let running: Promise<void> | null = null;

/** Let the UI thread breathe between batches. */
const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function setProgress(found: number, step: string) {
  useScanStore.setState({ found, step });
}

type ScanOutcome = { status: 'done'; changed: boolean } | { status: 'needsPermission' };

/**
 * Scans the device for music and updates the library. Only one scan runs at a time;
 * calling this while a scan is running returns the same promise.
 *
 * Unchanged files are skipped, and the library screens are only refreshed when something was
 * actually added, changed or removed, so a routine check costs little and causes no reloads.
 */
export function scanLibrary(): Promise<void> {
  if (!isLibraryAvailable) {
    return Promise.resolve();
  }
  running ??= (async () => {
    useScanStore.setState({ status: 'scanning', found: 0, step: null, error: null });
    let changed = true;
    try {
      const outcome = Platform.OS === 'android' ? await scanAndroid() : await scanIos();
      const finishedAt = Date.now();
      if (outcome.status === 'done') {
        setLastScanAt(db, finishedAt);
        changed = outcome.changed;
      }
      useScanStore.setState({ status: outcome.status, step: null, lastScanAt: finishedAt });
    } catch (error) {
      useScanStore.setState({
        status: 'error',
        step: null,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      running = null;
      // Android's media database has no ReplayGain tags; read them in the background when needed.
      readLevellingTags();
      if (changed) {
        queryClient.invalidateQueries({ queryKey: queryKeys.library.all });
      } else {
        // Nothing changed: only the "Last scanned" time is new.
        queryClient.invalidateQueries({ queryKey: queryKeys.library.stats() });
      }
    }
  })();
  return running;
}

let levelling: Promise<void> | null = null;
const LEVELLING_BATCH = 40;

/**
 * Android: reads ReplayGain tags for songs that don't have them yet, a batch at a time, while
 * volume levelling is on. (iOS reads them during the scan.) One pass at a time; safe to call often.
 */
export function readLevellingTags(): Promise<void> {
  if (Platform.OS !== 'android' || !isLibraryAvailable || useSettings.getState().replayGain === 'off') {
    return Promise.resolve();
  }
  const lib = androidLibrary();
  if (typeof lib.readReplayGain !== 'function') {
    return Promise.resolve(); // built before levelling existed
  }
  levelling ??= (async () => {
    try {
      for (;;) {
        const batch = songsNeedingReplayGain(db, LEVELLING_BATCH);
        if (batch.length === 0) break;
        const tags = await lib.readReplayGain!(batch.map((song) => song.uri));
        const byUri = new Map(tags.map((t) => [t.uri, t]));
        for (const song of batch) {
          saveReplayGain(db, song.id, byUri.get(song.uri) ?? {});
        }
        await yieldToUi();
      }
    } catch {
      // Try again after the next scan.
    } finally {
      levelling = null;
    }
  })();
  return levelling;
}

let watching = false;

/**
 * The only place scans start automatically. Call once at startup:
 * - first launch (never scanned): scans right away;
 * - later launches: the library shows from the database immediately, and a background check for
 *   new music runs if "Check for New Music" is on;
 * - coming back to the app: the same check, at most every 30 seconds.
 * Everything else (pull to refresh, Rescan Library, folder changes) calls `scanLibrary` directly.
 */
export function startLibraryWatcher(): void {
  if (watching || !isLibraryAvailable) {
    return;
  }
  watching = true;

  const neverScanned = getLibraryStats(db).lastScanAt === null;
  if (neverScanned || useSettings.getState().autoScan) {
    scanLibrary();
  }

  AppState.addEventListener('change', (state) => {
    if (state !== 'active' || !useSettings.getState().autoScan) {
      return;
    }
    const last = useScanStore.getState().lastScanAt ?? getLibraryStats(db).lastScanAt ?? 0;
    if (Date.now() - last >= FOREGROUND_CHECK_INTERVAL_MS) {
      scanLibrary();
    }
  });
}

// ─── Android ────────────────────────────────────────────────────────────────

async function scanAndroid(): Promise<ScanOutcome> {
  const lib = androidLibrary();
  const permission = await lib.getPermissionsAsync();
  if (!permission.granted) {
    return { status: 'needsPermission' };
  }

  const excluded = listExcludedPaths(db);
  const generation = beginScan(db);
  const ctx = new ScanContext(generation);
  // After the tag clean-up rules change, every file is written again once so old names get fixed.
  const refreshAll = needsTagRefresh(db);
  const known = refreshAll ? new Map() : getKnownFiles(db, 'mediastore', null);
  let afterId = 0;
  let found = 0;
  let written = 0;
  for (;;) {
    const rows = await lib.queryAudio(afterId, MEDIASTORE_PAGE, MIN_DURATION_MS);
    if (rows.length === 0) {
      break;
    }
    // Songs in switched-off folders aren't stored, so they end up hidden after the scan.
    const tracks = rows.map(mediaStoreRowToTrack).filter((t) => !isPathExcluded(t.folderPath, excluded));
    const unchanged: string[] = [];
    const changedTracks = tracks.filter((track) => {
      const same = isUnchanged(known.get(track.sourceId), track);
      if (same) {
        unchanged.push(track.sourceId);
      }
      return !same;
    });
    touchSongs(db, generation, 'mediastore', unchanged);
    upsertTracks(db, ctx, changedTracks);
    written += changedTracks.length;
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
  const changed = finishScan(db, generation, { sources: ['mediastore'] }, Date.now(), written);
  if (refreshAll) {
    markTagsRefreshed(db);
  }
  return { status: 'done', changed };
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

async function scanIos(): Promise<ScanOutcome> {
  const lib = iosLibrary();
  const excluded = listExcludedPaths(db);
  const generation = beginScan(db);
  const ctx = new ScanContext(generation);
  const scope: ScanScope = { sources: ['documents'], rootIds: [] };
  const unavailable: string[] = [];
  let found = 0;
  let written = 0;
  // After the tag clean-up rules change, every file is read again once so old names get fixed.
  const refreshAll = needsTagRefresh(db);

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

    const known = refreshAll ? new Map() : getKnownFiles(db, source, rootId);
    const idFor = (path: string) => (rootId === null ? path : `${rootId}/${path}`);
    const unchanged: string[] = [];
    const included = listing.files.filter(
      (file) => !isPathExcluded(iosFolderPath(root, file.path), excluded),
    );
    const changedFiles = included.filter((file) => {
      const same = isUnchanged(known.get(idFor(file.path)), file);
      if (same) {
        unchanged.push(idFor(file.path));
      }
      return !same;
    });

    touchSongs(db, generation, source, unchanged);
    found += unchanged.length;

    for (let i = 0; i < changedFiles.length; i += TAG_BATCH) {
      const batch = changedFiles.slice(i, i + TAG_BATCH);
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
      written += batch.length;
      found += batch.length;
      setProgress(found, `Reading songs in “${root.name}”`);
      await yieldToUi();
    }
  }

  setProgress(found, 'Organizing albums and artists');
  await yieldToUi();
  const changed = finishScan(db, generation, scope, Date.now(), written);
  // Marked even if a folder was unreachable: re-reading everything on every launch until it's
  // reconnected would make each launch slow. Its songs get the new rules when they next change.
  if (refreshAll) {
    markTagsRefreshed(db);
  }
  useScanStore.setState({ unavailableFolders: unavailable });
  return { status: 'done', changed };
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
