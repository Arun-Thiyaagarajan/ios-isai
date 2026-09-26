import { Pressable, View, type PressableProps } from 'react-native';

import type { IconName } from '../icons';
import { makeStyles, useTheme } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';

type Variant = 'primary' | 'secondary';

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  icon?: IconName;
  variant?: Variant;
  /** Stretch to fill the parent's width (e.g. Play / Shuffle pairs). */
  fill?: boolean;
};

export function Button({ label, icon, variant = 'primary', fill, disabled, ...rest }: ButtonProps) {
  const theme = useTheme();
  const styles = useStyles();
  const primary = variant === 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        primary ? styles.primary : styles.secondary,
        fill && styles.fill,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
      {...rest}
    >
      <View style={styles.content}>
        {icon && (
          <Icon
            name={icon}
            size={theme.sizes.icon.md}
            color={primary ? theme.colors.onAccent : theme.colors.accentText}
            weight="semibold"
          />
        )}
        <Text variant="headline" color={primary ? 'onAccent' : 'accent'} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  base: {
    minHeight: t.sizes.touchTarget + t.spacing.xs,
    paddingHorizontal: t.spacing.xl,
    borderRadius: t.radius.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: t.colors.accent,
  },
  secondary: {
    backgroundColor: t.colors.surface,
  },
  fill: {
    flex: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  pressed: {
    opacity: t.motion.pressedOpacity,
  },
  disabled: {
    opacity: 0.4,
  },
}));
