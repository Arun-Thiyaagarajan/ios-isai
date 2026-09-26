import { useEffect, useMemo } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { makeStyles } from '../theme';

const HEIGHT = 36;
const TRACK_HEIGHT = 4;
const THUMB_SIZE = 18;

type Props = {
  /** 0…1 */
  value: number;
  /** Called while dragging (live), at most once per `step`. */
  onChange: (value: number) => void;
  accessibilityLabel: string;
  /** Granularity of reported values; also the VoiceOver/TalkBack step. */
  step?: number;
};

/** A flat slider: 4pt track, round thumb. Tap or drag anywhere on it. */
export function Slider({ value, onChange, accessibilityLabel, step = 0.05 }: Props) {
  const styles = useStyles();
  const width = useSharedValue(0);
  const position = useSharedValue(value);
  const dragging = useSharedValue(false);
  const lastReported = useSharedValue(value);

  // Follow outside changes, but never fight the finger.
  useEffect(() => {
    if (!dragging.get()) {
      position.set(value);
      lastReported.set(value);
    }
  }, [value, dragging, position, lastReported]);

  const gesture = useMemo(() => {
    const update = (x: number) => {
      'worklet';
      const fraction = width.get() > 0 ? Math.min(1, Math.max(0, x / width.get())) : 0;
      position.set(fraction);
      const stepped = Math.round(fraction / step) * step;
      if (Math.abs(stepped - lastReported.get()) >= step / 2) {
        lastReported.set(stepped);
        scheduleOnRN(onChange, Math.min(1, Math.max(0, stepped)));
      }
    };
    return Gesture.Pan()
      .minDistance(0)
      .shouldCancelWhenOutside(false)
      .onBegin((e) => {
        dragging.set(true);
        update(e.x);
      })
      .onUpdate((e) => update(e.x))
      .onFinalize(() => {
        dragging.set(false);
      });
  }, [width, position, dragging, lastReported, onChange, step]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${position.get() * 100}%` }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: position.get() * width.get() - THUMB_SIZE / 2 }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={styles.container}
        onLayout={(e: LayoutChangeEvent) => {
          width.set(e.nativeEvent.layout.width);
        }}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          const delta = e.nativeEvent.actionName === 'increment' ? step * 2 : -step * 2;
          onChange(Math.min(1, Math.max(0, value + delta)));
        }}
      >
        <View style={styles.track}>
          <Animated.View style={[styles.fill, fillStyle]} />
        </View>
        <Animated.View style={[styles.thumb, thumbStyle]} pointerEvents="none" />
      </View>
    </GestureDetector>
  );
}

const useStyles = makeStyles((t) => ({
  container: {
    height: HEIGHT,
    justifyContent: 'center',
    marginHorizontal: THUMB_SIZE / 2,
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    overflow: 'hidden',
    backgroundColor: t.colors.progressTrack,
  },
  fill: {
    height: '100%',
    backgroundColor: t.colors.accent,
  },
  thumb: {
    position: 'absolute',
    left: 0,
    top: (HEIGHT - THUMB_SIZE) / 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: t.colors.accent,
  },
}));
