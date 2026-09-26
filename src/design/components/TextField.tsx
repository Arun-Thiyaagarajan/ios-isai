import { forwardRef } from 'react';
import { TextInput, type TextInputProps } from 'react-native';

import { makeStyles, useTheme } from '../theme';

/** Single-line text input in the current theme. */
export const TextField = forwardRef<TextInput, TextInputProps>(function TextField({ style, ...rest }, ref) {
  const theme = useTheme();
  const styles = useStyles();
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={theme.colors.textTertiary}
      selectionColor={theme.colors.accent}
      keyboardAppearance={theme.scheme}
      maxFontSizeMultiplier={theme.typography.body.maxScale}
      style={[styles.input, style]}
      {...rest}
    />
  );
});

const useStyles = makeStyles((t) => ({
  input: {
    height: t.sizes.touchTarget + t.spacing.xs,
    paddingHorizontal: t.spacing.lg,
    // Keep text and placeholder vertically centered on both platforms.
    paddingVertical: 0,
    textAlignVertical: 'center',
    borderRadius: t.radius.md,
    borderCurve: 'continuous',
    backgroundColor: t.colors.surface,
    color: t.colors.textPrimary,
    fontSize: t.typography.body.fontSize,
  },
}));
