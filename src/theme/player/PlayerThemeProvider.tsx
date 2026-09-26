import { StatusBar } from 'expo-status-bar';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { ThemeScope, useTheme, type Theme } from '@/design';
import type { QueueItem } from '@/features/player/queue';
import { useSettings } from '@/features/settings/settingsStore';

import { withAlpha } from './palette';
import {
  PLAYER_THEMES,
  resolvePlayerTheme,
  sanitizeOptions,
  type BackgroundSpec,
  type PlayerThemeDefinition,
  type PlayerThemeId,
  type PlayerThemeOptions,
  type PlayerTokens,
} from './themes';
import { usePlayerPalette, type PlayerPalette } from './usePlayerPalette';

export type PlayerThemeValue = {
  definition: PlayerThemeDefinition;
  options: PlayerThemeOptions;
  tokens: PlayerTokens;
  background: BackgroundSpec;
  palette: PlayerPalette;
};

const PlayerThemeContext = createContext<PlayerThemeValue | null>(null);
/** The app theme's accent, captured before the player replaces the theme colors. */
const AppAccentContext = createContext<string | null>(null);

/** The app theme's accent, even inside a player (whose own scope replaces the theme colors). */
function useAppAccent(): string {
  const captured = useContext(AppAccentContext);
  const theme = useTheme();
  return captured ?? theme.colors.accent;
}

/** Resolves any theme for the given colors (the picker uses it for its live previews). */
export function useResolvedPlayerTheme(
  id: PlayerThemeId,
  options: PlayerThemeOptions,
  palette: PlayerPalette,
): PlayerThemeValue {
  const systemScheme = useColorScheme() === 'light' ? 'light' : 'dark';
  const themeAccent = useAppAccent();
  return useMemo(() => {
    const resolved = resolvePlayerTheme(id, options, { ...palette, themeAccent }, systemScheme);
    return { definition: PLAYER_THEMES[id], options, palette, ...resolved };
  }, [id, options, palette, systemScheme, themeAccent]);
}

/** App colors replaced by player tokens, so Text, icons and buttons inside the player use them. */
function scopeColors(tokens: PlayerTokens): Partial<Theme['colors']> {
  return {
    playerBg: tokens.background,
    textPrimary: tokens.foreground,
    textSecondary: tokens.secondaryForeground,
    textTertiary: tokens.secondaryForeground,
    icon: tokens.foreground,
    iconSecondary: tokens.secondaryForeground,
    accent: tokens.accent,
    accentText: tokens.accent,
    onAccent: tokens.controlForeground,
    progressTrack: tokens.progressTrack,
    progressFill: tokens.progressFill,
    separator: withAlpha(tokens.foreground.slice(0, 7), 0.14),
    border: withAlpha(tokens.foreground.slice(0, 7), 0.2),
    placeholder: withAlpha(tokens.foreground.slice(0, 7), 0.12),
  };
}

/**
 * Player theme for the song that's playing: the saved theme and options, applied to the song's
 * artwork colors. Everything inside reads colors through `usePlayerTheme()` (or the regular
 * `useTheme()`, whose colors are replaced by the player tokens here).
 */
export function PlayerThemeProvider({
  item,
  themeId,
  children,
}: {
  item: QueueItem | null;
  /** Use this theme instead of the saved one (the mini player always uses Solid). */
  themeId?: PlayerThemeId;
  children: ReactNode;
}) {
  const palette = usePlayerPalette(item);
  const savedId = useSettings((s) => s.playerTheme);
  const id = themeId ?? savedId;
  const storedOptions = useSettings((s) => s.playerThemeOptions);
  const options = useMemo(() => sanitizeOptions(storedOptions), [storedOptions]);
  const appAccent = useAppAccent();
  const value = useResolvedPlayerTheme(id, options, palette);
  const colors = useMemo(() => scopeColors(value.tokens), [value.tokens]);

  return (
    <AppAccentContext.Provider value={appAccent}>
      <PlayerThemeContext.Provider value={value}>
        <ThemeScope themeName={value.tokens.scheme === 'dark' ? 'isaiDark' : 'isaiLight'} colors={colors}>
          {children}
        </ThemeScope>
      </PlayerThemeContext.Provider>
    </AppAccentContext.Provider>
  );
}

/**
 * Status bar content for a full-screen player: light over the (usually dark) player background in
 * every app theme, dark only when the player itself is light (e.g. Isai Mono in light mode).
 */
export function PlayerStatusBar() {
  const { tokens } = usePlayerTheme();
  return <StatusBar style={tokens.scheme === 'dark' ? 'light' : 'dark'} animated />;
}

export function usePlayerTheme(): PlayerThemeValue {
  const value = useContext(PlayerThemeContext);
  if (!value) {
    throw new Error('usePlayerTheme must be used inside <PlayerThemeProvider>');
  }
  return value;
}
