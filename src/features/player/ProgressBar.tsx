import { useEffect, useState } from 'react';
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

/**
 * Seek bar. A thin 4pt track that thickens to 8pt and shows a thumb while you touch it.
 * Tap anywhere or drag to seek; the engine only seeks when the finger lifts.
 *
 * The fill moves on the UI thread every frame (from the engine's last reported position),
 * so it stays smooth without re-rendering React. The time labels update a few times a second.
 */
export function ProgressBar() {
  const theme = useTheme();
  const styles = useStyles();
  const reducedMotion = useReducedMotion();
  const status = usePlayerStore((s) => s.status);
  const { positionMs, durationMs } = useProgress(500);
  const [scrubMs, setScrubMs] = useState<number | null>(null);

  const width = useSharedValue(0);
  /** 0…1 while the finger is down, otherwise -1. */
  const scrub = useSharedValue(-1);
  /** 0 idle → 1 scrubbing: drives the track height and the thumb. */
  const active = useSharedValue(0);
  const live = useSharedValue(0);
  // The engine's last report, copied to the UI thread; the frame callback extrapolates from it.
  const anchor = useSharedValue({ positionMs: 0, durationMs: 0, timestamp: 0, playing: false });

  useEffect(() => {
    anchor.set({
      positionMs: status.positionMs,
      durationMs: status.durationMs,
      timestamp: status.timestamp,
      playing: status.isPlaying,
    });
    if (!status.isPlaying && status.durationMs > 0) {
      live.set(Math.min(1, status.positionMs / status.durationMs));
    }
  }, [status, anchor, live]);

  const ticker = useFrameCallback(() => {
    const a = anchor.get();
    if (a.durationMs <= 0) {
      live.set(0);
      return;
    }
    const elapsed = a.playing ? Math.max(0, Date.now() - a.timestamp) : 0;
    live.set(Math.min(1, (a.positionMs + elapsed) / a.durationMs));
  }, false);

  // Only tick while playing: a paused bar costs nothing.
  useEffect(() => {
    ticker.setActive(status.isPlaying);
  }, [ticker, status.isPlaying]);

  const duration = reducedMotion ? 0 : theme.motion.duration.fast;

  const scrubGesture = Gesture.Pan()
    // Starts on touch-down, so a simple tap seeks too.
    .minDistance(0)
    .shouldCancelWhenOutside(false)
    .onBegin((e) => {
      const fraction = width.get() > 0 ? Math.min(1, Math.max(0, e.x / width.get())) : 0;
      scrub.set(fraction);
      active.set(withTiming(1, { duration }));
      scheduleOnRN(setScrubMs, fraction * durationMs);
    })
    .onUpdate((e) => {
      const fraction = width.get() > 0 ? Math.min(1, Math.max(0, e.x / width.get())) : 0;
      scrub.set(fraction);
      scheduleOnRN(setScrubMs, fraction * durationMs);
    })
    .onEnd(() => {
      if (scrub.get() >= 0 && durationMs > 0) {
        const target = scrub.get() * durationMs;
        // Show the new position right away instead of snapping back until the engine reports.
        live.set(scrub.get());
        scheduleOnRN(seekTo, target);
      }
    })
    .onFinalize(() => {
      scrub.set(-1);
      active.set(withTiming(0, { duration }));
      scheduleOnRN(setScrubMs, null);
    });

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
        <Text variant="caption" color="secondary" tabular>
          {formatDuration(shownMs)}
        </Text>
        <Text variant="caption" color="secondary" tabular>
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
