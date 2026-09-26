import { QueryClientProvider } from '@tanstack/react-query';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { db } from '@/db/client';
import { queryClient } from '@/db/queryClient';
import { EmptyState, ThemeProvider, useTheme } from '@/design';
import { scanLibrary } from '@/features/library/scanService';
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
      </Stack>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
    </>
  );
}

/** Rendered only after migrations succeed, so settings can be read synchronously. */
function App() {
  // Load saved settings once, before the first themed frame.
  useState(() => useSettings.getState().hydrate(db));
  const themePreference = useSettings((s) => s.themePreference);
  const oledBlack = useSettings((s) => s.oledBlack);

  // Pick up added, changed or deleted music files once per launch (fast when nothing changed).
  useEffect(() => {
    if (useSettings.getState().autoScan) {
      scanLibrary();
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider preference={themePreference} oledBlack={oledBlack}>
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
