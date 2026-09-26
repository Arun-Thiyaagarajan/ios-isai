import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Platform, StyleSheet, View, type ViewProps } from 'react-native';

import { useReduceTransparency } from '../a11y';
import { useTheme } from '../theme';

type Variant = 'plain' | 'tonal' | 'glass';

export type SurfaceProps = ViewProps & {
  variant?: Variant;
  /** Lets the glass react to touch (iOS 26+). Use for floating controls. */
  interactive?: boolean;
};

// Evaluated once: the OS version can't change while the app runs.
const liquidGlass = Platform.OS === 'ios' && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

/**
 * Background surface for chrome (mini player, floating controls, headers).
 *
 * `glass` resolves per platform: Liquid Glass on iOS 26+, system blur on older iOS,
 * a solid tonal surface on Android and whenever Reduce Transparency is on.
 * Never use `glass` for content (lists, grids, lyrics). Never animate its opacity to 0.
 */
export function Surface({ variant = 'plain', interactive, style, children, ...rest }: SurfaceProps) {
  const theme = useTheme();
  const reduceTransparency = useReduceTransparency();

  if (variant === 'glass' && !reduceTransparency) {
    if (liquidGlass) {
      return (
        <GlassView
          glassEffectStyle="regular"
          colorScheme={theme.scheme}
          isInteractive={interactive}
          style={style}
          {...rest}
        >
          {children}
        </GlassView>
      );
    }
    if (Platform.OS === 'ios') {
      return (
        <View style={[styles.clip, style]} {...rest}>
          <BlurView
            tint={theme.scheme === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
            style={StyleSheet.absoluteFill}
          />
          {children}
        </View>
      );
    }
  }

  const backgroundColor =
    variant === 'plain'
      ? theme.colors.bg
      : variant === 'tonal'
        ? theme.colors.surface
        : theme.colors.bgElevated;

  return (
    <View style={[{ backgroundColor }, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
});
