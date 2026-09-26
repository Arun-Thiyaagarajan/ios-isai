import { create } from 'zustand';

import { emptyQueue, type QueueItem, type QueueState, type RepeatMode } from './queue';

export type PlaybackStatus = {
  isPlaying: boolean;
  isBuffering: boolean;
  ended: boolean;
  /** Position at `timestamp`; the UI advances it locally while playing. */
  positionMs: number;
  durationMs: number;
  timestamp: number;
};

type PlayerState = {
  queue: QueueState;
  repeat: RepeatMode;
  status: PlaybackStatus;
  /** Last playback problem, shown briefly to the user. */
  lastError: string | null;
};

export const usePlayerStore = create<PlayerState>()(() => ({
  queue: emptyQueue,
  repeat: 'off',
  status: { isPlaying: false, isBuffering: false, ended: false, positionMs: 0, durationMs: 0, timestamp: 0 },
  lastError: null,
}));

/** The song that's playing (or paused), if any. */
export function useCurrentItem(): QueueItem | null {
  return usePlayerStore((s) => s.queue.items[s.queue.index] ?? null);
}

export function useIsPlaying(): boolean {
  return usePlayerStore((s) => s.status.isPlaying);
}
