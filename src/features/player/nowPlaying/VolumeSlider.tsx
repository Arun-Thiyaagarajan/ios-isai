import { audio, isAudioAvailable, VolumeView } from '@modules/isai-audio';
import { useEffect, useState } from 'react';
import { Platform, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Icon, makeStyles, useTheme } from '@/design';

const HEIGHT = 36;
const TRACK_HEIGHT = 4;
const THUMB_SIZE = 14;

/** Android builds from before the volume functions existed have no `setVolume`. */
const androidVolume = Platform.OS === 'android' && isAudioAvailable && typeof audio().setVolume === 'function';

/**
 * Phone volume, with a quiet speaker on the left and a loud one on the right.
 * iOS uses the system slider (the only way apps may change the iPhone volume); Android uses a
 * flat slider of our own backed by the media volume. Hidden where neither is available.
 */
export function VolumeSlider() {
  const theme = useTheme();
  const styles = useStyles();

  const slider =
    Platform.OS === 'ios' && VolumeView ? (
      <VolumeView
        style={styles.slider}
        fillColor={theme.colors.progressFill}
        trackColor={theme.colors.progressTrack}
        accessibilityLabel="Volume"
      />
    ) : androidVolume ? (
      <AndroidVolumeSlider />
    ) : null;

  if (!slider) {
    return null;
  }

  return (
    <View style={styles.row}>
      <Icon name="volumeLow" size={theme.sizes.icon.sm} color={theme.colors.textSecondary} />
      {slider}
      <Icon name="volumeHigh" size={theme.sizes.icon.sm} color={theme.colors.textSecondary} />
    </View>
  );
}

function AndroidVolumeSlider() {
  const styles = useStyles();
  const [volume, setVolume] = useState(() => audio().getVolume?.() ?? 0);
  const width = useSharedValue(0);
  const dragging = useSharedValue(false);
  const value = useSharedValue(volume);

  // Follow changes made with the volume buttons, except while the finger is on the slider.
  useEffect(() => {
    const subscription = audio().addListener('onVolumeChange', (event) => {
      if (!dragging.get()) {
        value.set(event.volume);
        setVolume(event.volume);
      }
    });
    return () => subscription.remove();
  }, [dragging, value]);

  const apply = (fraction: number) => {
    setVolume(fraction);
    audio()
      .setVolume?.(fraction)
      .catch(() => undefined);
  };

  const gesture = Gesture.Pan()
    .minDistance(0)
    .shouldCancelWhenOutside(false)
    .onBegin((e) => {
      dragging.set(true);
      const fraction = width.get() > 0 ? Math.min(1, Math.max(0, e.x / width.get())) : 0;
      value.set(fraction);
      scheduleOnRN(apply, fraction);
    })
    .onUpdate((e) => {
      const fraction = width.get() > 0 ? Math.min(1, Math.max(0, e.x / width.get())) : 0;
      value.set(fraction);
      scheduleOnRN(apply, fraction);
    })
    .onFinalize(() => {
      dragging.set(false);
    });

  const fillStyle = useAnimatedStyle(() => ({ width: `${value.get() * 100}%` }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: value.get() * width.get() - THUMB_SIZE / 2 }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={styles.slider}
        onLayout={(e: LayoutChangeEvent) => {
          width.set(e.nativeEvent.layout.width);
        }}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Volume"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(volume * 100) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          const step = e.nativeEvent.actionName === 'increment' ? 0.1 : -0.1;
          const next = Math.min(1, Math.max(0, volume + step));
          value.set(next);
          apply(next);
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
  },
  slider: {
    flex: 1,
    height: HEIGHT,
    justifyContent: 'center',
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
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
    top: (HEIGHT - THUMB_SIZE) / 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: t.colors.progressFill,
  },
}));
