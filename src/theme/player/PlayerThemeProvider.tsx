import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { ThemeScope, type Theme } from '@/design';
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

/** Resolves any theme for the given colors (the picker uses it for its live previews). */
export function useResolvedPlayerTheme(
  id: PlayerThemeId,
  options: PlayerThemeOptions,
  palette: PlayerPalette,
): PlayerThemeValue {
  const systemScheme = useColorScheme() === 'light' ? 'light' : 'dark';
  return useMemo(() => {
    const resolved = resolvePlayerTheme(id, options, palette, systemScheme);
    return { definition: PLAYER_THEMES[id], options, palette, ...resolved };
  }, [id, options, palette, systemScheme]);
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
  const value = useResolvedPlayerTheme(id, options, palette);
  const colors = useMemo(() => scopeColors(value.tokens), [value.tokens]);

  return (
    <PlayerThemeContext.Provider value={value}>
      <ThemeScope themeName={value.tokens.scheme === 'dark' ? 'pureBlack' : 'pearl'} colors={colors}>
        {children}
      </ThemeScope>
    </PlayerThemeContext.Provider>
  );
}

export function usePlayerTheme(): PlayerThemeValue {
  const value = useContext(PlayerThemeContext);
  if (!value) {
    throw new Error('usePlayerTheme must be used inside <PlayerThemeProvider>');
  }
  return value;
}
