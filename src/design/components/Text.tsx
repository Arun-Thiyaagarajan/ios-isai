import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { useTheme } from '../theme';
import type { ColorPalette, TypeRoleName } from '../tokens';

export type TextColor = 'primary' | 'secondary' | 'tertiary' | 'accent' | 'onAccent' | 'danger';

const colorKey: Record<TextColor, keyof ColorPalette> = {
  primary: 'textPrimary',
  secondary: 'textSecondary',
  tertiary: 'textTertiary',
  accent: 'accentText',
  onAccent: 'onAccent',
  danger: 'danger',
};

export type TextProps = RNTextProps & {
  variant?: TypeRoleName;
  color?: TextColor;
  /** Fixed-width digits so times and counters don't jitter. */
  tabular?: boolean;
  align?: 'auto' | 'left' | 'center' | 'right';
};

/** The only text component screens should use. Size comes from a type variant, never a raw number. */
export function Text({
  variant = 'body',
  color = 'primary',
  tabular = false,
  align,
  style,
  ...rest
}: TextProps) {
  const theme = useTheme();
  const { maxScale, ...type } = theme.typography[variant];

  return (
    <RNText
      maxFontSizeMultiplier={maxScale}
      style={[
        type,
        { color: theme.colors[colorKey[color]] },
        tabular && { fontVariant: ['tabular-nums'] },
        align && { textAlign: align },
        style,
      ]}
      {...rest}
    />
  );
}
