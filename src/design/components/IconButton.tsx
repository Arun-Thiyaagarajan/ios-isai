import { Pressable, type PressableProps } from 'react-native';

import type { IconName } from '../icons';
import { makeStyles, useTheme } from '../theme';
import { Icon } from './Icon';

type Variant = 'plain' | 'tonal' | 'filled';

export type IconButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  icon: IconName;
  /** Required: spoken by VoiceOver/TalkBack, e.g. "Play" or "Add to queue". */
  label: string;
  variant?: Variant;
  /** Visual size of the button; the touch area is never smaller than the minimum target. */
  size?: number;
  iconSize?: number;
  selected?: boolean;
};

export function IconButton({
  icon,
  label,
  variant = 'plain',
  size,
  iconSize,
  selected,
  disabled,
  ...rest
}: IconButtonProps) {
  const theme = useTheme();
  const styles = useStyles();
  const box = size ?? theme.sizes.touchTarget;
  // Grow the hit area to the minimum target without changing the layout.
  const slop = Math.max(0, (theme.sizes.touchTarget - box) / 2);

  const iconColor =
    variant === 'filled'
      ? theme.colors.onAccent
      : selected
        ? theme.colors.accent
        : theme.colors.textPrimary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, selected }}
      hitSlop={slop}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        { width: box, height: box, borderRadius: box / 2 },
        variant === 'tonal' && styles.tonal,
        variant === 'filled' && styles.filled,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
      {...rest}
    >
      <Icon name={icon} size={iconSize ?? theme.sizes.icon.lg} color={iconColor} />
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tonal: {
    backgroundColor: t.colors.surface,
  },
  filled: {
    backgroundColor: t.colors.accent,
  },
  pressed: {
    opacity: t.motion.pressedOpacity,
    transform: [{ scale: t.motion.pressedScale }],
  },
  disabled: {
    opacity: 0.35,
  },
}));
