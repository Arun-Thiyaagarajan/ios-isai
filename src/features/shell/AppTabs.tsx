import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Platform } from 'react-native';

import { useTheme } from '@/design';
import { MiniPlayer } from '@/features/player/MiniPlayer';
import { usePlayerStore } from '@/features/player/playerStore';
import { tapHaptic } from '@/lib/haptics';

import { usesTabBarAccessory } from './TabStackFrame';

/**
 * The app's bottom tab bar: Home · Albums · Library · Playlists · Search (five, the most a tab
 * bar should hold). Every tab gets equal width and a one-word label.
 *
 * NativeTabs is still an unstable Expo Router API, so every screen goes through this wrapper.
 * - iOS 26+: the system Liquid Glass bar (and its mini player accessory); outline icons, filled
 *   when selected.
 * - iOS 17–25: the system bar with a translucent blurred material.
 * - Android: Material 3 navigation bar on the theme surface; the selected tab gets the accent and
 *   Material's pill indicator, which slides between tabs natively. Labels are always shown and
 *   slightly smaller, so five fit on a 360dp phone even with large text.
 */
export function AppTabs() {
  const theme = useTheme();
  const android = Platform.OS === 'android';
  const legacyIos = Platform.OS === 'ios' && !usesTabBarAccessory;
  const hasQueue = usePlayerStore((s) => s.queue.items.length > 0);

  return (
    <NativeTabs
      minimizeBehavior="onScrollDown"
      tintColor={theme.colors.accent}
      backgroundColor={android ? theme.colors.navBg : undefined}
      blurEffect={legacyIos ? (theme.scheme === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight') : undefined}
      iconColor={android ? { default: theme.colors.iconSecondary, selected: theme.colors.accentText } : undefined}
      indicatorColor={android ? theme.colors.surfaceHigh : undefined}
      rippleColor={android ? theme.colors.surface : undefined}
      labelVisibilityMode={android ? 'labeled' : undefined}
      labelStyle={
        android
          ? {
              default: { fontSize: 11, color: theme.colors.textSecondary },
              selected: { fontSize: 11, fontWeight: '600', color: theme.colors.accentText },
            }
          : undefined
      }
      screenListeners={{ tabPress: () => tapHaptic() }}
    >
      <NativeTabs.Trigger name="(home)">
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="(albums)">
        <NativeTabs.Trigger.Icon sf={{ default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }} md="album" />
        <NativeTabs.Trigger.Label>Albums</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="(library)">
        <NativeTabs.Trigger.Icon sf={{ default: 'square.stack', selected: 'square.stack.fill' }} md="library_music" />
        <NativeTabs.Trigger.Label>Library</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="(playlists)">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'music.note.list', selected: 'music.note.list' }}
          md="queue_music"
        />
        <NativeTabs.Trigger.Label>Playlists</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      {/* iOS 26: the mini player lives in the tab bar's glass accessory, drawn by the system. */}
      {usesTabBarAccessory && hasQueue ? (
        <NativeTabs.BottomAccessory>
          <MiniPlayer variant="accessory" />
        </NativeTabs.BottomAccessory>
      ) : null}

      {/* role="search" gives the separated trailing search button on iOS 26. */}
      <NativeTabs.Trigger name="(search)" role="search">
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
