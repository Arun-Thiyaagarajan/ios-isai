/**
 * Isai design tokens: the only place raw design values live.
 * Components read these through `useTheme()`; screens never hardcode colors, sizes or durations.
 */
import type { TextStyle } from 'react-native';

// ─── Color ──────────────────────────────────────────────────────────────────

export type ColorPalette = {
  /** Screen background (base level). */
  bg: string;
  /** Slightly raised background (grouped lists, sheets). */
  bgElevated: string;
  /** Tonal surface (cards, filled buttons, Android chrome). */
  surface: string;
  /** Higher tonal surface (pressed states, selected rows, floating surfaces). */
  surfaceHigh: string;
  /** Cards on top of the background. */
  card: string;
  /** Bottom navigation background (Android; iOS uses the system glass bar). */
  navBg: string;
  /** Now Playing background when no artwork colors are used. */
  playerBg: string;
  textPrimary: string;
  textSecondary: string;
  /** Non-essential text only (e.g. track numbers); not guaranteed 4.5:1. */
  textTertiary: string;
  textDisabled: string;
  icon: string;
  iconSecondary: string;
  separator: string;
  border: string;
  /** Brand accent for fills (buttons, progress, selected tab). */
  accent: string;
  /** Accent when used as text on `bg`; tuned to reach 4.5:1. */
  accentText: string;
  /** Text/icons drawn on top of `accent`. */
  onAccent: string;
  /** Two stops for the rare accent gradient (same color twice in themes without one). */
  accentGradient: readonly [string, string];
  progressTrack: string;
  progressFill: string;
  danger: string;
  /** Confirmations (saved, added). */
  success: string;
  /** Dimming layer behind sheets and dialogs. */
  scrim: string;
  /** Shadow color for floating surfaces. */
  shadow: string;
  skeleton: string;
  /** Artwork placeholder fill. */
  placeholder: string;
};

/** Palette keys that hold a single color (everything except gradient pairs). */
export type ColorName = {
  [K in keyof ColorPalette]: ColorPalette[K] extends string ? K : never;
}[keyof ColorPalette];

export type LightThemeName = 'isaiLight' | 'linen' | 'sky';
export type DarkThemeName = 'isaiDark' | 'graphite' | 'deepBlue';
export type ThemeName = LightThemeName | DarkThemeName;

export type ThemeDefinition = {
  name: ThemeName;
  label: string;
  description: string;
  scheme: 'light' | 'dark';
  colors: ColorPalette;
};

/**
 * Isai's brand colors, read from the app icon: the glyph's soft black, and an off-white
 * (the icon tile is pure white; the themes use a softened version so nothing glares).
 */
export const brand = {
  ink: '#15171B',
  paper: '#F2F1EE',
} as const;

/**
 * Six themes: three light, three dark. Calm, soft contrast, never pure black or pure white.
 * Each is tuned by hand; the token tests check every text/background pair meets WCAG AA.
 */
