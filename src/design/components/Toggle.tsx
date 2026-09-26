import { useEffect, useState } from 'react';
import { Animated, Pressable } from 'react-native';

import { useReducedMotion } from '../a11y';
import { makeStyles, useTheme } from '../theme';

/** Classic iOS switch proportions. */
const TRACK_WIDTH = 51;
const TRACK_HEIGHT = 31;
const KNOB_INSET = 2;
const KNOB_SIZE = TRACK_HEIGHT - KNOB_INSET * 2;
const TRAVEL = TRACK_WIDTH - KNOB_SIZE - KNOB_INSET * 2;

export type ToggleProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  /** Screen-reader label when the toggle isn't inside a labelled row. */
  accessibilityLabel?: string;
  /** Hide from screen readers when the surrounding row already acts as the switch. */
  decorative?: boolean;
};

/**
 * On/off switch with a fixed, exactly measured size, so it lines up identically in every row
 * (the system switch changed size on iOS 26 and no longer matched its layout box).
 */
export function Toggle({ value, onValueChange, disabled, accessibilityLabel, decorative }: ToggleProps) {
  const theme = useTheme();
  const styles = useStyles();
  const reducedMotion = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(value ? 1 : 0));

  useEffect(() => {
    const target = value ? 1 : 0;
    if (reducedMotion) {
      progress.setValue(target);
      return;
    }
    Animated.spring(progress, { toValue: target, useNativeDriver: false, bounciness: 2, speed: 20 }).start();
  }, [value, reducedMotion, progress]);

  const trackColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.surfaceHigh, theme.colors.accent],
  });
  // Off: a light knob (off-white in dark themes); on: the color made for sitting on the accent,
  // so the knob stays visible even when the accent itself is light (Isai Dark).
  const knobColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.scheme === 'dark' ? theme.colors.textPrimary : theme.colors.bgElevated, theme.colors.onAccent],
  });
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, TRAVEL] });

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      hitSlop={8}
      accessible={!decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}
      accessibilityElementsHidden={decorative}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      style={disabled ? styles.disabled : undefined}
    >
      <Animated.View style={[styles.track, { backgroundColor: trackColor }]}>
        <Animated.View style={[styles.knob, { backgroundColor: knobColor, transform: [{ translateX }] }]} />
      </Animated.View>
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    padding: KNOB_INSET,
    justifyContent: 'center',
  },
  knob: {
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    shadowColor: t.colors.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  disabled: {
    opacity: 0.4,
  },
}));
