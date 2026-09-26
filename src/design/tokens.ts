/**
 * Isai design tokens: the only place raw design values live.
 * Components read these through `useTheme()`; screens never hardcode colors, sizes or durations.
 */
import type { TextStyle } from 'react-native';

// ─── Color ──────────────────────────────────────────────────────────────────

export type ColorPalette = {
  /** Screen background. */
  bg: string;
  /** Slightly raised background (grouped lists, sheets). */
  bgElevated: string;
  /** Tonal surface (cards, filled buttons, Android chrome). */
  surface: string;
  /** Higher tonal surface (pressed states, selected rows). */
  surfaceHigh: string;
  textPrimary: string;
  textSecondary: string;
  /** Non-essential text only (e.g. track numbers); not guaranteed 4.5:1. */
  textTertiary: string;
  separator: string;
  /** Brand accent for fills (buttons, progress, selected tab). */
  accent: string;
  /** Accent when used as text on `bg`; tuned to reach 4.5:1. */
  accentText: string;
  /** Text/icons drawn on top of `accent`. */
  onAccent: string;
  danger: string;
  scrim: string;
  skeleton: string;
  /** Artwork placeholder fill. */
  placeholder: string;
};

// Warm saffron: the Isai brand hue.
const saffron = {
  light: '#E39B2F',
  lightText: '#9A5800',
  dark: '#F2B45A',
  onAccent: '#1C1200',
};

export const palettes = {
  light: {
    bg: '#FFFFFF',
    bgElevated: '#F5F5F7',
    surface: '#F0F0F3',
    surfaceHigh: '#E6E6EB',
    textPrimary: '#111114',
    textSecondary: '#5E5E66',
    textTertiary: '#8A8A93',
    separator: 'rgba(60, 60, 67, 0.18)',
    accent: saffron.light,
    accentText: saffron.lightText,
    onAccent: saffron.onAccent,
    danger: '#C62F2B',
    scrim: 'rgba(0, 0, 0, 0.4)',
    skeleton: '#ECECF0',
    placeholder: '#E4E4EA',
  },
  dark: {
    bg: '#0E0E11',
    bgElevated: '#17171B',
    surface: '#1C1C21',
    surfaceHigh: '#27272D',
    textPrimary: '#F5F5F7',
    textSecondary: '#A1A1AA',
    textTertiary: '#6E6E77',
    separator: 'rgba(255, 255, 255, 0.12)',
    accent: saffron.dark,
    accentText: saffron.dark,
    onAccent: saffron.onAccent,
    danger: '#FF6B63',
    scrim: 'rgba(0, 0, 0, 0.55)',
    skeleton: '#1F1F24',
    placeholder: '#232329',
  },
  // True black for OLED screens; surfaces stay slightly lifted so structure is still visible.
  oled: {
    bg: '#000000',
    bgElevated: '#0B0B0C',
    surface: '#121214',
    surfaceHigh: '#1C1C1F',
    textPrimary: '#F5F5F7',
    textSecondary: '#A1A1AA',
    textTertiary: '#6E6E77',
    separator: 'rgba(255, 255, 255, 0.10)',
    accent: saffron.dark,
    accentText: saffron.dark,
    onAccent: saffron.onAccent,
    danger: '#FF6B63',
    scrim: 'rgba(0, 0, 0, 0.6)',
    skeleton: '#161618',
    placeholder: '#1A1A1D',
  },
} satisfies Record<string, ColorPalette>;

export type PaletteName = keyof typeof palettes;

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