export const themes: Record<ThemeName, ThemeDefinition> = {
  isaiLight: {
    name: 'isaiLight',
    label: 'Isai Light',
    description: 'Warm off-white and the soft black of the Isai logo. Quiet and minimal.',
    scheme: 'light',
    colors: {
      bg: '#F6F5F2',
      bgElevated: '#FFFFFF',
      surface: '#ECEBE7',
      surfaceHigh: '#E2E1DC',
      card: '#FFFFFF',
      navBg: '#FAF9F7',
      playerBg: '#F6F5F2',
      textPrimary: brand.ink,
      textSecondary: '#5E5F65',
      textTertiary: '#8E8F95',
      textDisabled: '#BDBDC2',
      icon: brand.ink,
      iconSecondary: '#5E5F65',
      separator: 'rgba(21, 23, 27, 0.08)',
      border: 'rgba(21, 23, 27, 0.10)',
      accent: brand.ink,
      accentText: brand.ink,
      onAccent: '#F6F5F2',
      accentGradient: [brand.ink, '#3A3D44'],
      progressTrack: 'rgba(21, 23, 27, 0.12)',
      progressFill: brand.ink,
      danger: '#B3261E',
      success: '#2E7D4F',
      scrim: 'rgba(21, 23, 27, 0.30)',
      shadow: brand.ink,
      skeleton: '#ECEBE7',
      placeholder: '#E6E5E1',
    },
  },
  linen: {
    name: 'linen',
    label: 'Linen',
    description: 'Warm cream paper, deep brown-black ink and a muted bronze accent.',
    scheme: 'light',
    colors: {
      bg: '#F4EEE3',
      bgElevated: '#FBF8F2',
      surface: '#EAE2D4',
      surfaceHigh: '#DFD5C4',
      card: '#FBF8F2',
      navBg: '#F8F3EA',
      playerBg: '#F4EEE3',
      textPrimary: '#2A2118',
      textSecondary: '#655646',
      textTertiary: '#978874',
      textDisabled: '#C4B8A6',
      icon: '#2A2118',
      iconSecondary: '#655646',
      separator: 'rgba(42, 33, 24, 0.09)',
      border: 'rgba(42, 33, 24, 0.12)',
      accent: '#83552A',
      accentText: '#83552A',
      onAccent: '#FBF8F2',
      accentGradient: ['#83552A', '#A87A4B'],
      progressTrack: 'rgba(42, 33, 24, 0.13)',
      progressFill: '#83552A',
      danger: '#A8321F',
      success: '#3E7A4A',
      scrim: 'rgba(42, 33, 24, 0.30)',
      shadow: '#2A2118',
      skeleton: '#EAE2D4',
      placeholder: '#E5DCCC',
    },
  },
  sky: {
    name: 'sky',
    label: 'Sky',
    description: 'Light white with a faint cool blue, deep navy text and a calm blue accent.',
    scheme: 'light',
    colors: {
      bg: '#F6F8FC',
      bgElevated: '#FFFFFF',
      surface: '#EAF0FA',
      surfaceHigh: '#DCE5F5',
      card: '#FFFFFF',
      navBg: '#F9FAFD',
      playerBg: '#F6F8FC',
      textPrimary: '#16233A',
      textSecondary: '#4E5C73',
      textTertiary: '#8391A7',
      textDisabled: '#B8C2D2',
      icon: '#16233A',
      iconSecondary: '#4E5C73',
      separator: 'rgba(22, 35, 58, 0.08)',
      border: 'rgba(22, 35, 58, 0.11)',
      accent: '#2A62D4',
      accentText: '#2A62D4',
      onAccent: '#FFFFFF',
      accentGradient: ['#2A62D4', '#5B9BFF'],
      progressTrack: 'rgba(42, 98, 212, 0.16)',
      progressFill: '#2A62D4',
      danger: '#B3261E',
      success: '#23794D',
      scrim: 'rgba(22, 35, 58, 0.30)',
      shadow: '#16233A',
      skeleton: '#EAF0FA',
      placeholder: '#E1E8F4',
    },
  },
  isaiDark: {
    name: 'isaiDark',
    label: 'Isai Dark',
    description: 'The soft black of the Isai logo with off-white type. Quiet and minimal.',
    scheme: 'dark',
    colors: {
      bg: brand.ink,
      bgElevated: '#1C1E23',
      surface: '#23262C',
      surfaceHigh: '#2C2F36',
      card: '#1C1E23',
      navBg: '#181A1E',
      playerBg: brand.ink,
      textPrimary: brand.paper,
      textSecondary: '#A5A7AD',
      textTertiary: '#6E7077',
      textDisabled: '#4A4C52',
      icon: brand.paper,
      iconSecondary: '#A5A7AD',
      separator: 'rgba(242, 241, 238, 0.08)',
      border: 'rgba(242, 241, 238, 0.12)',
      accent: brand.paper,
      accentText: brand.paper,
      onAccent: brand.ink,
      accentGradient: [brand.paper, '#C9C8C4'],
      progressTrack: 'rgba(242, 241, 238, 0.18)',
      progressFill: brand.paper,
      danger: '#FF6B63',
      success: '#5BC98A',
      scrim: 'rgba(0, 0, 0, 0.55)',
      shadow: '#000000',
      skeleton: '#202227',
      placeholder: '#26282E',
    },
  },
  graphite: {
    name: 'graphite',
    label: 'Graphite',
    description: 'Apple-style graphite greys with a muted rose accent.',
    scheme: 'dark',
    colors: {
      bg: '#1C1C1E',
      bgElevated: '#242426',
      surface: '#2C2C2E',
      surfaceHigh: '#3A3A3C',
      card: '#242426',
      navBg: '#1F1F21',
      playerBg: '#1C1C1E',
      textPrimary: '#EDEDEF',
      textSecondary: '#A1A1A6',
      textTertiary: '#6C6C70',
      textDisabled: '#48484A',
      icon: '#EDEDEF',
      iconSecondary: '#A1A1A6',
      separator: 'rgba(237, 237, 239, 0.08)',
      border: 'rgba(237, 237, 239, 0.12)',
      accent: '#EC6F82',
      accentText: '#EC6F82',
      onAccent: '#1C1C1E',
      accentGradient: ['#EC6F82', '#F29AA7'],
      progressTrack: 'rgba(237, 237, 239, 0.18)',
      progressFill: '#EC6F82',
      danger: '#FF6B63',
      success: '#5BC98A',
      scrim: 'rgba(0, 0, 0, 0.55)',
      shadow: '#000000',
      skeleton: '#262628',
      placeholder: '#2E2E30',
    },
  },
  deepBlue: {
    name: 'deepBlue',
    label: 'Deep Blue',
    description: 'Deep evening blue, light white type and a soft bright blue accent.',
    scheme: 'dark',
    colors: {
      bg: '#0E1A2F',
      bgElevated: '#13223B',
      surface: '#182A47',
      surfaceHigh: '#213658',
      card: '#13223B',
      navBg: '#101D33',
      playerBg: '#0E1A2F',
      textPrimary: '#EEF3FA',
      textSecondary: '#A3B3CC',
      textTertiary: '#6F819E',
      textDisabled: '#43546F',
      icon: '#EEF3FA',
      iconSecondary: '#A3B3CC',
      separator: 'rgba(238, 243, 250, 0.08)',
      border: 'rgba(238, 243, 250, 0.12)',
      accent: '#5B9BFF',
      accentText: '#5B9BFF',
      onAccent: '#0E1A2F',
      accentGradient: ['#5B9BFF', '#2A62D4'],
      progressTrack: 'rgba(91, 155, 255, 0.22)',
      progressFill: '#5B9BFF',
      danger: '#FF7A70',
      success: '#5FD39A',
      scrim: 'rgba(0, 0, 0, 0.55)',
      shadow: '#000000',
      skeleton: '#162640',
      placeholder: '#1B2D4B',
    },
  },
};

