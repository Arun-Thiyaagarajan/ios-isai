import { forwardRef } from 'react';
import { Platform, Pressable, TextInput, type TextInputProps } from 'react-native';

import { makeStyles, useTheme } from '../theme';
import { Icon } from './Icon';
import { Surface } from './Surface';

type Props = Omit<TextInputProps, 'style'> & {
  value: string;
  onChangeText: (text: string) => void;
};

/**
 * Search field with a magnifying glass and a clear button once there's text.
 * iOS: a Liquid Glass capsule (frosted blur before iOS 26). Android: a tonal Material field.
 */
export const SearchField = forwardRef<TextInput, Props>(function SearchField({ value, onChangeText, ...rest }, ref) {
  const theme = useTheme();
  const styles = useStyles();

  return (
    <Surface
      variant={Platform.OS === 'ios' ? 'glass' : 'tonal'}
      interactive
      style={[styles.field, Platform.OS === 'ios' ? styles.capsule : styles.rounded]}
    >
      <Icon name="search" size={theme.sizes.icon.md} color={theme.colors.textTertiary} />
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={theme.colors.textTertiary}
        selectionColor={theme.colors.accent}
        keyboardAppearance={theme.scheme}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="never"
        maxFontSizeMultiplier={theme.typography.body.maxScale}
        accessibilityRole="search"
        style={styles.input}
        {...rest}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText('')}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={10}
          style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
        >
          <Icon name="clear" size={theme.sizes.icon.md} color={theme.colors.textTertiary} />
        </Pressable>
      ) : null}
    </Surface>
  );
});

const useStyles = makeStyles((t) => ({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    height: t.sizes.touchTarget,
    paddingHorizontal: t.spacing.md,
    overflow: 'hidden',
  },
  capsule: {
    borderRadius: t.sizes.touchTarget / 2,
  },
  rounded: {
    borderRadius: t.radius.md,
    borderCurve: 'continuous',
  },
  input: {
    flex: 1,
    height: '100%',
    paddingVertical: 0,
    textAlignVertical: 'center',
    color: t.colors.textPrimary,
    fontSize: t.typography.body.fontSize,
  },
  clear: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: t.motion.pressedOpacity,
  },
}));
