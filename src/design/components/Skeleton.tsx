import { useEffect, useState } from 'react';
import { Animated, type DimensionValue } from 'react-native';

import { useReducedMotion } from '../a11y';
import { useTheme } from '../theme';

export type SkeletonProps = {
  width: DimensionValue;
  height: number;
  radius?: number;
};

/** Loading placeholder with a slow pulse (static when Reduce Motion is on). */
export function Skeleton({ width, height, radius }: SkeletonProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(1);
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.5, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity, reducedMotion]);

  return (
    <Animated.View
      accessible={false}
      style={{
        width,
        height,
        borderRadius: radius ?? theme.radius.sm,
        backgroundColor: theme.colors.skeleton,
        opacity,
      }}
    />
  );
}
