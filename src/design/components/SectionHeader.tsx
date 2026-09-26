import { Pressable, View } from 'react-native';

import { makeStyles } from '../theme';
import { Text } from './Text';

export type SectionHeaderProps = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function SectionHeader({ title, actionLabel = 'See All', onAction }: SectionHeaderProps) {
  const styles = useStyles();

  return (
    <View style={styles.row}>
      <Text variant="title2" accessibilityRole="header" numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      {onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${actionLabel}, ${title}`}
          onPress={onAction}
          hitSlop={12}
        >
          {({ pressed }) => (
            <Text variant="callout" color="accent" style={pressed && styles.pressed}>
              {actionLabel}
            </Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: t.spacing.md,
    paddingHorizontal: t.gutter,
    paddingTop: t.spacing.xxl,
    paddingBottom: t.spacing.sm,
  },
  title: {
    flexShrink: 1,
  },
  pressed: {
    opacity: t.motion.pressedOpacity,
  },
}));
