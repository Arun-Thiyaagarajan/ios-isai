import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  makeMutable,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { IsaiLogoDot, IsaiLogoStem, ISAI_GLYPH_ASPECT, Text, makeStyles, useReducedMotion, useTheme } from '@/design';

/**
 * How far Home has scrolled (0 = at the top, negative = pulled down). Shared by the big in-page
 * brand header and the small one in the navigation bar, so they can hand over to each other.
 */
export const homeScroll = makeMutable(0);

/** Scroll distance over which the big header fades out and the bar title fades in. */
const COLLAPSE = 72;

const BIG_LOGO = 26;
const SMALL_LOGO = 13;

/** Centre of the play-button dot within the glyph (fractions of its box, from the logo's viewBox). */
const DOT_CENTER = { x: (95 - 73) / 54, y: (67 - 37) / 126 };

/** The Isai glyph in the theme's accent; the play-button dot can be animated separately. */
function Glyph({ width, dotStyle }: { width: number; dotStyle?: object }) {
  const theme = useTheme();
  const height = width / ISAI_GLYPH_ASPECT;
  // Scale the dot around its own centre (numbers: React Native can't parse long % strings here).
  const origin: [number, number, number] = [
    Math.round(DOT_CENTER.x * width * 100) / 100,
    Math.round(DOT_CENTER.y * height * 100) / 100,
    0,
  ];
  return (
    <View style={{ width, height }}>
      <View style={{ position: 'absolute' }}>
        <IsaiLogoStem width={width} color={theme.colors.accent} />
      </View>
      <Animated.View style={[{ position: 'absolute', transformOrigin: origin }, dotStyle]}>
        <IsaiLogoDot width={width} color={theme.colors.accent} />
      </Animated.View>
    </View>
  );
}

/**
 * The big "Isai" wordmark at the top of Home. It arrives with a soft rise and the logo's play dot
 * gives a little "play" pulse; while scrolling it lifts, shrinks and fades as the bar title takes
 * over; pulled down, it grows slightly. Reduce Motion keeps only the fades.
 */
export function HomeBrandHeader() {
  const styles = useStyles();
  const reducedMotion = useReducedMotion();
  const appear = useSharedValue(reducedMotion ? 1 : 0);
  const dot = useSharedValue(1);

  useEffect(() => {
    if (reducedMotion) {
      appear.set(1);
      return;
    }
    appear.set(withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }));
    dot.set(withDelay(380, withSequence(withTiming(1.22, { duration: 160 }), withSpring(1, { damping: 7, stiffness: 260 }))));
  }, [appear, dot, reducedMotion]);

  const headerStyle = useAnimatedStyle(() => {
    const y = homeScroll.get();
    const collapse = interpolate(y, [0, COLLAPSE], [0, 1], 'clamp');
    // Pulling down past the top: grow a little, anchored at the left edge.
    const stretch = reducedMotion ? 1 : interpolate(y, [-140, 0], [1.12, 1], 'clamp');
    return {
      opacity: appear.get() * (1 - collapse),
      transform: [
        { translateY: (1 - appear.get()) * 14 + (reducedMotion ? 0 : Math.max(0, y) * 0.35) },
        { scale: reducedMotion ? 1 : stretch * (1 - collapse * 0.08) },
      ],
    };
  });

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dot.get() }],
  }));

  return (
    <Animated.View style={[styles.row, headerStyle]} accessibilityRole="header" accessible accessibilityLabel="Isai">
      <Glyph width={BIG_LOGO} dotStyle={dotStyle} />
      <Text variant="display" style={styles.wordmark} maxFontSizeMultiplier={1.2}>
        Isai
      </Text>
    </Animated.View>
  );
}

/** The navigation bar's title: a small logo and "Isai", shown once the big header scrolls away. */
export function HomeHeaderTitle() {
  const styles = useStyles();
  const style = useAnimatedStyle(() => {
    const t = interpolate(homeScroll.get(), [COLLAPSE * 0.6, COLLAPSE], [0, 1], 'clamp');
    return { opacity: t, transform: [{ translateY: (1 - t) * 6 }] };
  });
  return (
    <Animated.View style={[styles.smallRow, style]} accessible accessibilityRole="header" accessibilityLabel="Isai">
      <Glyph width={SMALL_LOGO} />
      <Text variant="headline" maxFontSizeMultiplier={1.2}>
        Isai
      </Text>
    </Animated.View>
  );
}

const useStyles = makeStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    // Grow from the left edge when pulled down, like a large title.
    transformOrigin: 'left',
  },
  wordmark: {
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  smallRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs + 2,
  },
}));
