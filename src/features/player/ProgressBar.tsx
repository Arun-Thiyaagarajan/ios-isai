import { useEffect, useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Text, makeStyles, useReducedMotion, useTheme } from '@/design';
import { formatDuration } from '@/lib/format';

import { seekTo } from './playerService';
import { usePlayerStore } from './playerStore';
import { useProgress } from './useProgress';

/** Taller touch area than the visible track, so it's easy to grab. */
const TOUCH_HEIGHT = 36;
const TRACK_HEIGHT = 4;
const TRACK_HEIGHT_SCRUBBING = 8;
const THUMB_SIZE = 16;
/** After a seek, the bar trusts the new spot until the engine confirms it (or this long passes). */
const SEEK_HOLD_MS = 2500;
/** The engine's report counts as "arrived" when it's this close to where we seeked. */
const SEEK_ARRIVED_MS = 1500;

/** Wall-clock milliseconds; usable on the UI thread (same clock as the engine's timestamps). */
function clock(): number {
  'worklet';
  return Date.now();
}

type Props = {
  /** Smaller times row, for the lyrics screen. */
  compact?: boolean;
};

/**
 * Seek bar. A thin 4pt track that thickens to 8pt and shows a thumb while you touch it.
 * Tap anywhere or drag to seek; the song jumps once, when the finger lifts.
 *
 * The fill moves on the UI thread every frame from the engine's last reported position, so it's
 * smooth without re-rendering React. While dragging, engine updates never move the thumb, and
 * after a seek the bar stays at the new spot until the engine reports it (no jump back).
 */