export const lightThemeOrder: LightThemeName[] = ['isaiLight', 'linen', 'sky'];
export const darkThemeOrder: DarkThemeName[] = ['isaiDark', 'graphite', 'deepBlue'];
export const themeOrder: ThemeName[] = [...lightThemeOrder, ...darkThemeOrder];

// ─── Spacing (4-pt grid) ────────────────────────────────────────────────────

export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  giant: 48,
  max: 64,
} as const;

/** Horizontal screen padding; wider on large phones. */
export const gutter = { default: spacing.lg, wide: spacing.xl, wideFromWidth: 414 } as const;

// ─── Radius ─────────────────────────────────────────────────────────────────

export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

// ─── Typography ─────────────────────────────────────────────────────────────
// Platform fonts (SF Pro / Roboto) so Dynamic Type and system rendering work.

type TypeRole = Pick<TextStyle, 'fontSize' | 'lineHeight' | 'fontWeight' | 'letterSpacing'> & {
  /** Upper bound for the user's font scale, so layouts stay intact at accessibility sizes. */
  maxScale: number;
};

export const typography = {
  display: { fontSize: 34, lineHeight: 41, fontWeight: '700', letterSpacing: 0.4, maxScale: 1.3 },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: 0.36, maxScale: 1.4 },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: 0.35, maxScale: 1.5 },
  /** Song title on Now Playing. Tall line height so Tamil and other tall scripts never clip. */
  playerTitle: { fontSize: 24, lineHeight: 32, fontWeight: '600', letterSpacing: 0.2, maxScale: 1.3 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.4, maxScale: 1.6 },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400', letterSpacing: -0.4, maxScale: 1.6 },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400', letterSpacing: -0.3, maxScale: 1.6 },
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: '400', letterSpacing: -0.2, maxScale: 1.6 },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400', letterSpacing: -0.1, maxScale: 1.6 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500', letterSpacing: 0, maxScale: 1.4 },
} as const satisfies Record<string, TypeRole>;

export type TypeRoleName = keyof typeof typography;

// ─── Sizes ──────────────────────────────────────────────────────────────────

export const sizes = {
  /** Minimum touch target (Apple HIG 44pt; Material asks 48dp, handled via hitSlop). */
  touchTarget: 44,
  listRow: 64,
  miniPlayer: 64,
  artworkRow: 48,
  artworkGridMin: 160,
  playButton: 72,
  hairline: 1,
  icon: { sm: 16, md: 20, lg: 24, xl: 28 },
} as const;

// ─── Shadows ────────────────────────────────────────────────────────────────

export const shadows = {
  /** Soft lift for cards and floating bars on light backgrounds (used instead of borders). */
  card: {
    shadowColor: '#111113',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  /** Lifts large artwork (album headers, Now Playing) off the background. */
  artwork: {
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
} as const;

// ─── Motion ─────────────────────────────────────────────────────────────────

export const motion = {
  duration: { fast: 150, base: 250, slow: 350 },
  spring: {
    snappy: { damping: 20, stiffness: 300, mass: 1 },
    gentle: { damping: 26, stiffness: 180, mass: 1 },
    /** A little overshoot, for playful feedback like the like-button pop. */
    bouncy: { damping: 9, stiffness: 320, mass: 0.8 },
  },
  pressedOpacity: 0.6,
  pressedScale: 0.96,
} as const;
