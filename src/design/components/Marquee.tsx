import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion } from '../a11y';
import { Text, type TextProps } from './Text';

/** Scroll speed in points per second: slow enough to read comfortably. */
const SPEED = 32;
/** Pause at the start of every loop, so the beginning of the text can be read. */
const START_PAUSE_MS = 1800;
/** Space between the end of the text and its repeated copy. */
const GAP = 48;

type Props = Omit<TextProps, 'numberOfLines' | 'children'> & { children: string };

/**
 * One line of text that slowly scrolls when it's too long to fit, instead of ending in "…".
 * Short text sits still. With Reduce Motion it never moves and ends in "…".
 */
export function Marquee({ children, style, ...textProps }: Props) {
  const reducedMotion = useReducedMotion();
  const [boxWidth, setBoxWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const offset = useSharedValue(0);

  const overflows = boxWidth > 0 && textWidth > boxWidth + 1;
  const scrolls = overflows && !reducedMotion;

  useEffect(() => {
    cancelAnimation(offset);
    offset.set(0);
    if (!scrolls) {
      return;
    }
    const distance = textWidth + GAP;
    offset.set(
      withRepeat(
        withSequence(
          withDelay(
            START_PAUSE_MS,
            withTiming(-distance, { duration: (distance / SPEED) * 1000, easing: Easing.linear }),
          ),
          // Jump back: the repeated copy is now exactly where the original started.
          withTiming(0, { duration: 0 }),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(offset);
  }, [scrolls, textWidth, children, offset]);

  const animated = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }));

  if (!scrolls) {
    return (
      <View onLayout={(e: LayoutChangeEvent) => setBoxWidth(e.nativeEvent.layout.width)}>
        <Text numberOfLines={1} style={style} {...textProps}>
          {children}
        </Text>
        {/* Measures the full text width without being shown or read out. */}
        <Measure style={style} textProps={textProps} onWidth={setTextWidth}>
          {children}
        </Measure>
      </View>
    );
  }

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setBoxWidth(e.nativeEvent.layout.width)}
      style={styles.clip}
      accessible
      accessibilityRole="text"
      accessibilityLabel={children}
    >
      <Animated.View style={[styles.row, animated]}>
        <Text numberOfLines={1} style={[style, { width: textWidth }]} {...textProps}>
          {children}
        </Text>
        <View style={{ width: GAP }} />
        <Text numberOfLines={1} style={[style, { width: textWidth }]} {...textProps}>
          {children}
        </Text>
      </Animated.View>
      <Measure style={style} textProps={textProps} onWidth={setTextWidth}>
        {children}
      </Measure>
    </View>
  );
}

/** Lays the text out on one unlimited line (inside a non-scrolling horizontal ScrollView) to measure it. */
function Measure({
  children,
  style,
  textProps,
  onWidth,
}: {
  children: string;
  style: TextProps['style'];
  textProps: Omit<TextProps, 'numberOfLines' | 'children' | 'style'>;
  onWidth: (width: number) => void;
}) {
  return (
    <ScrollView
      horizontal
      scrollEnabled={false}
      style={styles.measure}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text
        style={style}
        {...textProps}
        onLayout={(e: LayoutChangeEvent) => onWidth(Math.ceil(e.nativeEvent.layout.width))}
      >
        {children}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
  },
  measure: {
    position: 'absolute',
    opacity: 0,
    height: 0,
    left: 0,
    right: 0,
  },
});