export function ProgressBar({ compact = false }: Props) {
  const theme = useTheme();
  const styles = useStyles();
  const reducedMotion = useReducedMotion();
  const status = usePlayerStore((s) => s.status);
  const { positionMs, durationMs } = useProgress(500);
  const [scrubMs, setScrubMs] = useState<number | null>(null);

  const width = useSharedValue(0);
  const duration = useSharedValue(0);
  /** 0…1 while the finger is down, otherwise -1. */
  const scrub = useSharedValue(-1);
  /** Last whole second shown while scrubbing, so the labels only re-render when it changes. */
  const scrubSecond = useSharedValue(-1);
  /** 0 idle → 1 scrubbing: drives the track height and the thumb. */
  const active = useSharedValue(0);
  const live = useSharedValue(0);
  /** Pending seek: target position and when it was requested (0 = none). */
  const hold = useSharedValue({ targetMs: 0, since: 0 });
  // The engine's last report, copied to the UI thread; the frame callback extrapolates from it.
  const anchor = useSharedValue({ positionMs: 0, durationMs: 0, timestamp: 0, playing: false });

  useEffect(() => {
    duration.set(status.durationMs);
    anchor.set({
      positionMs: status.positionMs,
      durationMs: status.durationMs,
      timestamp: status.timestamp,
      playing: status.isPlaying,
    });
    const pending = hold.get();
    if (pending.since > 0) {
      const arrived = Math.abs(status.positionMs - pending.targetMs) < SEEK_ARRIVED_MS;
      if (arrived || Date.now() - pending.since > SEEK_HOLD_MS) {
        hold.set({ targetMs: 0, since: 0 });
      } else {
        return; // Still on the way: keep showing the new spot.
      }
    }
    if (!status.isPlaying && status.durationMs > 0) {
      live.set(Math.min(1, status.positionMs / status.durationMs));
    }
  }, [status, anchor, live, duration, hold]);

  const ticker = useFrameCallback(() => {
    const a = anchor.get();
    if (a.durationMs <= 0) {
      live.set(0);
      return;
    }
    const pending = hold.get();
    const now = clock();
    if (pending.since > 0 && now - pending.since <= SEEK_HOLD_MS) {
      // Advance from the seek target, not from the engine's (older) position.
      const elapsed = a.playing ? now - pending.since : 0;
      live.set(Math.min(1, (pending.targetMs + elapsed) / a.durationMs));
      return;
    }
    const elapsed = a.playing ? Math.max(0, now - a.timestamp) : 0;
    live.set(Math.min(1, (a.positionMs + elapsed) / a.durationMs));
  }, false);

  // Only tick while playing: a paused bar costs nothing.
  useEffect(() => {
    ticker.setActive(status.isPlaying);
  }, [ticker, status.isPlaying]);

  const animationMs = reducedMotion ? 0 : theme.motion.duration.fast;

  // Built once (not every render), so a drag in progress is never interrupted.
  const scrubGesture = useMemo(() => {
    const fractionAt = (x: number) => {
      'worklet';
      return width.get() > 0 ? Math.min(1, Math.max(0, x / width.get())) : 0;
    };
    const report = (fraction: number) => {
      'worklet';
      const ms = fraction * duration.get();
      const second = Math.floor(ms / 1000);
      if (second !== scrubSecond.get()) {
        scrubSecond.set(second);
        scheduleOnRN(setScrubMs, ms);
      }
    };
    return (
      Gesture.Pan()
        // Starts on touch-down, so a simple tap seeks too.
        .minDistance(0)
        .shouldCancelWhenOutside(false)
        .onBegin((e) => {
          const fraction = fractionAt(e.x);
          scrub.set(fraction);
          active.set(withTiming(1, { duration: animationMs }));
          report(fraction);
        })
        .onUpdate((e) => {
          const fraction = fractionAt(e.x);
          scrub.set(fraction);
          report(fraction);
        })
        .onEnd(() => {
          const fraction = scrub.get();
          if (fraction >= 0 && duration.get() > 0) {
            const target = fraction * duration.get();
            live.set(fraction);
            hold.set({ targetMs: target, since: clock() });
            scheduleOnRN(seekTo, target);
          }
        })
        .onFinalize(() => {
          scrub.set(-1);
          scrubSecond.set(-1);
          active.set(withTiming(0, { duration: animationMs }));
          scheduleOnRN(setScrubMs, null);
        })
    );
  }, [width, duration, scrub, scrubSecond, active, live, hold, animationMs]);

  const trackStyle = useAnimatedStyle(() => {
    const height = TRACK_HEIGHT + (TRACK_HEIGHT_SCRUBBING - TRACK_HEIGHT) * active.get();
    return { height, borderRadius: height / 2 };
  });
  const fillStyle = useAnimatedStyle(() => ({
    width: `${(scrub.get() >= 0 ? scrub.get() : live.get()) * 100}%`,
  }));
  const thumbStyle = useAnimatedStyle(() => {
    const fraction = scrub.get() >= 0 ? scrub.get() : live.get();
    return {
      opacity: active.get(),
      transform: [
        { translateX: fraction * width.get() - THUMB_SIZE / 2 },
        { scale: 0.4 + 0.6 * active.get() },
      ],
    };
  });

  // seekTo() moves the stored position right away, so the labels need no hold of their own.
  const shownMs = scrubMs ?? positionMs;

  return (
    <View>
      <GestureDetector gesture={scrubGesture}>
        <View
          onLayout={(e: LayoutChangeEvent) => {
            width.set(e.nativeEvent.layout.width);
          }}
          style={styles.touch}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Song position"
          accessibilityValue={{ text: `${formatDuration(positionMs)} of ${formatDuration(durationMs)}` }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(event) => {
            const step = event.nativeEvent.actionName === 'increment' ? 10_000 : -10_000;
            seekTo(Math.min(durationMs, Math.max(0, positionMs + step)));
          }}
        >
          <Animated.View style={[styles.track, trackStyle]}>
            <Animated.View style={[styles.fill, fillStyle]} />
          </Animated.View>
          <Animated.View style={[styles.thumb, thumbStyle]} pointerEvents="none" />
        </View>
      </GestureDetector>
      <View style={styles.times}>
        <Text variant={compact ? 'caption' : 'footnote'} color="secondary" tabular>
          {formatDuration(shownMs)}
        </Text>
        <Text variant={compact ? 'caption' : 'footnote'} color="secondary" tabular>
          -{formatDuration(Math.max(0, durationMs - shownMs))}
        </Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  touch: {
    height: TOUCH_HEIGHT,
    justifyContent: 'center',
  },
  track: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: t.colors.progressTrack,
  },
  fill: {
    height: '100%',
    backgroundColor: t.colors.progressFill,
  },
  thumb: {
    position: 'absolute',
    left: 0,
    top: (TOUCH_HEIGHT - THUMB_SIZE) / 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: t.colors.progressFill,
  },
  times: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: -t.spacing.xs,
  },
}));
