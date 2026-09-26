import {
  audio,
  isAudioAvailable,
  type NativeQueueItem,
  type PlaybackStateEvent,
  type TransitionEvent,
} from '@modules/isai-audio';
import { AppState, Platform } from 'react-native';

import { db } from '@/db/client';
import { queryClient } from '@/db/queryClient';
import { queryKeys } from '@/db/queryKeys';
import { markRecentlyPlayed, recordPlayEvents } from '@/db/repos/history';
import {
  getPlayableSongs,
  loadSavedQueue,
  saveQueue,
  type PlayableSong,
} from '@/db/repos/player';

import { useSettings } from '@/features/settings/settingsStore';
import { showToast } from '@/features/shell/toast';

import { usePlayerStore, type PlayContext } from './playerStore';
import {
  addToQueue as addToQueueOp,
  clearUpNext as clearUpNextOp,
  move as moveOp,
  newKey,
  playNext as playNextOp,
  removeAt as removeAtOp,
  setShuffle as setShuffleOp,
  startQueue,
  type NativeOp,
  type QueueChange,
  type QueueItem,
  type RepeatMode,
} from './queue';

/** Big lists (e.g. all songs) are queued in a window so the queue stays fast. */
export const MAX_QUEUE = 2000;
const SAVE_DELAY_MS = 1000;

// ─── Building queue items ───────────────────────────────────────────────────

function toQueueItem(song: PlayableSong): QueueItem {
  const base = {
    key: newKey(),
    songId: song.id,
    title: song.title,
    artist: song.artist,
    album: song.album,
    albumId: song.albumId,
    artworkUri: song.artworkKey || null,
    durationMs: song.durationMs,
  };
  if (Platform.OS === 'android' || song.source === 'mediastore') {
    return { ...base, uri: song.uri };
  }
  // iOS files are addressed relative to their folder, whose location can change between launches.
  const path = song.source === 'bookmark' ? song.sourceId.slice(song.sourceId.indexOf('/') + 1) : song.sourceId;
  return { ...base, root: song.source === 'documents' ? 'documents' : (song.bookmark ?? undefined), path };
}

function toNative(item: QueueItem): NativeQueueItem {
  return {
    key: item.key,
    uri: item.uri,
    root: item.root,
    path: item.path,
    title: item.title,
    artist: item.artist,
    album: item.album,
    artworkUri: item.artworkUri,
    durationMs: item.durationMs,
  };
}

function itemsFor(songIds: number[]): QueueItem[] {
  return getPlayableSongs(db, songIds)
    .filter((song) => song.isPlayable)
    .map(toQueueItem);
}

// ─── Native command queue ───────────────────────────────────────────────────

/**
 * Native calls run strictly one after another, in the order they were requested, so fast taps
 * can never apply operations out of order.
 */
let chain: Promise<unknown> = Promise.resolve();
function native<T>(task: () => Promise<T>): Promise<T> {
  const next = chain.then(task, task);
  chain = next.catch(() => undefined);
  return next;
}

function runOps(ops: NativeOp[]) {
  for (const op of ops) {
    if (op.type === 'insert') {
      native(() => audio().insert(op.at, op.items.map(toNative)));
    } else if (op.type === 'remove') {
      native(() => audio().remove(op.from, op.to));
    } else {
      native(() => audio().move(op.from, op.to));
    }
  }
}

function applyChange(change: QueueChange) {
  if (change.ops.length === 0 && change.state === usePlayerStore.getState().queue) {
    return;
  }
  usePlayerStore.setState({ queue: change.state });
  runOps(change.ops);
  scheduleSave();
}

// ─── Public actions ─────────────────────────────────────────────────────────

/**
 * Replaces the queue with these songs and starts playing `startIndex`.
 * With `shuffle`, the chosen song plays first and the rest are shuffled.
 * `context` names where the songs came from (shown as "Playing from …" on Now Playing).
 */
export function playSongs(
  songIds: number[],
  startIndex = 0,
  options: { shuffle?: boolean; context?: PlayContext } = {},
): boolean {
  if (!isAudioAvailable || songIds.length === 0) {
    return false;
  }
  // Keep a window around the chosen song for very large lists.
  let ids = songIds;
  let start = Math.max(0, Math.min(startIndex, songIds.length - 1));
  if (songIds.length > MAX_QUEUE) {
    const from = Math.max(0, Math.min(start, songIds.length - MAX_QUEUE));
    ids = songIds.slice(from, from + MAX_QUEUE);
    start -= from;
  }
  const startSongId = ids[start];
  const items = itemsFor(ids);
  if (items.length === 0) {
    return false;
  }
  // Unplayable songs were filtered out, so find where the chosen song ended up.
  const startAt = Math.max(0, items.findIndex((item) => item.songId === startSongId));
  const queue = startQueue(items, options.shuffle ? Math.floor(Math.random() * items.length) : startAt, !!options.shuffle);

  usePlayerStore.setState({ queue, context: options.context ?? null, lastError: null });
  native(() => audio().setQueue(queue.items.map(toNative), queue.index, 0, true));
  scheduleSave();
  return true;
}

