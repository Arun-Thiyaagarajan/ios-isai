import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import * as SystemUI from 'expo-system-ui';
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { StyleSheet, useColorScheme, useWindowDimensions } from 'react-native';

import {
  gutter,
  motion,
  palettes,
  radius,
  shadows,
  sizes,
  spacing,
  typography,
  type ColorPalette,
  type PaletteName,
} from './tokens';

export type ThemePreference = 'system' | 'light' | 'dark';

export type Theme = {
  scheme: 'light' | 'dark';
  paletteName: PaletteName;
  colors: ColorPalette;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  sizes: typeof sizes;
  shadows: typeof shadows;
  motion: typeof motion;
  /** Horizontal screen padding for the current window width. */
  gutter: number;
};

const ThemeContext = createContext<Theme | null>(null);

type Props = {
  children: ReactNode;
  /** The user's choice; stored by the settings feature, not here. */
  preference?: ThemePreference;
  /** Use the true-black palette in dark mode. */
  oledBlack?: boolean;
};

export function ThemeProvider({ children, preference = 'system', oledBlack = false }: Props) {
  const systemScheme = useColorScheme();
  const { width } = useWindowDimensions();

  const scheme: 'light' | 'dark' =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;
  const paletteName: PaletteName = scheme === 'light' ? 'light' : oledBlack ? 'oled' : 'dark';
  const screenGutter = width >= gutter.wideFromWidth ? gutter.wide : gutter.default;

  const theme = useMemo<Theme>(
    () => ({
      scheme,
      paletteName,
      colors: palettes[paletteName],
      spacing,
      radius,
      typography,
      sizes,
      shadows,
      motion,
      gutter: screenGutter,
    }),
    [scheme, paletteName, screenGutter],
  );

  // Root view background shows during screen transitions and keyboard animations.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.colors.bg);
  }, [theme.colors.bg]);

  const navigationTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: theme.colors.accentText,
        background: theme.colors.bg,
        card: theme.colors.bg,
        text: theme.colors.textPrimary,
        border: theme.colors.separator,
      },
    };
  }, [scheme, theme]);

  return (
    <ThemeContext.Provider value={theme}>
      <NavigationThemeProvider value={navigationTheme}>{children}</NavigationThemeProvider>
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error('useTheme must be used inside <ThemeProvider>');
  }
  return theme;
}

/**
 * Define styles as a function of the theme; they are rebuilt only when the theme changes.
 *
 * const useStyles = makeStyles((t) => ({ row: { padding: t.spacing.lg } }));
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(factory: (theme: Theme) => T) {
  return function useStyles(): T {
    const theme = useTheme();
    return useMemo(() => StyleSheet.create(factory(theme)), [theme]);
  };
}
