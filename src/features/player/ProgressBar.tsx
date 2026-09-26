import { Canvas, Circle, Path, Shadow, usePathValue } from '@shopify/react-native-skia';
import { useIsFocused } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { AppState, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useDerivedValue, useFrameCallback, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Text, makeStyles, useReducedMotion, useTheme } from '@/design';
import { useSettings } from '@/features/settings/settingsStore';
import { formatDuration } from '@/lib/format';

import { seekTo } from './playerService';
import { usePlayerStore } from './playerStore';
import { useProgress } from './useProgress';

/** Taller touch area than the visible track, so it's easy to grab. */
const TOUCH_HEIGHT = 36;
const MID = TOUCH_HEIGHT / 2;
/** The drawing extends past the track's ends so the thumb and wave are never clipped. */
const OVERHANG = 12;
/** After a seek, the bar trusts the new spot until the engine confirms it (or this long passes). */
const SEEK_HOLD_MS = 2500;
/** The engine's report counts as "arrived" when it's this close to where we seeked. */
const SEEK_ARRIVED_MS = 1500;

/** Everything about the look of the bar, in one place to tune. */
export const PROGRESS_LOOK = {
  /** Played part (wave or line) and the unplayed line. */
  stroke: 3,
  trackStroke: 3,
  thumb: { size: 11, sizeDragging: 19 },
  wave: {
    amplitude: 3,
    wavelength: 26,
    /** Wavelengths per second while playing. */
    speed: 1,
    /** Flattening on pause / growing back on play. */
    flattenMs: 300,
    /** Horizontal step between path points; smaller is smoother. */
    step: 2,
  },
} as const;

/** Wall-clock milliseconds; usable on the UI thread (same clock as the engine's timestamps). */
function clock(): number {
  'worklet';
  return Date.now();
}

/** Smooth 0→1 ramp, used to taper the wave into the thumb. */
function smoothstep(t: number): number {
  'worklet';
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

/** Whether the app is in the foreground (the wave stops in the background). */
function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => subscription.remove();
  }, []);
  return active;
}

type Props = {
  /** Smaller times row, for the lyrics screen. */
  compact?: boolean;
};

/**
 * Seek bar with a round thumb at the end of the played part. Wavy style (a setting): the played
 * part is a moving sine wave that flattens on pause and while dragging; the rest is a straight line.
 * Tap anywhere or drag to seek; the song jumps once, when the finger lifts.
 *
 * Drawn with Skia and animated on the UI thread every frame from the engine's last reported
 * position, so it's smooth without re-rendering React. While dragging, engine updates never move
 * the thumb, and after a seek the bar stays at the new spot until the engine reports it (no jump
 * back). The frame loop only runs while playing, on screen, with the app in the foreground.
 */
