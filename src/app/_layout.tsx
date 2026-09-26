import { QueryClientProvider } from '@tanstack/react-query';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { db } from '@/db/client';
import { queryClient } from '@/db/queryClient';
import { ensureSearchIndex } from '@/db/repos/search';
import { EmptyState, ThemeProvider, useTheme } from '@/design';
import { startLibraryWatcher } from '@/features/library/scanService';
import { startPlayer } from '@/features/player/playerService';
import { useSettings } from '@/features/settings/settingsStore';
import { hideSplashNow, SplashIntro } from '@/features/shell/SplashIntro';
import { stackScreenOptions } from '@/features/shell/stackOptions';
import { ToastHost } from '@/features/shell/toast';

import migrations from '../../drizzle/migrations';

function RootStack() {
  const theme = useTheme();

  return (
    <>
      <Stack screenOptions={stackScreenOptions}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="music-folders" options={{ title: 'Music Folders' }} />

        {/* Now Playing slides up over everything; swipe down to close. */}
        <Stack.Screen name="player" options={{ presentation: 'modal', headerShown: false }} />

        {/* Bottom sheets. */}
        <Stack.Screen
          name="profile"
          options={{
            presentation: 'formSheet',
            headerShown: false,
            sheetAllowedDetents: [0.92],
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
          }}
        />
        <Stack.Screen
          name="equalizer"
          options={{
            presentation: 'formSheet',
            headerShown: false,
            sheetAllowedDetents: [0.92],
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
          }}
        />
        <Stack.Screen
          name="sleep-timer"
          options={{
            presentation: 'formSheet',
            headerShown: false,
            sheetAllowedDetents: [0.7, 1],
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
          }}
        />
        <Stack.Screen
          name="view-options"
          options={{
            presentation: 'formSheet',
            headerShown: false,
            sheetAllowedDetents: [0.75, 1],
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
          }}
        />
        <Stack.Screen
          name="appearance"
          options={{
            presentation: 'formSheet',
            headerShown: false,
            sheetAllowedDetents: [0.92],
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
          }}
        />
        <Stack.Screen
          name="queue"
          options={{
            presentation: 'formSheet',
            headerShown: false,
            sheetAllowedDetents: [0.6, 1],
            sheetGrabberVisible: true,
          }}
        />
        <Stack.Screen
          name="song-actions"
          options={{
            presentation: 'formSheet',
            headerShown: false,
            sheetAllowedDetents: [0.6, 1],
            sheetGrabberVisible: true,
          }}
        />
        <Stack.Screen
          name="add-to-playlist"
          options={{
            presentation: 'formSheet',
            headerShown: false,
            sheetAllowedDetents: [0.6, 1],
            sheetGrabberVisible: true,
          }}
        />
        {/* Lyrics fade in over Now Playing, full screen. */}
        <Stack.Screen
          name="lyrics"
          options={{ presentation: 'fullScreenModal', animation: 'fade', headerShown: false }}
        />
        <Stack.Screen
          name="player-theme"
          options={{
            presentation: 'formSheet',
            headerShown: false,
            sheetAllowedDetents: [0.75, 1],
            sheetGrabberVisible: true,
          }}
        />
        <Stack.Screen name="playlist-edit" options={{ presentation: 'modal', title: 'New Playlist' }} />
        <Stack.Screen name="edit-song" options={{ presentation: 'modal', headerShown: false }} />
      </Stack>
      <ToastHost />
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
    </>
  );
}

/** Rendered only after migrations succeed, so settings can be read synchronously. */
function App() {
  // Load saved settings once, before the first themed frame.
  useState(() => useSettings.getState().hydrate(db));
  const themeMode = useSettings((s) => s.themeMode);
  const lightTheme = useSettings((s) => s.lightTheme);
  const darkTheme = useSettings((s) => s.darkTheme);

  // Reconnect to the player with the last queue (paused), and start the one place that decides
  // when the library is scanned automatically.
  useEffect(() => {
    // After an upgrade the search index may be empty until the next scan; fill it now.
    ensureSearchIndex(db);
    startPlayer();
    startLibraryWatcher();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider mode={themeMode} lightTheme={lightTheme} darkTheme={darkTheme}>
          <RootStack />
          {/* Launch animation, on top of the first screen; removes itself when done. */}
          <SplashIntro />
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);

  if (error) {
    hideSplashNow();
    return (
      <ThemeProvider>
        <EmptyState
          icon="warning"
          title="Couldn't open your library"
          message={`The local database failed to update. Please restart Isai.\n\n${error.message}`}
        />
      </ThemeProvider>
    );
  }

  // Migrations take milliseconds; the splash screen covers this frame.
  if (!success) {
    return null;
  }

  return <App />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
