import { isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MiniPlayer } from '@/features/player/MiniPlayer';

/** iOS 26+ shows the mini player in the native tab bar accessory instead (see AppTabs). */
export const usesTabBarAccessory =
  Platform.OS === 'ios' && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

/** Standard UITabBar height above the home indicator on iOS before 26. */
const IOS_TAB_BAR_HEIGHT = 49;

/**
 * Wraps a tab's stack so the mini player stays visible on every screen of that tab.
 * Android: the tab content ends above the navigation bar, so the player sits at the bottom.
 * Older iOS: content runs under the translucent tab bar, so the player is lifted above it.
 */
export function TabStackFrame({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();

  if (usesTabBarAccessory) {
    return <>{children}</>;
  }

  return (
    <View style={styles.fill}>
      {children}
      <View
        pointerEvents="box-none"
        style={
          Platform.OS === 'ios'
            ? [styles.overlay, { bottom: IOS_TAB_BAR_HEIGHT + insets.bottom }]
            : undefined
        }
      >
        <MiniPlayer />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});
