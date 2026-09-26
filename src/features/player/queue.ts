/**
 * Queue logic, kept pure so it can be tested exhaustively.
 *
 * The native player only knows a list of items and the current index. Every user action here
 * returns the new state plus a few primitive native operations (insert / remove / move) that turn
 * the native list into exactly `state.items`, without interrupting the song that's playing.
 */

export type QueueItem = {
  /** Unique per queue entry (the same song can be queued twice). */
  key: string;
  songId: number;
  title: string;
  artist: string;
  album: string | null;
  albumId: number | null;
  artworkUri: string | null;
  durationMs: number;
  /** Android: content:// URI. */
  uri?: string;
  /** iOS: "documents" or a folder bookmark, plus the path inside it. */
  root?: string;
  path?: string;
  /** Volume levelling gains (dB) for track and album mode; 0 without ReplayGain tags. */
  trackGainDb?: number;
  albumGainDb?: number;
};

export type RepeatMode = 'off' | 'all' | 'one';

export type QueueState = {
  items: QueueItem[];
  index: number;
  shuffle: boolean;
  /** Keys in the order before shuffling, to restore it when shuffle is turned off. */
  originalKeys: string[] | null;
};

export type NativeOp =
  | { type: 'insert'; at: number; items: QueueItem[] }
  | { type: 'remove'; from: number; to: number } // `to` exclusive
  | { type: 'move'; from: number; to: number };

export type QueueChange = { state: QueueState; ops: NativeOp[] };

export const emptyQueue: QueueState = { items: [], index: 0, shuffle: false, originalKeys: null };

let keyCounter = 0;
/** Fresh unique key for a new queue entry. */
export function newKey(): string {
  keyCounter += 1;
  return `${Date.now().toString(36)}-${keyCounter.toString(36)}`;
}

/** Fisher–Yates shuffle with an injectable random source for tests. */
export function shuffled<T>(list: readonly T[], random: () => number = Math.random): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Starts a new queue. With shuffle, the chosen song plays first and the rest are shuffled. */
export function startQueue(
  items: QueueItem[],
  startIndex: number,
  shuffle: boolean,
  random?: () => number,
): QueueState {
  const start = Math.max(0, Math.min(startIndex, items.length - 1));
  if (!shuffle || items.length < 2) {
    return { items, index: start, shuffle, originalKeys: shuffle ? items.map((i) => i.key) : null };
  }
  const first = items[start];
  const rest = shuffled(
    items.filter((_, i) => i !== start),
    random,
  );
  return { items: [first, ...rest], index: 0, shuffle: true, originalKeys: items.map((i) => i.key) };
}

/** Inserts songs right after the current one. */
export function playNext(state: QueueState, newItems: QueueItem[]): QueueChange {
  if (newItems.length === 0) {
    return { state, ops: [] };
  }
  if (state.items.length === 0) {
    return { state: { ...emptyQueue, items: newItems }, ops: [{ type: 'insert', at: 0, items: newItems }] };
  }
  const at = state.index + 1;
  const items = [...state.items.slice(0, at), ...newItems, ...state.items.slice(at)];
  let originalKeys = state.originalKeys;
  if (originalKeys) {
    // Also right after the current song in the original order, so turning shuffle off keeps them next.
    const current = state.items[state.index].key;
    const pos = originalKeys.indexOf(current) + 1;
    originalKeys = [...originalKeys.slice(0, pos), ...newItems.map((i) => i.key), ...originalKeys.slice(pos)];
  }
  return { state: { ...state, items, originalKeys }, ops: [{ type: 'insert', at, items: newItems }] };
}

/** Appends songs to the end of the queue. */
export function addToQueue(state: QueueState, newItems: QueueItem[]): QueueChange {
  if (newItems.length === 0) {
    return { state, ops: [] };
  }
  const at = state.items.length;
  return {
    state: {
      ...state,
      items: [...state.items, ...newItems],
      originalKeys: state.originalKeys ? [...state.originalKeys, ...newItems.map((i) => i.key)] : null,
    },
    ops: [{ type: 'insert', at, items: newItems }],
  };
}

