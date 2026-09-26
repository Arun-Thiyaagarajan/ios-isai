import { Stack } from 'expo-router';

import { stackScreenOptions } from '@/features/shell/stackOptions';
import { TabStackFrame } from '@/features/shell/TabStackFrame';

export default function SearchStack() {
  return (
    <TabStackFrame>
      <Stack screenOptions={stackScreenOptions}>
        <Stack.Screen name="index" options={{ title: 'Search', headerLargeTitle: true }} />
      </Stack>
    </TabStackFrame>
  );
}
