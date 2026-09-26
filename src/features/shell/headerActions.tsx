import type { Stack } from 'expo-router';
import type { ComponentProps } from 'react';
import { Platform, View } from 'react-native';

import { IconButton, makeStyles, type IconName } from '@/design';
import { icons } from '@/design/icons';

type ScreenOptions = NonNullable<ComponentProps<typeof Stack.Screen>['options']>;

export type HeaderAction = {
  icon: IconName;
  /** Spoken by screen readers; also the native item's title. */
  label: string;
  onPress: () => void;
};

function AndroidActions({ actions }: { actions: HeaderAction[] }) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      {actions.map((action) => (
        <IconButton key={action.label} icon={action.icon} label={action.label} onPress={action.onPress} />
      ))}
    </View>
  );
}

/**
 * Header buttons for a screen, always vertically centered:
 * - iOS: native bar button items with SF Symbols, so the system lays them out (Liquid Glass on iOS 26).
 * - Android: icon buttons in a centered row.
 */
export function headerActions(actions: HeaderAction[]): ScreenOptions {
  if (actions.length === 0) {
    return {};
  }
  if (Platform.OS === 'ios') {
    return {
      unstable_headerRightItems: () =>
        actions.map((action) => ({
          type: 'button' as const,
          label: action.label,
          accessibilityLabel: action.label,
          icon: { type: 'sfSymbol' as const, name: icons[action.icon].ios },
          onPress: action.onPress,
        })),
    };
  }
  return { headerRight: () => <AndroidActions actions={actions} /> };
}

const useStyles = makeStyles(() => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
