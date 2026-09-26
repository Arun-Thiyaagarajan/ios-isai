import type { Stack } from 'expo-router';
import type { ComponentProps } from 'react';

type StackScreenOptions = NonNullable<ComponentProps<typeof Stack>['screenOptions']>;

/**
 * Options shared by every Stack in the app.
 * Back buttons are icon-only everywhere (iOS otherwise shows the previous title or "Back";
 * Android is icon-only by default).
 */
export const stackScreenOptions = {
  headerBackButtonDisplayMode: 'minimal',
} satisfies StackScreenOptions;
