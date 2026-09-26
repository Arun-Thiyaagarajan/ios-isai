import { useEffect, useState } from 'react';

import { usePlayerStore } from './playerStore';

/**
 * Current playback position, advanced locally between engine updates so the progress bar moves
 * smoothly. The engine stays the source of truth: every update it sends re-anchors the clock.
 */
export function useProgress(intervalMs = 250) {
  const status = usePlayerStore((s) => s.status);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!status.isPlaying) {
      return;
    }
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [status.isPlaying, intervalMs]);

  const elapsed = status.isPlaying ? Math.max(0, now - status.timestamp) : 0;
  const durationMs = status.durationMs;
  const positionMs = Math.min(status.positionMs + elapsed, durationMs || Number.MAX_SAFE_INTEGER);
  return { positionMs: Math.max(0, positionMs), durationMs };
}
