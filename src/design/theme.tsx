import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import * as SystemUI from 'expo-system-ui';
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { StyleSheet, useColorScheme, useWindowDimensions, type ColorSchemeName } from 'react-native';

import {
  gutter,
  motion,
  radius,
  shadows,
  sizes,
  spacing,
  themes,
  typography,
  type ColorPalette,
  type ThemeName,
} from './tokens';

export type Theme = {
  name: ThemeName;
  scheme: 'light' | 'dark';
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

/**
 * Which theme to show. With `matchSystem`, the phone's light mode shows Pearl and dark mode shows
 * the chosen theme (or Midnight when Pearl is the choice).
 */
export function resolveThemeName(
  chosen: ThemeName,
  matchSystem: boolean,
  systemScheme: ColorSchemeName | null | undefined,
): ThemeName {
  if (!matchSystem) {
    return chosen;
  }
  if (systemScheme === 'light') {
    return 'pearl';
  }
  return themes[chosen].scheme === 'dark' ? chosen : 'midnight';
}

type Props = {
  children: ReactNode;
  /** The user's choice; stored by the settings feature, not here. */
  themeName?: ThemeName;
  matchSystem?: boolean;
};

export function ThemeProvider({ children, themeName = 'midnight', matchSystem = false }: Props) {
  const systemScheme = useColorScheme();
  const { width } = useWindowDimensions();

  const definition = themes[resolveThemeName(themeName, matchSystem, systemScheme)];
  const scheme = definition.scheme;
  const screenGutter = width >= gutter.wideFromWidth ? gutter.wide : gutter.default;

  const theme = useMemo<Theme>(
    () => ({
      name: definition.name,
      scheme,
      colors: definition.colors,
      spacing,
      radius,
      typography,
      sizes,
      shadows,
      motion,
      gutter: screenGutter,
    }),
    [definition, scheme, screenGutter],
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

/**
 * Shows part of the screen in a fixed theme (e.g. the dark Now Playing screen inside a light app),
 * without changing the app's navigation theme or window background.
 */
export function ThemeScope({ children, themeName }: { children: ReactNode; themeName: ThemeName }) {
  const outer = useTheme();
  const definition = themes[themeName];
  const theme = useMemo<Theme>(
    () => ({ ...outer, name: definition.name, scheme: definition.scheme, colors: definition.colors }),
    [outer, definition],
  );
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
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
