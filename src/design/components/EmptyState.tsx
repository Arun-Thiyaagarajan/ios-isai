import { View } from 'react-native';

import type { IconName } from '../icons';
import { makeStyles, useTheme } from '../theme';
import { Button } from './Button';
import { Icon } from './Icon';
import { Text } from './Text';

export type EmptyStateProps = {
  icon: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ icon, title, message, actionLabel, onAction }: EmptyStateProps) {
  const theme = useTheme();
  const styles = useStyles();

  return (
    <View style={styles.container}>
      <Icon name={icon} size={48} color={theme.colors.textTertiary} weight="regular" />
      <Text variant="title2" align="center" accessibilityRole="header">
        {title}
      </Text>
      {message ? (
        <Text variant="subhead" color="secondary" align="center">
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <Button label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.sm,
    paddingHorizontal: t.spacing.xxxl,
    paddingVertical: t.spacing.giant,
  },
  action: {
    marginTop: t.spacing.lg,
  },
}));