export function playNext(songIds: number[]) {
  const items = itemsFor(songIds);
  const wasEmpty = usePlayerStore.getState().queue.items.length === 0;
  applyChange(playNextOp(usePlayerStore.getState().queue, items));
  if (wasEmpty && items.length > 0) {
    native(() => audio().play());
  }
}

export function addToQueue(songIds: number[]) {
  const items = itemsFor(songIds);
  const wasEmpty = usePlayerStore.getState().queue.items.length === 0;
  applyChange(addToQueueOp(usePlayerStore.getState().queue, items));
  if (wasEmpty && items.length > 0) {
    native(() => audio().play());
  }
}

export function removeFromQueue(position: number) {
  applyChange(removeAtOp(usePlayerStore.getState().queue, position));
}

export function moveInQueue(from: number, to: number) {
  applyChange(moveOp(usePlayerStore.getState().queue, from, to));
}

export function clearUpNext() {
  applyChange(clearUpNextOp(usePlayerStore.getState().queue));
}

export function toggleShuffle() {
  const { queue } = usePlayerStore.getState();
  applyChange(setShuffleOp(queue, !queue.shuffle));
}

const nextRepeat: Record<RepeatMode, RepeatMode> = { off: 'all', all: 'one', one: 'off' };

/** Repeat cycles off → all → one → off. */
export function cycleRepeat() {
  const repeat = nextRepeat[usePlayerStore.getState().repeat];
  usePlayerStore.setState({ repeat });
  native(() => audio().setRepeatMode(repeat));
  scheduleSave();
}

export function togglePlayPause() {
  if (!isAudioAvailable) return;
  const { status, queue } = usePlayerStore.getState();
  if (queue.items.length === 0) return;
  // Update right away so the button responds instantly; the engine confirms moments later.
  usePlayerStore.setState({ status: { ...status, isPlaying: !status.isPlaying } });
  native(() => (status.isPlaying ? audio().pause() : audio().play()));
}

export function skipToNext() {
  if (isAudioAvailable) native(() => audio().skipToNext());
}

export function skipToPrevious() {
  if (isAudioAvailable) native(() => audio().skipToPrevious());
}

export function skipTo(position: number) {
  if (isAudioAvailable) native(() => audio().skipTo(position));
}

export function seekTo(positionMs: number) {
  if (!isAudioAvailable) return;
  const { status } = usePlayerStore.getState();
  usePlayerStore.setState({ status: { ...status, positionMs, timestamp: Date.now() } });
  native(() => audio().seekTo(positionMs));
}

// ─── Engine events ──────────────────────────────────────────────────────────

/** A song counts as "recently played" once it has played this long. */
const RECENT_AFTER_MS = 1000;
/** Queue entry already marked as recently played during its current listen. */
let markedKey: string | null = null;

function markIfListening(event: PlaybackStateEvent) {
  if (!event.key || !event.isPlaying || event.positionMs < RECENT_AFTER_MS || event.key === markedKey) {
    return;
  }
  const item = usePlayerStore.getState().queue.items.find((i) => i.key === event.key);
  if (!item) return;
  markedKey = event.key;
  try {
    markRecentlyPlayed(db, item.songId, Date.now());
    queryClient.invalidateQueries({ queryKey: queryKeys.history.all });
  } catch {
    // Best-effort: the song may have just been removed from the library.
  }
}

function onPlaybackState(event: PlaybackStateEvent) {
  const { queue } = usePlayerStore.getState();
  let index = queue.index;
  if (event.key && queue.items[queue.index]?.key !== event.key) {
    const found = queue.items.findIndex((item) => item.key === event.key);
    if (found >= 0) {
      index = found;
    }
  }
  usePlayerStore.setState({
    queue: index === queue.index ? queue : { ...queue, index },
    status: {
      isPlaying: event.isPlaying,
      isBuffering: event.isBuffering,
      ended: event.ended,
      positionMs: event.positionMs,
      durationMs: event.durationMs,
      timestamp: event.timestamp,
    },
  });
  markIfListening(event);
  if (event.queueLength !== queue.items.length) {
    // Commands may still be in flight; compare again once they're done.
    native(() => resync());
  }
}

/** If the engine's list ever differs from ours, adopt the engine's order (it's what is playing). */
async function resync() {
  const state = await audio().getState();
  if (!state) return;
  const { queue } = usePlayerStore.getState();
  const ours = queue.items.map((item) => item.key);
  if (ours.length === state.keys.length && ours.every((key, i) => key === state.keys[i])) {
    return;
  }
  const byKey = new Map(queue.items.map((item) => [item.key, item]));
  const items = state.keys.map((key) => byKey.get(key)).filter((item): item is QueueItem => item !== undefined);
  if (items.length !== state.keys.length) {
    // Unknown items: rebuild the engine from our list rather than guessing.
    await audio().setQueue(queue.items.map(toNative), queue.index, state.positionMs, state.isPlaying);
    return;
  }
  usePlayerStore.setState({
    queue: {
      ...queue,
      items,
      index: Math.max(0, Math.min(state.index, items.length - 1)),
      originalKeys: queue.originalKeys?.filter((key) => byKey.has(key)) ?? null,
    },
  });
}

