import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';

import { useReducedMotion, useTheme } from '@/design';
import { tapHaptic } from '@/lib/haptics';

import { togglePlayPause } from '../playerService';

/**
 * The play glyph is the Isai logo's "dot": a triangle with softly rounded corners (the same path
 * and stroke as the brand mark), so the most-pressed button quietly carries the brand.
 */
function PlayGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size * (52 / 46)} viewBox="77 41 46 52">
      <Path d="M81 45L81 89L119 67Z" fill={color} stroke={color} strokeWidth={8} strokeLinejoin="round" />
    </Svg>
  );
}

/** Two bars with the same corner softness as the play triangle. */
function PauseGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size * (52 / 46)} viewBox="0 0 46 52">
      <Rect x={5} y={2} width={13} height={48} rx={4.5} fill={color} />
      <Rect x={28} y={2} width={13} height={48} rx={4.5} fill={color} />
    </Svg>
  );
}

type Props = {
  isPlaying: boolean;
  size: number;
  /** Button fill and glyph color: flat, no gradients. */
  background: string;
  foreground: string;
};

/** Large round play/pause button. The glyph pops in when it changes; a light haptic on press. */
export function PlayPauseButton({ isPlaying, size, background, foreground }: Props) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const pop = useSharedValue(1);
  const press = useSharedValue(1);

  useEffect(() => {
    if (!reducedMotion) {
      pop.set(withSequence(withTiming(0.82, { duration: 70 }), withSpring(1, theme.motion.spring.bouncy)));
    }
  }, [isPlaying, reducedMotion, pop, theme.motion.spring.bouncy]);

  const buttonStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.get() }] }));
  const glyphStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() }] }));

  const glyphSize = Math.round(size * 0.36);

  return (
    <Pressable
      onPress={() => {
        tapHaptic();
        togglePlayPause();
      }}
      onPressIn={() => {
        if (!reducedMotion) press.set(withTiming(0.94, { duration: 90 }));
      }}
      onPressOut={() => {
        press.set(reducedMotion ? 1 : withSpring(1, theme.motion.spring.snappy));
      }}
      accessibilityRole="button"
      accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
    >
      <Animated.View
        style={[
          styles.button,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: background },
          buttonStyle,
        ]}
      >
        {/* The triangle's visual center sits left of its box; nudge it so it looks centered. */}
        <Animated.View style={[glyphStyle, !isPlaying && { marginLeft: glyphSize * 0.12 }]}>
          {isPlaying ? (
            <PauseGlyph size={glyphSize} color={foreground} />
          ) : (
            <PlayGlyph size={glyphSize} color={foreground} />
          )}
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
