import {
  addToQueue,
  applyOps,
  clearUpNext,
  insertAt,
  move,
  playNext,
  removeAt,
  setShuffle,
  startQueue,
  type QueueChange,
  type QueueItem,
  type QueueState,
} from '../queue';

let n = 0;
function item(title: string): QueueItem {
  n += 1;
  return { key: `${title}#${n}`, songId: n, title, artist: '', album: null, albumId: null, artworkUri: null, durationMs: 1 };
}
const items = (...titles: string[]) => titles.map(item);
const titles = (state: QueueState) => state.items.map((i) => i.title);
const current = (state: QueueState) => state.items[state.index].title;

/** Deterministic "random" so shuffles are repeatable. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * The native player's list, simulated. After every change, applying the ops to it must give
 * exactly the new queue, and the playing song must never have been removed.
 */
function check(before: QueueState, change: QueueChange) {
  const native = applyOps(before.items.map((i) => i.key), change.ops, (i) => i.key);
  expect(native).toEqual(change.state.items.map((i) => i.key));
  if (before.items.length > 0 && change.state.items.length > 0) {
    // The song that was playing is still playing.
    expect(change.state.items[change.state.index].key).toBe(before.items[before.index].key);
  }
  return change.state;
}

describe('queue', () => {
  it('starts at the chosen song', () => {
    const q = startQueue(items('A', 'B', 'C'), 1, false);
    expect(current(q)).toBe('B');
  });

  it('starts shuffled with the chosen song first and every song exactly once', () => {
    const q = startQueue(items('A', 'B', 'C', 'D', 'E'), 2, true, seeded(1));
    expect(current(q)).toBe('C');
    expect(q.index).toBe(0);
    expect([...titles(q)].sort()).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('plays next right after the current song, in order', () => {
    let q = startQueue(items('A', 'B', 'C'), 0, false);
    q = check(q, playNext(q, items('X', 'Y')));
    expect(titles(q)).toEqual(['A', 'X', 'Y', 'B', 'C']);
    q = check(q, playNext(q, items('Z')));
    expect(titles(q)).toEqual(['A', 'Z', 'X', 'Y', 'B', 'C']);
  });

  it('adds to the end of the queue', () => {
    let q = startQueue(items('A', 'B'), 0, false);
    q = check(q, addToQueue(q, items('X')));
    expect(titles(q)).toEqual(['A', 'B', 'X']);
  });

  it('starts a queue when adding to an empty one', () => {
    const q = playNext(startQueue([], 0, false), items('X')).state;
    expect(titles(q)).toEqual(['X']);
    expect(q.index).toBe(0);
  });

  it('removes songs before and after the current one, keeping the current song', () => {
    let q = startQueue(items('A', 'B', 'C', 'D'), 2, false);
    q = check(q, removeAt(q, 0));
    expect(titles(q)).toEqual(['B', 'C', 'D']);
    expect(current(q)).toBe('C');
    q = check(q, removeAt(q, 2));
    expect(titles(q)).toEqual(['B', 'C']);
    // The playing song can't be removed.
    expect(removeAt(q, q.index).ops).toEqual([]);
  });

  it('moves songs and keeps track of the current one', () => {
    let q = startQueue(items('A', 'B', 'C', 'D'), 1, false);
    q = check(q, move(q, 3, 0));
    expect(titles(q)).toEqual(['D', 'A', 'B', 'C']);
    expect(current(q)).toBe('B');
    q = check(q, move(q, 0, 3));
    expect(titles(q)).toEqual(['A', 'B', 'C', 'D']);
    expect(current(q)).toBe('B');
  });

  it('clears everything after the current song', () => {
    let q = startQueue(items('A', 'B', 'C', 'D'), 1, false);
    q = check(q, clearUpNext(q));
    expect(titles(q)).toEqual(['A', 'B']);
  });

  it('shuffles around the playing song and restores the original order', () => {
    let q = startQueue(items('A', 'B', 'C', 'D', 'E'), 2, false);
    q = check(q, setShuffle(q, true, seeded(7)));
    expect(current(q)).toBe('C');
    expect(q.index).toBe(0);
    q = check(q, setShuffle(q, false));
    expect(titles(q)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(current(q)).toBe('C');
  });

  it('keeps "play next" songs next after turning shuffle off', () => {
    let q = startQueue(items('A', 'B', 'C', 'D'), 0, true, seeded(3));
    q = check(q, playNext(q, items('X')));
    expect(q.items[q.index + 1].title).toBe('X');
    q = check(q, setShuffle(q, false));
    expect(titles(q)).toEqual(['A', 'X', 'B', 'C', 'D']);
  });

  it('forgets removed songs when restoring the original order', () => {
    let q = startQueue(items('A', 'B', 'C', 'D'), 0, true, seeded(5));
    const removedTitle = q.items[1].title;
    q = check(q, removeAt(q, 1));
    q = check(q, setShuffle(q, false));
    expect(titles(q)).toEqual(['A', 'B', 'C', 'D'].filter((t) => t !== removedTitle));
  });

  it('stays consistent through a long random sequence of edits', () => {
    const random = seeded(42);
    let q = startQueue(items('A', 'B', 'C', 'D', 'E', 'F'), 2, false);
    for (let step = 0; step < 300; step++) {
      const r = random();
      const pos = Math.floor(random() * q.items.length);
      const to = Math.floor(random() * q.items.length);
      const change =
        r < 0.2
          ? playNext(q, items('N'))
          : r < 0.35
            ? addToQueue(q, items('Q'))
            : r < 0.55
              ? removeAt(q, pos)
              : r < 0.75
                ? move(q, pos, to)
                : r < 0.9
                  ? setShuffle(q, !q.shuffle, random)
                  : q.items.length > 12
                    ? clearUpNext(q)
                    : addToQueue(q, items('R'));
      q = check(q, change);
      expect(new Set(q.items.map((i) => i.key)).size).toBe(q.items.length);
      if (q.originalKeys) {
        expect([...q.originalKeys].sort()).toEqual(q.items.map((i) => i.key).sort());
      }
    }
  });

  it('puts a removed song back where it was (Undo)', () => {
    const start = startQueue(items('A', 'B', 'C', 'D'), 1, false);
    const removed = start.items[3];
    const without = check(start, removeAt(start, 3));
    const back = check(without, insertAt(without, 3, [removed]));
    expect(titles(back)).toEqual(['A', 'B', 'C', 'D']);
    expect(current(back)).toBe('B');
  });

  it('keeps the playing song when songs go back in front of it', () => {
    const start = startQueue(items('A', 'B', 'C'), 2, false);
    const removed = start.items[0];
    const without = check(start, removeAt(start, 0));
    const back = check(without, insertAt(without, 0, [removed]));
    expect(titles(back)).toEqual(['A', 'B', 'C']);
    expect(current(back)).toBe('C');
  });

  it('restores a cleared Up Next', () => {
    const start = startQueue(items('A', 'B', 'C'), 0, true, seeded(3));
    const upNext = start.items.slice(1);
    const cleared = check(start, clearUpNext(start));
    const back = check(cleared, insertAt(cleared, 1, upNext));
    expect(back.items.map((i) => i.key)).toEqual(start.items.map((i) => i.key));
    expect([...back.originalKeys!].sort()).toEqual(back.items.map((i) => i.key).sort());
  });
});
