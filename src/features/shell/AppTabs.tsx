import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Platform } from 'react-native';

import { useTheme } from '@/design';
import { icons } from '@/design/icons';

/**
 * The app's bottom tab bar.
 *
 * NativeTabs is still an unstable Expo Router API, so every screen goes through this wrapper.
 * If the API changes, only this file needs to move (e.g. to JS tabs).
 * On iOS 26+ the native bar renders as Liquid Glass automatically, so no background is set
 * there; Android gets a tonal surface that follows the theme (including OLED black).
 */
export function AppTabs() {
  const theme = useTheme();
  const android = Platform.OS === 'android';

  return (
    <NativeTabs
      minimizeBehavior="onScrollDown"
      tintColor={theme.colors.accent}
      backgroundColor={android ? theme.colors.bgElevated : undefined}
      iconColor={android ? { default: theme.colors.textSecondary, selected: theme.colors.accentText } : undefined}
    >
      <NativeTabs.Trigger name="(home)">
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: icons.home.ios }} md={icons.home.android} />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="(library)">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'square.stack', selected: icons.library.ios }}
          md={icons.library.android}
        />
        <NativeTabs.Trigger.Label>Library</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="(playlists)">
        <NativeTabs.Trigger.Icon sf={icons.playlists.ios} md={icons.playlists.android} />
        <NativeTabs.Trigger.Label>Playlists</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      {/* role="search" gives the separated trailing search button on iOS 26. */}
      <NativeTabs.Trigger name="(search)" role="search">
        <NativeTabs.Trigger.Icon sf={icons.search.ios} md={icons.search.android} />
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
