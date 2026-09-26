import { isLibraryAvailable } from '@modules/isai-library';
import { Stack } from 'expo-router';
import { Platform } from 'react-native';

import { addMusicFolder } from '@/features/library/scanService';
import { headerActions } from '@/features/shell/headerActions';
import { stackScreenOptions } from '@/features/shell/stackOptions';
import { TabStackFrame } from '@/features/shell/TabStackFrame';

// On iOS, music comes from folders the user picks; Android reads the whole device automatically.
const canAddFolders = Platform.OS === 'ios' && isLibraryAvailable;

/** A page restored on launch (or opened from a link) keeps this tab's first page behind it. */
export const unstable_settings = {
  initialRouteName: 'index',
};

export default function LibraryStack() {
  return (
    <TabStackFrame>
      <Stack screenOptions={stackScreenOptions}>
        <Stack.Screen
          name="index"
          options={{
            title: 'Library',
            headerLargeTitle: true,
            ...headerActions(
              canAddFolders ? [{ icon: 'folderAdd', label: 'Add Music Folder', onPress: addMusicFolder }] : [],
            ),
          }}
        />
        <Stack.Screen name="songs" options={{ title: 'Songs', headerLargeTitle: true }} />
        <Stack.Screen name="albums" options={{ title: 'Albums', headerLargeTitle: true }} />
        <Stack.Screen name="artists" options={{ title: 'Artists', headerLargeTitle: true }} />
        <Stack.Screen name="genres" options={{ title: 'Genres', headerLargeTitle: true }} />
        {/* Titles for these are set by the screens once their data loads. */}
        <Stack.Screen name="folders" options={{ title: 'Folders' }} />
        <Stack.Screen name="album/[id]" options={{ title: '' }} />
        <Stack.Screen name="artist/[id]" options={{ title: '' }} />
        <Stack.Screen name="genre/[id]" options={{ title: '', headerLargeTitle: true }} />
      </Stack>
    </TabStackFrame>
  );
}
