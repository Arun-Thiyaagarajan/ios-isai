import { QueryClientProvider } from '@tanstack/react-query';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { db } from '@/db/client';
import { queryClient } from '@/db/queryClient';
import { EmptyState, ThemeProvider, useTheme } from '@/design';
import { scanLibrary } from '@/features/library/scanService';
import { startPlayer } from '@/features/player/playerService';
import { useSettings } from '@/features/settings/settingsStore';
import { stackScreenOptions } from '@/features/shell/stackOptions';

import migrations from '../../drizzle/migrations';

function RootStack() {
  const theme = useTheme();

  return (
    <>
      <Stack screenOptions={stackScreenOptions}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="dev/gallery" options={{ title: 'Design Gallery' }} />
        <Stack.Screen name="music-folders" options={{ title: 'Music Folders' }} />

        {/* Now Playing slides up over everything; swipe down to close. */}
        <Stack.Screen name="player" options={{ presentation: 'modal', headerShown: false }} />

        {/* Bottom sheets. */}
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
        <Stack.Screen name="playlist-edit" options={{ presentation: 'modal', title: 'New Playlist' }} />
      </Stack>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
    </>
  );
}

/** Rendered only after migrations succeed, so settings can be read synchronously. */
function App() {
  // Load saved settings once, before the first themed frame.
  useState(() => useSettings.getState().hydrate(db));
  const themeName = useSettings((s) => s.theme);
  const matchSystem = useSettings((s) => s.matchSystem);

  // Pick up added, changed or deleted music files once per launch (fast when nothing changed),
  // and reconnect to the player with the last queue (paused).
  useEffect(() => {
    startPlayer();
    if (useSettings.getState().autoScan) {
      scanLibrary();
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider themeName={themeName} matchSystem={matchSystem}>
        <RootStack />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);

  if (error) {
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
