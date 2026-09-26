import type {
  audio,
  NativeQueueItem,
  NativeRepeatMode,
  PlaybackStateEvent,
  TransitionEvent,
} from '@modules/isai-audio';

type AudioModule = ReturnType<typeof audio>;
type Listener = (event: never) => void;

/**
 * Expo Go only: a pretend audio engine with the same API and events as Isai's native one. Nothing
 * is heard; it just keeps a queue and a clock, so every player screen can be tried out.
 */
function createDemoAudio(): AudioModule {
  const listeners = new Map<string, Set<Listener>>();
  let items: NativeQueueItem[] = [];
  let index = 0;
  let playing = false;
  let ended = false;
  let repeat: NativeRepeatMode = 'off';
  /** Position at `anchor` (epoch ms); advances while playing. */
  let positionMs = 0;
  let anchor = Date.now();
  let endTimer: ReturnType<typeof setTimeout> | null = null;

  const current = () => items[index] ?? null;
  const position = () => Math.min(positionMs + (playing ? Date.now() - anchor : 0), current()?.durationMs ?? 0);

  function emit<E>(name: string, event: E) {
    listeners.get(name)?.forEach((listener) => (listener as (e: E) => void)(event));
  }

  function state(): PlaybackStateEvent {
    return {
      index,
      key: current()?.key ?? null,
      isPlaying: playing,
      isBuffering: false,
      ended,
      positionMs: position(),
      durationMs: current()?.durationMs ?? 0,
      queueLength: items.length,
      repeat,
      timestamp: Date.now(),
    };
  }

  /** Stops the clock at the current position; every change starts with this. */
  function freeze() {
    positionMs = position();
    anchor = Date.now();
  }

  /** Schedules the end of the song and tells the app. */
  function update() {
    if (endTimer) clearTimeout(endTimer);
    endTimer = null;
    const item = current();
    if (playing && item) {
      endTimer = setTimeout(() => finish(true), Math.max(0, item.durationMs - positionMs));
    }
    emit('onPlaybackState', state());
  }

  /** Leaves the current song (finished or skipped) for `to`, or stops at the end of the queue. */
  function go(to: number, completed: boolean) {
    freeze();
    const from = current();
    const played = positionMs;
    if (to >= items.length) {
      to = repeat === 'all' ? 0 : -1;
    }
    if (from) {
      const transition: TransitionEvent = {
        fromKey: from.key,
        toKey: to >= 0 ? (items[to]?.key ?? null) : null,
        completed,
        playedMs: played,
        durationMs: from.durationMs,
      };
      emit('onTransition', transition);
    }
    positionMs = 0;
    if (to < 0) {
      playing = false;
      ended = true;
    } else {
      index = to;
      ended = false;
    }
    update();
  }

  function finish(completed: boolean) {
    go(repeat === 'one' && completed ? index : index + 1, completed);
  }

  const done = Promise.resolve();

  return {
    setQueue(next, at, startMs, play) {
      items = [...next];
      index = Math.max(0, Math.min(at, items.length - 1));
      positionMs = startMs;
      anchor = Date.now();
      playing = play && items.length > 0;
      ended = false;
      update();
      return done;
    },
    insert(at, added) {
      freeze();
      items.splice(at, 0, ...added);
      if (at <= index && items.length > added.length) index += added.length;
      update();
      return done;
    },
    remove(from, to) {
      freeze();
      const removingCurrent = index >= from && index < to;
      items.splice(from, to - from);
      if (index >= to) index -= to - from;
      else if (removingCurrent) {
        index = Math.min(from, Math.max(0, items.length - 1));
        positionMs = 0;
      }
      if (items.length === 0) playing = false;
      update();
      return done;
    },
    move(from, to) {
      freeze();
      const [item] = items.splice(from, 1);
      items.splice(to, 0, item);
      if (index === from) index = to;
      else if (from < index && to >= index) index -= 1;
      else if (from > index && to <= index) index += 1;
      update();
      return done;
    },
    play() {
      if (items.length === 0) return done;
      freeze();
      if (ended) {
        ended = false;
        index = 0;
        positionMs = 0;
      }
      playing = true;
      update();
      return done;
    },
    pause() {
      freeze();
      playing = false;
      update();
      return done;
    },
    seekTo(ms) {
      positionMs = Math.max(0, ms);
      anchor = Date.now();
      update();
      return done;
    },
    skipToNext() {
      go(index + 1, false);
      return done;
    },
    skipToPrevious() {
      // Like a real player: restart the song unless it has only just begun.
      if (position() > 3000 || index === 0) {
        positionMs = 0;
        anchor = Date.now();
        update();
      } else {
        go(index - 1, false);
      }
      return done;
    },
    skipTo(to) {
      go(to, false);
      return done;
    },
    setRepeatMode(mode) {
      freeze();
      repeat = mode;
      update();
      return done;
    },
    getState() {
      return Promise.resolve({ ...state(), keys: items.map((item) => item.key) });
    },
    addListener(name, listener) {
      let set = listeners.get(name);
      if (!set) {
        set = new Set();
        listeners.set(name, set);
      }
      set.add(listener as Listener);
      return { remove: () => set.delete(listener as Listener) };
    },
  };
}

let instance: AudioModule | null = null;

export function demoAudio(): AudioModule {
  instance ??= createDemoAudio();
  return instance;
}