/** Removes one upcoming or previous song. The playing song can't be removed this way. */
export function removeAt(state: QueueState, position: number): QueueChange {
  if (position === state.index || position < 0 || position >= state.items.length) {
    return { state, ops: [] };
  }
  const key = state.items[position].key;
  return {
    state: {
      ...state,
      items: state.items.filter((_, i) => i !== position),
      index: position < state.index ? state.index - 1 : state.index,
      originalKeys: state.originalKeys?.filter((k) => k !== key) ?? null,
    },
    ops: [{ type: 'remove', from: position, to: position + 1 }],
  };
}

/** Moves a song within the queue (e.g. drag to reorder). */
export function move(state: QueueState, from: number, to: number): QueueChange {
  const last = state.items.length - 1;
  if (from === to || from < 0 || to < 0 || from > last || to > last) {
    return { state, ops: [] };
  }
  const items = [...state.items];
  const [moved] = items.splice(from, 1);
  items.splice(to, 0, moved);

  let index = state.index;
  if (from === state.index) {
    index = to;
  } else if (from < state.index && to >= state.index) {
    index -= 1;
  } else if (from > state.index && to <= state.index) {
    index += 1;
  }
  return { state: { ...state, items, index }, ops: [{ type: 'move', from, to }] };
}

/** Removes every song after the current one. */
export function clearUpNext(state: QueueState): QueueChange {
  const from = state.index + 1;
  if (from >= state.items.length) {
    return { state, ops: [] };
  }
  const removed = new Set(state.items.slice(from).map((i) => i.key));
  return {
    state: {
      ...state,
      items: state.items.slice(0, from),
      originalKeys: state.originalKeys?.filter((k) => !removed.has(k)) ?? null,
    },
    ops: [{ type: 'remove', from, to: state.items.length }],
  };
}

/**
 * Rebuilds the queue around the playing song: it stays in the native player untouched while
 * everything before and after it is replaced.
 */
function rearrangeAround(state: QueueState, before: QueueItem[], after: QueueItem[]): NativeOp[] {
  const ops: NativeOp[] = [];
  if (state.index > 0) {
    ops.push({ type: 'remove', from: 0, to: state.index });
  }
  if (state.items.length - state.index - 1 > 0) {
    ops.push({ type: 'remove', from: 1, to: state.items.length - state.index });
  }
  if (before.length > 0) {
    ops.push({ type: 'insert', at: 0, items: before });
  }
  if (after.length > 0) {
    ops.push({ type: 'insert', at: before.length + 1, items: after });
  }
  return ops;
}

/** Turns shuffle on (playing song first, the rest shuffled) or off (original order restored). */
export function setShuffle(state: QueueState, on: boolean, random?: () => number): QueueChange {
  if (on === state.shuffle || state.items.length === 0) {
    return { state: { ...state, shuffle: on }, ops: [] };
  }
  const current = state.items[state.index];

  if (on) {
    const rest = shuffled(
      state.items.filter((_, i) => i !== state.index),
      random,
    );
    return {
      state: { items: [current, ...rest], index: 0, shuffle: true, originalKeys: state.items.map((i) => i.key) },
      ops: rearrangeAround(state, [], rest),
    };
  }

  // Restore the original order; anything unknown to it (shouldn't happen) goes to the end.
  const byKey = new Map(state.items.map((i) => [i.key, i]));
  const original = (state.originalKeys ?? [])
    .map((k) => byKey.get(k))
    .filter((i): i is QueueItem => i !== undefined);
  const known = new Set(original.map((i) => i.key));
  const ordered = [...original, ...state.items.filter((i) => !known.has(i.key))];
  const position = ordered.findIndex((i) => i.key === current.key);
  const before = ordered.slice(0, position);
  const after = ordered.slice(position + 1);
  return {
    state: { items: ordered, index: position, shuffle: false, originalKeys: null },
    ops: rearrangeAround(state, before, after),
  };
}

/** Applies native operations to a list the way the native player does. Used by tests and resync checks. */
export function applyOps<T>(list: readonly T[], ops: NativeOp[], toItem: (item: QueueItem) => T): T[] {
  const out = [...list];
  for (const op of ops) {
    if (op.type === 'insert') {
      out.splice(op.at, 0, ...op.items.map(toItem));
    } else if (op.type === 'remove') {
      out.splice(op.from, op.to - op.from);
    } else {
      const [moved] = out.splice(op.from, 1);
      out.splice(op.to, 0, moved);
    }
  }
  return out;
}
