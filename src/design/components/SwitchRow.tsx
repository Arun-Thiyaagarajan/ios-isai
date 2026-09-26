import type { ReactNode } from 'react';
import { Switch } from 'react-native';

import { useTheme } from '../theme';
import { ListRow } from './ListRow';

export type SwitchRowProps = {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
};

/** A settings row with an on/off switch. The whole row is tappable and reads as one switch. */
export function SwitchRow({ title, subtitle, leading, value, onValueChange, disabled }: SwitchRowProps) {
  const theme = useTheme();

  return (
    <ListRow
      title={title}
      subtitle={subtitle}
      leading={leading}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      trailing={
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{ true: theme.colors.accent }}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      }
    />
  );
}
