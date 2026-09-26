import { Stack, router } from 'expo-router';

import { headerActions } from '@/features/shell/headerActions';
import { stackScreenOptions } from '@/features/shell/stackOptions';
import { TabStackFrame } from '@/features/shell/TabStackFrame';

export default function PlaylistsStack() {
  return (
    <TabStackFrame>
      <Stack screenOptions={stackScreenOptions}>
        <Stack.Screen
          name="index"
          options={{
            title: 'Playlists',
            headerLargeTitle: true,
            ...headerActions([
              { icon: 'playlistNew', label: 'New Playlist', onPress: () => router.push('/playlist-edit') },
            ]),
          }}
        />
        <Stack.Screen name="favorites" options={{ title: 'Favorites', headerLargeTitle: true }} />
        {/* Title and actions are set by the screen once the playlist loads. */}
        <Stack.Screen name="playlist/[id]" options={{ title: '' }} />
      </Stack>
    </TabStackFrame>
  );
}
