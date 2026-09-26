import { Stack } from 'expo-router';

import { stackScreenOptions } from '@/features/shell/stackOptions';
import { TabStackFrame } from '@/features/shell/TabStackFrame';

/** A page restored on launch (or opened from a link) keeps this tab's first page behind it. */
export const unstable_settings = {
  initialRouteName: 'index',
};

export default function SearchStack() {
  return (
    <TabStackFrame>
      <Stack screenOptions={stackScreenOptions}>
        {/* Standard title: the search field sits right under it and must never be covered. */}
        <Stack.Screen name="index" options={{ title: 'Search' }} />
        <Stack.Screen name="songs" options={{ title: 'Songs', headerLargeTitle: true }} />
        <Stack.Screen name="albums" options={{ title: 'Albums', headerLargeTitle: true }} />
        <Stack.Screen name="artists" options={{ title: 'Artists', headerLargeTitle: true }} />
        <Stack.Screen name="genres" options={{ title: 'Genres', headerLargeTitle: true }} />
        {/* Titles for these are set by the screens once their data loads. */}
        <Stack.Screen name="folders" options={{ title: 'Folders' }} />
        <Stack.Screen name="album/[id]" options={{ title: '' }} />
        <Stack.Screen name="artist/[id]" options={{ title: '' }} />
        <Stack.Screen name="genre/[id]" options={{ title: '', headerLargeTitle: true }} />
        <Stack.Screen name="playlist/[id]" options={{ title: '' }} />
      </Stack>
    </TabStackFrame>
  );
}
