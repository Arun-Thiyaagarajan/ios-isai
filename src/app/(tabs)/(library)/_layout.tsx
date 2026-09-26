import { isLibraryAvailable } from '@modules/isai-library';
import { Stack } from 'expo-router';
import { Platform } from 'react-native';

import { IconButton } from '@/design';
import { addMusicFolder } from '@/features/library/scanService';
import { stackScreenOptions } from '@/features/shell/stackOptions';

// On iOS, music comes from folders the user picks; Android reads the whole device automatically.
const canAddFolders = Platform.OS === 'ios' && isLibraryAvailable;

function AddFolderButton() {
  return <IconButton icon="folderAdd" label="Add Music Folder" onPress={addMusicFolder} />;
}

export default function LibraryStack() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen
        name="index"
        options={{
          title: 'Library',
          headerLargeTitle: true,
          headerRight: canAddFolders ? () => <AddFolderButton /> : undefined,
        }}
      />
    </Stack>
  );
}
