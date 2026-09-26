import { SymbolView, type SymbolWeight } from 'expo-symbols';
import type { ColorValue } from 'react-native';

import { icons, type IconName } from '../icons';
import { useTheme } from '../theme';

export type IconProps = {
  name: IconName;
  size?: number;
  /** Defaults to the primary text color. */
  color?: ColorValue;
  /** iOS weight; match the weight of adjacent text. */
  weight?: SymbolWeight;
};

/**
 * Platform-native icon: SF Symbol on iOS, Material Symbol on Android.
 * Decorative by default; give the surrounding control the accessibility label.
 */
export function Icon({ name, size, color, weight = 'medium' }: IconProps) {
  const theme = useTheme();
  const glyph = icons[name];

  return (
    <SymbolView
      name={{ ios: glyph.ios, android: glyph.android, web: glyph.android }}
      size={size ?? theme.sizes.icon.lg}
      tintColor={color ?? theme.colors.textPrimary}
      weight={weight}
      type="monochrome"
      accessible={false}
      importantForAccessibility="no"
    />
  );
}
