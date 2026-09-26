import { Stack, router } from 'expo-router';

import { headerActions } from '@/features/shell/headerActions';
import { stackScreenOptions } from '@/features/shell/stackOptions';
import { TabStackFrame } from '@/features/shell/TabStackFrame';

export default function HomeStack() {
  return (
    <TabStackFrame>
      <Stack screenOptions={stackScreenOptions}>
        <Stack.Screen
          name="index"
          options={{
            title: 'Isai',
            headerLargeTitle: true,
            ...headerActions([{ icon: 'settings', label: 'Settings', onPress: () => router.push('/settings') }]),
          }}
        />
        <Stack.Screen name="recent" options={{ title: 'Recently Played', headerLargeTitle: true }} />
        <Stack.Screen name="most-played" options={{ title: 'Most Played', headerLargeTitle: true }} />
        <Stack.Screen name="favorites" options={{ title: 'Favorites', headerLargeTitle: true }} />
        <Stack.Screen name="albums" options={{ title: 'Albums', headerLargeTitle: true }} />
        {/* Titles for these are set by the screens once their data loads. */}
        <Stack.Screen name="album/[id]" options={{ title: '' }} />
        <Stack.Screen name="artist/[id]" options={{ title: '' }} />
        <Stack.Screen name="playlist/[id]" options={{ title: '' }} />
      </Stack>
    </TabStackFrame>
  );
}