function onTransition(event: TransitionEvent) {
  // The next listen of this entry (e.g. repeat one) counts as a new "recently played".
  if (markedKey === event.fromKey) {
    markedKey = null;
  }
  const item = usePlayerStore.getState().queue.items.find((i) => i.key === event.fromKey);
  if (!item) return;
  try {
    recordPlayEvents(db, [
      {
        songId: item.songId,
        startedAt: Date.now() - event.playedMs,
        msPlayed: Math.round(event.playedMs),
        durationMs: Math.round(event.durationMs || item.durationMs),
        completed: event.completed,
      },
    ]);
    queryClient.invalidateQueries({ queryKey: queryKeys.history.all });
  } catch {
    // The song may have been removed from the library meanwhile; history is best-effort.
  }
  scheduleSave();
}

// ─── Saving and restoring ───────────────────────────────────────────────────

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, SAVE_DELAY_MS);
}

function saveNow() {
  saveTimer = null;
  const { queue, status, repeat } = usePlayerStore.getState();
  const position = status.isPlaying ? status.positionMs + (Date.now() - status.timestamp) : status.positionMs;
  const indexOfKey = new Map(queue.items.map((item, i) => [item.key, i]));
  saveQueue(db, {
    songIds: queue.items.map((item) => item.songId),
    index: queue.index,
    positionMs: Math.max(0, Math.round(position)),
    shuffle: queue.shuffle,
    originalOrder: queue.originalKeys?.map((key) => indexOfKey.get(key) ?? -1).filter((i) => i >= 0) ?? null,
    repeat,
  });
}

function restore() {
  const saved = loadSavedQueue(db);
  if (!saved || saved.songIds.length === 0) return;
  const songs = getPlayableSongs(db, saved.songIds);
  // Rebuild items position by position so duplicates and removed songs line up.
  const bySong = new Map<number, PlayableSong>(songs.map((s) => [s.id, s]));
  const kept: { item: QueueItem; savedIndex: number }[] = [];
  saved.songIds.forEach((id, savedIndex) => {
    const song = bySong.get(id);
    if (song?.isPlayable) {
      kept.push({ item: toQueueItem(song), savedIndex });
    }
  });
  if (kept.length === 0) return;

  const items = kept.map((k) => k.item);
  const keyAtSaved = new Map(kept.map((k) => [k.savedIndex, k.item.key]));
  const currentAt = kept.findIndex((k) => k.savedIndex >= saved.index);
  const index = currentAt >= 0 ? currentAt : items.length - 1;
  const resumeMs = kept[index]?.savedIndex === saved.index ? saved.positionMs : 0;
  const originalKeys = saved.shuffle
    ? (saved.originalOrder ?? []).map((i) => keyAtSaved.get(i)).filter((key): key is string => key !== undefined)
    : null;

  usePlayerStore.setState({
    queue: { items, index, shuffle: saved.shuffle, originalKeys },
    repeat: saved.repeat ?? 'off',
    status: { isPlaying: false, isBuffering: false, ended: false, positionMs: resumeMs, durationMs: items[index].durationMs, timestamp: Date.now() },
  });
  native(() => audio().setQueue(items.map(toNative), index, resumeMs, false));
  native(() => audio().setRepeatMode(saved.repeat ?? 'off'));
}

let started = false;

/** Connects to the audio engine and restores the last queue (paused). Call once at startup. */
export function startPlayer() {
  if (started || !isAudioAvailable) return;
  started = true;
  const engine = audio();
  engine.addListener('onPlaybackState', onPlaybackState);
  engine.addListener('onTransition', onTransition);
  engine.addListener('onError', (event) => {
    usePlayerStore.setState({ lastError: event.message });
    const item = usePlayerStore.getState().queue.items.find((i) => i.key === event.key);
    showToast(item ? `Couldn’t play “${item.title}”. Skipped.` : 'A song couldn’t be played.');
  });
  if (useSettings.getState().restoreQueue) {
    restore();
  }
  // Save the exact position when the app goes to the background.
  AppState.addEventListener('change', (state) => {
    if (state !== 'active') saveNow();
  });
}

/**
 * After a song's details were edited, refreshes every queued copy of it (Now Playing, mini player,
 * queue). The lock screen picks up the new details the next time the song starts.
 */
export function refreshSongInQueue(songId: number) {
  const song = getPlayableSongs(db, [songId])[0];
  if (!song) return;
  const { queue } = usePlayerStore.getState();
  if (!queue.items.some((item) => item.songId === songId)) return;
  const fresh = toQueueItem(song);
  usePlayerStore.setState({
    queue: {
      ...queue,
      items: queue.items.map((item) =>
        item.songId === songId
          ? {
              ...item,
              title: fresh.title,
              artist: fresh.artist,
              album: fresh.album,
              albumId: fresh.albumId,
              artworkUri: fresh.artworkUri,
            }
          : item,
      ),
    },
  });
}
