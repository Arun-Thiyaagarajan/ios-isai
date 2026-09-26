import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';

import { useTheme } from '@/design';

/** Scrollable tab root that plays well with large titles and the (glass) tab bar. */
export function TabScreen({ children }: { children: ReactNode }) {
  const theme = useTheme();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: theme.colors.bg }}
    >
      {children}
    </ScrollView>
  );
}