export function ProgressBar({ compact = false }: Props) {
  const theme = useTheme();
  const styles = useStyles();
  const reducedMotion = useReducedMotion();
  const focused = useIsFocused();
  const appActive = useAppActive();
  const style = useSettings((s) => s.progressStyle);
  const status = usePlayerStore((s) => s.status);
  const { positionMs, durationMs } = useProgress(500);
  const [scrubMs, setScrubMs] = useState<number | null>(null);

  // Reduce Motion always gets the straight bar.
  const wavy = style === 'wavy' && !reducedMotion;
  const waveOn = wavy && status.isPlaying;

  const width = useSharedValue(0);
  const duration = useSharedValue(0);
  /** 0…1 while the finger is down, otherwise -1. */
  const scrub = useSharedValue(-1);
  /** Last whole second shown while scrubbing, so the labels only re-render when it changes. */
  const scrubSecond = useSharedValue(-1);
  /** 0 idle → 1 scrubbing: drives the thumb size. */
  const active = useSharedValue(0);
  const live = useSharedValue(0);
  /** Pending seek: target position and when it was requested (0 = none). */
  const hold = useSharedValue({ targetMs: 0, since: 0 });
  // The engine's last report, copied to the UI thread; the frame callback extrapolates from it.
  const anchor = useSharedValue({ positionMs: 0, durationMs: 0, timestamp: 0, playing: false });
  /** Wave height 0 (flat) … 1 (full), and where along its cycle it is (radians). */
  const amplitude = useSharedValue(waveOn ? 1 : 0);
  const waveTarget = useSharedValue(waveOn ? 1 : 0);
  const phase = useSharedValue(0);

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

  // Wave grows while playing and flattens on pause (not while a finger is on the bar).
  useEffect(() => {
    const target = waveOn ? 1 : 0;
    waveTarget.set(target);
    if (scrub.get() < 0) {
      amplitude.set(withTiming(target, { duration: PROGRESS_LOOK.wave.flattenMs }));
    }
  }, [waveOn, waveTarget, amplitude, scrub]);

  const ticker = useFrameCallback((frame) => {
    const { wave } = PROGRESS_LOOK;
    const dt = frame.timeSincePreviousFrame ?? 16;
    phase.set((phase.get() + (2 * Math.PI * wave.speed * dt) / 1000) % (2 * Math.PI));

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

  // Only tick while playing and visible: a paused or hidden bar costs nothing.
  useEffect(() => {
    ticker.setActive(status.isPlaying && focused && appActive);
  }, [ticker, status.isPlaying, focused, appActive]);

  const grow = reducedMotion ? 0 : 1;

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
    const spring = { damping: 18, stiffness: 320, mass: 0.8 };
    return (
      Gesture.Pan()
        // Starts on touch-down, so a simple tap seeks too.
        .minDistance(0)
        .shouldCancelWhenOutside(false)
        .onBegin((e) => {
          const fraction = fractionAt(e.x);
          scrub.set(fraction);
          active.set(grow ? withSpring(1, spring) : 1);
          // Flat while dragging, so the spot is precise.
          amplitude.set(withTiming(0, { duration: 150 }));
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
          active.set(grow ? withSpring(0, spring) : 0);
          amplitude.set(withTiming(waveTarget.get(), { duration: PROGRESS_LOOK.wave.flattenMs }));
          scheduleOnRN(setScrubMs, null);
        })
    );
  }, [width, duration, scrub, scrubSecond, active, live, hold, amplitude, waveTarget, grow]);

  /** Where the played part ends, in canvas coordinates. */
  const thumbX = useDerivedValue(() => {
    const fraction = scrub.get() >= 0 ? scrub.get() : live.get();
    return OVERHANG + fraction * width.get();
  });

  // The played part: a sine wave that tapers to the center line right at the thumb, so it joins
  // the thumb and the straight unplayed line without a step. Flat when amplitude is 0.
  const playedPath = usePathValue((path) => {
    'worklet';
    const { wave } = PROGRESS_LOOK;
    const end = thumbX.get() - OVERHANG;
    const height = wave.amplitude * amplitude.get();
    const k = (2 * Math.PI) / wave.wavelength;
    const taper = wave.wavelength / 2;
    const yAt = (x: number) => MID + height * smoothstep((end - x) / taper) * Math.sin(k * x - phase.get());
    path.moveTo(OVERHANG, height > 0 ? yAt(0) : MID);
    if (end <= 0) return;
    if (height > 0) {
      for (let x = wave.step; x < end; x += wave.step) {
        path.lineTo(OVERHANG + x, yAt(x));
      }
    }
    path.lineTo(OVERHANG + end, MID);
  });

  const unplayedPath = usePathValue((path) => {
    'worklet';
    path.moveTo(thumbX.get(), MID);
    path.lineTo(OVERHANG + width.get(), MID);
  });

  const thumbRadius = useDerivedValue(() => {
    const { size, sizeDragging } = PROGRESS_LOOK.thumb;
    return duration.get() > 0 ? (size + (sizeDragging - size) * active.get()) / 2 : 0;
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
          <Canvas style={styles.canvas} pointerEvents="none">
            <Path
              path={unplayedPath}
              style="stroke"
              strokeWidth={PROGRESS_LOOK.trackStroke}
              strokeCap="round"
              color={theme.colors.progressTrack}
            />
            <Path
              path={playedPath}
              style="stroke"
              strokeWidth={PROGRESS_LOOK.stroke}
              strokeCap="round"
              strokeJoin="round"
              color={theme.colors.progressFill}
            />
            <Circle cx={thumbX} cy={MID} r={thumbRadius} color={theme.colors.progressFill}>
              {/* A soft shadow keeps the thumb visible on any background. */}
              <Shadow dx={0} dy={1} blur={2.5} color="rgba(0, 0, 0, 0.35)" />
            </Circle>
          </Canvas>
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
  canvas: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: -OVERHANG,
    right: -OVERHANG,
  },
  times: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: -t.spacing.xs,
  },
}));
