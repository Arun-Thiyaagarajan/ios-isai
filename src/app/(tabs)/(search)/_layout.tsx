import { Stack } from 'expo-router';

import { stackScreenOptions } from '@/features/shell/stackOptions';

export default function SearchStack() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="index" options={{ title: 'Search', headerLargeTitle: true }} />
    </Stack>
  );
}
