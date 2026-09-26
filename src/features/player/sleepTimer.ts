import { create } from 'zustand';

import { onSongCompleted, pausePlayback } from './playerService';

export const SLEEP_TIMER_MINUTES = [5, 15, 30, 45, 60] as const;

type SleepTimerState = {
  /** When playback pauses (epoch ms), or null. */
  endsAt: number | null;
  /** Pause when the current song finishes. */
  endOfSong: boolean;
};

export const useSleepTimer = create<SleepTimerState>()(() => ({ endsAt: null, endOfSong: false }));

let timer: ReturnType<typeof setTimeout> | null = null;
let unsubscribe: (() => void) | null = null;

function clearPending() {
  if (timer) clearTimeout(timer);
  timer = null;
  unsubscribe?.();
  unsubscribe = null;
}

function finish() {
  clearPending();
  useSleepTimer.setState({ endsAt: null, endOfSong: false });
  pausePlayback();
}

/** Pauses playback after `minutes`. Replaces any running timer. */
export function startSleepTimer(minutes: number) {
  clearPending();
  const endsAt = Date.now() + minutes * 60_000;
  useSleepTimer.setState({ endsAt, endOfSong: false });
  timer = setTimeout(finish, minutes * 60_000);
}

/** Pauses when the song that's playing ends. */
export function sleepAtEndOfSong() {
  clearPending();
  useSleepTimer.setState({ endsAt: null, endOfSong: true });
  unsubscribe = onSongCompleted(finish);
}

export function cancelSleepTimer() {
  clearPending();
  useSleepTimer.setState({ endsAt: null, endOfSong: false });
}

/** "12 min left", "Less than a minute", "End of song", or null when off. */
export function describeSleepTimer(state: SleepTimerState, now = Date.now()): string | null {
  if (state.endOfSong) return 'At end of song';
  if (state.endsAt === null) return null;
  const minutes = Math.ceil((state.endsAt - now) / 60_000);
  return minutes <= 1 ? 'Less than a minute left' : `${minutes} min left`;
}
