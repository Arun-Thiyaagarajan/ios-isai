import { memo, type ReactNode } from 'react';
import { Pressable, View, type PressableProps } from 'react-native';

import { makeStyles } from '../theme';
import { Text } from './Text';

export type ListRowProps = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  subtitle?: string;
  /** Artwork, icon or track number. */
  leading?: ReactNode;
  /** Duration, chevron or a "more" button. */
  trailing?: ReactNode;
  /** Highlights the row (e.g. the song that is playing). */
  active?: boolean;
};

/**
 * Standard one- or two-line row with a fixed height, so long lists can skip measuring.
 * Long titles truncate to one line; the full text is still read by screen readers.
 */
export const ListRow = memo(function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  active,
  accessibilityLabel,
  ...rest
}: ListRowProps) {
  const styles = useStyles();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? [title, subtitle].filter(Boolean).join(', ')}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      {...rest}
    >
      {leading}
      <View style={styles.text}>
        <Text variant="body" color={active ? 'accent' : 'primary'} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="subhead" color="secondary" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </Pressable>
  );
});

const useStyles = makeStyles((t) => ({
  row: {
    minHeight: t.sizes.listRow,
    paddingHorizontal: t.gutter,
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
  },
  pressed: {
    backgroundColor: t.colors.surfaceHigh,
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: t.spacing.xxs,
  },
}));
