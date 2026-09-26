import { useState } from 'react';
import { PanResponder, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { Text, makeStyles, useTheme } from '@/design';
import { formatDuration } from '@/lib/format';

import { seekTo } from './playerService';
import { useProgress } from './useProgress';

/** Taller touch area than the visible track, so it's easy to grab. */
const TOUCH_HEIGHT = 32;

/**
 * Seek bar: tap anywhere or drag to seek. While dragging, the bar follows the finger and the
 * times show the target; the engine only seeks when the finger lifts.
 */
export function ProgressBar() {
  const theme = useTheme();
  const local = useStyles();
  const { positionMs, durationMs } = useProgress();
  const [width, setWidth] = useState(0);
  const [dragFraction, setDragFraction] = useState<number | null>(null);

  // Handlers only use the finger's position, so rebuilding them each render is safe mid-drag.
  const fractionAt = (x: number) => (width > 0 ? Math.min(1, Math.max(0, x / width)) : 0);
  const responder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    // Keep the gesture even if the sheet around it would like to take over.
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (event) => setDragFraction(fractionAt(event.nativeEvent.locationX)),
    onPanResponderMove: (event) => setDragFraction(fractionAt(event.nativeEvent.locationX)),
    onPanResponderRelease: (event) => {
      const fraction = fractionAt(event.nativeEvent.locationX);
      setDragFraction(null);
      if (durationMs > 0) {
        seekTo(fraction * durationMs);
      }
    },
    onPanResponderTerminate: () => setDragFraction(null),
  });

  const liveFraction = durationMs > 0 ? Math.min(1, positionMs / durationMs) : 0;
  const fraction = dragFraction ?? liveFraction;
  const shownMs = dragFraction !== null ? dragFraction * durationMs : positionMs;
  const dragging = dragFraction !== null;
  const trackHeight = dragging ? 8 : 4;

  return (
    <View>
      <View
        {...responder.panHandlers}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        style={local.touch}
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
        <View
          style={[
            styles.track,
            { height: trackHeight, borderRadius: trackHeight / 2, backgroundColor: theme.colors.progressTrack },
          ]}
        >
          <View
            style={[
              styles.fill,
              { width: `${fraction * 100}%`, backgroundColor: theme.colors.progressFill },
            ]}
          />
        </View>
      </View>
      <View style={local.times}>
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
  times: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: -t.spacing.xs,
  },
}));

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});
