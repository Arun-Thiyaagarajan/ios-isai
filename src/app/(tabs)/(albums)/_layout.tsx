import { Stack } from 'expo-router';

import { stackScreenOptions } from '@/features/shell/stackOptions';
import { TabStackFrame } from '@/features/shell/TabStackFrame';

export default function AlbumsStack() {
  return (
    <TabStackFrame>
      <Stack screenOptions={stackScreenOptions}>
        <Stack.Screen name="index" options={{ title: 'Albums', headerLargeTitle: true }} />
        {/* Titles for these are set by the screens once their data loads. */}
        <Stack.Screen name="album/[id]" options={{ title: '' }} />
        <Stack.Screen name="artist/[id]" options={{ title: '' }} />
      </Stack>
    </TabStackFrame>
  );
}
