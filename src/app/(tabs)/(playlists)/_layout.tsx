import { Stack, router } from 'expo-router';

import { headerActions } from '@/features/shell/headerActions';
import { importPlaylistFile } from '@/features/transfer/fileTransfer';
import { stackScreenOptions } from '@/features/shell/stackOptions';
import { TabStackFrame } from '@/features/shell/TabStackFrame';

/** A page restored on launch (or opened from a link) keeps this tab's first page behind it. */
export const unstable_settings = {
  initialRouteName: 'index',
};

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
              {
                icon: 'importFile',
                label: 'Import Playlist',
                onPress: async () => {
                  const id = await importPlaylistFile();
                  if (id !== null) {
                    router.push({ pathname: '/(tabs)/(playlists)/playlist/[id]', params: { id: String(id) } });
                  }
                },
              },
              { icon: 'sort', label: 'View and Sort', onPress: () => router.push({ pathname: '/view-options', params: { list: 'playlists' } }) },
            ]),
          }}
        />
        <Stack.Screen name="favorites" options={{ title: 'Favorites', headerLargeTitle: true }} />
        {/* Title and actions are set by the screen once the playlist loads. */}
        <Stack.Screen name="playlist/[id]" options={{ title: '' }} />
        <Stack.Screen name="smart/[id]" options={{ title: '', headerLargeTitle: true }} />
      </Stack>
    </TabStackFrame>
  );
}
