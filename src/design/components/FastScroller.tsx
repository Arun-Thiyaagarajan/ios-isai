import { useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { makeStyles } from '../theme';
import { Text } from './Text';

type Props = {
  /** Letters in list order (only the ones that appear in the list). */
  letters: string[];
  /** Called when the finger lands on a new letter. */
  onSelect: (letter: string) => void;
  /** Called on every letter change, e.g. for a haptic tick. */
  onTick?: () => void;
};

/**
 * The A–Z rail on the right edge of long lists. Tap a letter or slide along the rail; a bubble
 * shows the letter under the finger.
 */
export function FastScroller({ letters, onSelect, onTick }: Props) {
  const styles = useStyles();
  const [active, setActive] = useState<string | null>(null);
  const height = useSharedValue(0);
  const last = useSharedValue(-1);

  const choose = (index: number) => {
    const letter = letters[index];
    if (!letter) return;
    setActive(letter);
    onTick?.();
    onSelect(letter);
  };

  const gesture = useMemo(() => {
    const pick = (y: number) => {
      'worklet';
      if (height.get() <= 0 || letters.length === 0) return;
      const index = Math.min(letters.length - 1, Math.max(0, Math.floor((y / height.get()) * letters.length)));
      if (index !== last.get()) {
        last.set(index);
        scheduleOnRN(choose, index);
      }
    };
    return Gesture.Pan()
      .minDistance(0)
      .shouldCancelWhenOutside(false)
      .onBegin((e) => pick(e.y))
      .onUpdate((e) => pick(e.y))
      .onFinalize(() => {
        last.set(-1);
        scheduleOnRN(setActive, null);
      });
    // `choose` changes with `letters`; rebuild the gesture only then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letters, height, last]);

  if (letters.length < 2) {
    return null;
  }

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      {active ? (
        <View style={styles.bubble} pointerEvents="none">
          <Text variant="title1" color="onAccent">
            {active}
          </Text>
        </View>
      ) : null}
      <GestureDetector gesture={gesture}>
        <View
          style={styles.rail}
          onLayout={(e: LayoutChangeEvent) => {
            height.set(e.nativeEvent.layout.height);
          }}
          accessibilityRole="adjustable"
          accessibilityLabel="Jump to letter"
          accessibilityValue={{ text: active ?? letters[0] }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => {
            const current = Math.max(0, letters.indexOf(active ?? letters[0]));
            const next = e.nativeEvent.actionName === 'increment' ? current + 1 : current - 1;
            choose(Math.min(letters.length - 1, Math.max(0, next)));
          }}
        >
          {letters.map((letter) => (
            <Text key={letter} variant="caption" color="accent" style={styles.letter} maxFontSizeMultiplier={1.2}>
              {letter}
            </Text>
          ))}
        </View>
      </GestureDetector>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  rail: {
    paddingVertical: t.spacing.sm,
    paddingHorizontal: t.spacing.xs,
    alignItems: 'center',
    minWidth: 24,
  },
  letter: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  bubble: {
    position: 'absolute',
    right: 44,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.accent,
  },
}));
