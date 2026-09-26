import { Stack } from 'expo-router';

import { stackScreenOptions } from '@/features/shell/stackOptions';

export default function PlaylistsStack() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="index" options={{ title: 'Playlists', headerLargeTitle: true }} />
    </Stack>
  );
}
