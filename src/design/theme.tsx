import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import * as SystemUI from 'expo-system-ui';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Animated, Appearance, StyleSheet, View, useColorScheme, useWindowDimensions, type ColorSchemeName } from 'react-native';

import { useReducedMotion } from './a11y';

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
  type DarkThemeName,
  type LightThemeName,
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

export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * Which theme to show: the chosen light theme, the chosen dark theme, or (System) whichever
 * matches the phone's light/dark setting.
 */
export function resolveThemeName(
  mode: ThemeMode,
  lightTheme: LightThemeName,
  darkTheme: DarkThemeName,
  systemScheme: ColorSchemeName | null | undefined,
): ThemeName {
  if (mode === 'light') {
    return lightTheme;
  }
  if (mode === 'dark') {
    return darkTheme;
  }
  return systemScheme === 'dark' ? darkTheme : lightTheme;
}

type Props = {
  children: ReactNode;
  /** The user's choices; stored by the settings feature, not here. */
  mode?: ThemeMode;
  lightTheme?: LightThemeName;
  darkTheme?: DarkThemeName;
};

/** How long the old theme's background takes to fade away after switching themes. */
const CROSSFADE_MS = 260;

/**
 * Smooths theme switches: the previous background is laid over the app and fades out, so the
 * change reads as a short crossfade instead of a hard cut. Skipped with Reduce Motion.
 */
function ThemeCrossfade({ name, background }: { name: ThemeName; background: string }) {
  const reducedMotion = useReducedMotion();
  const [current, setCurrent] = useState({ name, background });
  const [fadingFrom, setFadingFrom] = useState<string | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));

  if (current.name !== name) {
    setFadingFrom(reducedMotion ? null : current.background);
    setCurrent({ name, background });
  }

  useEffect(() => {
    if (!fadingFrom) {
      return;
    }
    opacity.setValue(1);
    const animation = Animated.timing(opacity, { toValue: 0, duration: CROSSFADE_MS, useNativeDriver: true });
    animation.start(() => setFadingFrom(null));
    return () => animation.stop();
  }, [fadingFrom, opacity]);

  if (!fadingFrom) {
    return null;
  }
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: fadingFrom, opacity }]}
    />
  );
}

export function ThemeProvider({ children, mode = 'system', lightTheme = 'isaiLight', darkTheme = 'isaiDark' }: Props) {
  const systemScheme = useColorScheme();
  const { width } = useWindowDimensions();

  const definition = themes[resolveThemeName(mode, lightTheme, darkTheme, systemScheme)];
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

  // Root view background (shows during transitions and keyboard animations, and behind Android's
  // edge-to-edge navigation bar).
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.colors.bg);
  }, [theme.colors.bg]);

  // Native chrome (Liquid Glass tab bar, search button, mini player accessory, header buttons,
  // sheets) follows the window's light/dark style, not our colors. Pin it to the chosen theme, or
  // a light theme on a dark-mode phone gets dark glass under our dark text.
  const forcedScheme = mode === 'system' ? 'unspecified' : scheme;
  useEffect(() => {
    Appearance.setColorScheme(forcedScheme);
  }, [forcedScheme]);

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
      <NavigationThemeProvider value={navigationTheme}>
        <View style={styles.fill}>
          {children}
          <ThemeCrossfade name={definition.name} background={definition.colors.bg} />
        </View>
      </NavigationThemeProvider>
    </ThemeContext.Provider>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});

/**
 * Shows part of the screen in a fixed theme (e.g. the dark Now Playing screen inside a light app),
 * without changing the app's navigation theme or window background.
 */
export function ThemeScope({
  children,
  themeName,
  colors,
}: {
  children: ReactNode;
  themeName: ThemeName;
  /** Colors to replace on top of the theme (e.g. Now Playing's artwork colors). */
  colors?: Partial<ColorPalette>;
}) {
  const outer = useTheme();
  const definition = themes[themeName];
  const theme = useMemo<Theme>(
    () => ({
      ...outer,
      name: definition.name,
      scheme: definition.scheme,
      colors: colors ? { ...definition.colors, ...colors } : definition.colors,
    }),
    [outer, definition, colors],
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
