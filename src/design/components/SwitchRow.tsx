import type { ReactNode } from 'react';

import { ListRow } from './ListRow';
import { Toggle } from './Toggle';

export type SwitchRowProps = {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
};

/**
 * A settings row with an on/off switch. The whole row is tappable and reads as one switch.
 * The toggle sits in the row's trailing slot, so its right edge lines up with every other
 * row's trailing content (chevrons, counts) and it stays vertically centered when text wraps.
 */
export function SwitchRow({ title, subtitle, leading, value, onValueChange, disabled }: SwitchRowProps) {
  return (
    <ListRow
      title={title}
      subtitle={subtitle}
      leading={leading}
      subtitleLines={2}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      trailing={<Toggle value={value} onValueChange={onValueChange} disabled={disabled} decorative />}
    />
  );
}
