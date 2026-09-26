import { Pressable } from 'react-native';
import { useReorderableDrag } from 'react-native-reorderable-list';

import { Icon, useTheme } from '@/design';

/**
 * The ≡ grip on a reorderable row: press and drag it to move the row.
 * Only works inside a `ReorderableList` cell.
 */
export function DragHandle({ label }: { label: string }) {
  const theme = useTheme();
  const drag = useReorderableDrag();
  return (
    <Pressable
      onPressIn={drag}
      hitSlop={8}
      accessibilityLabel={label}
      accessibilityHint="Use the row's actions to move it up or down"
      style={{ width: theme.sizes.touchTarget, height: theme.sizes.touchTarget, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name="dragHandle" size={theme.sizes.icon.md} color={theme.colors.textTertiary} />
    </Pressable>
  );
}
