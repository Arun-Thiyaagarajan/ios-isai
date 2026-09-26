import { Stack, router } from 'expo-router';
import { Platform } from 'react-native';

import { HomeHeaderTitle } from '@/features/home/HomeBrandHeader';
import { ProfileAvatar } from '@/features/profile/ProfileAvatar';
import { stackScreenOptions } from '@/features/shell/stackOptions';
import { TabStackFrame } from '@/features/shell/TabStackFrame';

const profileButton = <ProfileAvatar size={36} onPress={() => router.push('/profile')} />;

/** A page restored on launch (or opened from a link) keeps this tab's first page behind it. */
export const unstable_settings = {
  initialRouteName: 'index',
};

export default function HomeStack() {
  return (
    <TabStackFrame>
      <Stack screenOptions={stackScreenOptions}>
        <Stack.Screen
          name="index"
          options={{
            title: 'Isai',
            // Home draws its own large brand header (logo + wordmark) that hands over to this
            // small one as you scroll, so the native large title is off here.
            headerLargeTitle: false,
            headerTitle: () => <HomeHeaderTitle />,
            // Profile and settings live behind the avatar. On iOS it's a native header item without
            // the shared glass background, so the round avatar isn't boxed in a glass bubble.
            ...(Platform.OS === 'ios'
              ? {
                  unstable_headerRightItems: () => [
                    { type: 'custom' as const, element: profileButton, hidesSharedBackground: true },
                  ],
                }
              : { headerRight: () => profileButton }),
          }}
        />
        <Stack.Screen name="recent" options={{ title: 'Recently Played', headerLargeTitle: true }} />
        <Stack.Screen name="most-played" options={{ title: 'Most Played', headerLargeTitle: true }} />
        <Stack.Screen name="favorites" options={{ title: 'Favorites', headerLargeTitle: true }} />
        <Stack.Screen name="stats" options={{ title: 'Your Listening', headerLargeTitle: true }} />
        <Stack.Screen name="albums" options={{ title: 'Albums', headerLargeTitle: true }} />
        {/* Titles for these are set by the screens once their data loads. */}
        <Stack.Screen name="album/[id]" options={{ title: '' }} />
        <Stack.Screen name="artist/[id]" options={{ title: '' }} />
        <Stack.Screen name="playlist/[id]" options={{ title: '' }} />
      </Stack>
    </TabStackFrame>
  );
}
