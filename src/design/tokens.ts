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
  /** Dimming layer behind sheets and dialogs. */
  scrim: string;
  skeleton: string;
  /** Artwork placeholder fill. */
  placeholder: string;
};

/** Palette keys that hold a single color (everything except gradient pairs). */
export type ColorName = {
  [K in keyof ColorPalette]: ColorPalette[K] extends string ? K : never;
}[keyof ColorPalette];

export type ThemeName = 'pureBlack' | 'midnight' | 'aurora' | 'pearl';

export type ThemeDefinition = {
  name: ThemeName;
  label: string;
  description: string;
  scheme: 'light' | 'dark';
  colors: ColorPalette;
};

/**
 * The four Isai themes. Few on purpose: each one is tuned by hand for contrast and surface depth
 * (the token tests check every text/background pair meets WCAG AA).
 */
export const themes: Record<ThemeName, ThemeDefinition> = {
  pureBlack: {
    name: 'pureBlack',
    label: 'Pure Black',
    description: 'True black for OLED screens, with a warm saffron accent.',
    scheme: 'dark',
    colors: {
      bg: '#000000',
      bgElevated: '#0A0A0B',
      surface: '#121214',
      surfaceHigh: '#1C1C1F',
      card: '#0E0E10',
      navBg: '#0A0A0B',
      playerBg: '#000000',
      textPrimary: '#FFFFFF',
      textSecondary: '#A3A3AB',
      textTertiary: '#6B6B73',
      textDisabled: '#48484E',
      icon: '#FFFFFF',
      iconSecondary: '#A3A3AB',
      separator: 'rgba(255, 255, 255, 0.09)',
      border: 'rgba(255, 255, 255, 0.14)',
      accent: '#F2B45A',
      accentText: '#F2B45A',
      onAccent: '#1C1200',
      accentGradient: ['#F2B45A', '#F2B45A'],
      progressTrack: 'rgba(255, 255, 255, 0.18)',
      progressFill: '#FFFFFF',
      danger: '#FF6B63',
      scrim: 'rgba(0, 0, 0, 0.6)',
      skeleton: '#161618',
      placeholder: '#1A1A1D',
    },
  },
  midnight: {
    name: 'midnight',
    label: 'Midnight',
    description: 'Deep navy surfaces and a soft periwinkle accent for late nights.',
    scheme: 'dark',
    colors: {
      bg: '#0B1020',
      bgElevated: '#10172B',
      surface: '#161E35',
      surfaceHigh: '#1F2843',
      card: '#121A2F',
      navBg: '#0E1426',
      playerBg: '#0B1020',
      textPrimary: '#EEF1F8',
      textSecondary: '#A0AAC2',
      textTertiary: '#687290',
      textDisabled: '#465070',
      icon: '#EEF1F8',
      iconSecondary: '#A0AAC2',
      separator: 'rgba(160, 180, 255, 0.10)',
      border: 'rgba(160, 180, 255, 0.18)',
      accent: '#8AB0FF',
      accentText: '#8AB0FF',
      onAccent: '#0B1020',
      accentGradient: ['#8AB0FF', '#8AB0FF'],
      progressTrack: 'rgba(160, 180, 255, 0.20)',
      progressFill: '#8AB0FF',
      danger: '#FF7A80',
      scrim: 'rgba(3, 6, 15, 0.6)',
      skeleton: '#18203A',
      placeholder: '#1A2340',
    },
  },
  aurora: {
    name: 'aurora',
    label: 'Aurora',
    description: 'A dark base with violet-to-teal highlights that flatter artwork.',
    scheme: 'dark',
    colors: {
      bg: '#0F0E14',
      bgElevated: '#16141D',
      surface: '#1D1A26',
      surfaceHigh: '#282435',
      card: '#18161F',
      navBg: '#141219',
      playerBg: '#0F0E14',
      textPrimary: '#F4F2FA',
      textSecondary: '#AAA4BC',
      textTertiary: '#716B84',
      textDisabled: '#4B4659',
      icon: '#F4F2FA',
      iconSecondary: '#AAA4BC',
      separator: 'rgba(200, 180, 255, 0.10)',
      border: 'rgba(200, 180, 255, 0.18)',
      accent: '#B794FF',
      accentText: '#C3A6FF',
      onAccent: '#170F2B',
      accentGradient: ['#B794FF', '#4FD1C5'],
      progressTrack: 'rgba(200, 180, 255, 0.20)',
      progressFill: '#B794FF',
      danger: '#FF7A8A',
      scrim: 'rgba(6, 4, 12, 0.6)',
      skeleton: '#1E1B28',
      placeholder: '#221F2D',
    },
  },
  pearl: {
    name: 'pearl',
    label: 'Pearl',
    description: 'Warm, soft light surfaces with deep amber details.',
    scheme: 'light',
    colors: {
      bg: '#F7F5F2',
      bgElevated: '#FFFFFF',
      surface: '#EEEAE4',
      surfaceHigh: '#E4DFD7',
      card: '#FFFFFF',
      navBg: '#FBFAF8',
      playerBg: '#F7F5F2',
      textPrimary: '#1C1A17',
      textSecondary: '#5C5750',
      textTertiary: '#8E887F',
      textDisabled: '#B9B3AA',
      icon: '#1C1A17',
      iconSecondary: '#5C5750',
      separator: 'rgba(60, 45, 30, 0.12)',
      border: 'rgba(60, 45, 30, 0.18)',
      accent: '#A15A12',
      accentText: '#A15A12',
      onAccent: '#FFFFFF',
      accentGradient: ['#A15A12', '#A15A12'],
      progressTrack: 'rgba(60, 45, 30, 0.16)',
      progressFill: '#1C1A17',
      danger: '#B3261E',
      scrim: 'rgba(28, 20, 10, 0.35)',
      skeleton: '#EAE6E0',
      placeholder: '#E6E1DA',
    },
  },
};

export const themeOrder: ThemeName[] = ['pureBlack', 'midnight', 'aurora', 'pearl'];

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
  },
  pressedOpacity: 0.6,
  pressedScale: 0.96,
} as const;
