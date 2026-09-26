/**
 * Player themes: how Now Playing's background is drawn, and the colors everything on it uses.
 *
 * Pure (no React), so every theme can be contrast-tested against many kinds of covers. Each theme
 * turns the artwork colors + the user's options into:
 * - `tokens`: the only colors player components use (text, accent, controls, progress bar);
 * - `background`: a description of the layers `PlayerBackground` draws.
 * Gradients and blur exist only in backgrounds; controls stay flat.
 */
import { contrastRatio } from '@/lib/color';

import {
  INK,
  MIN_CONTRAST,
  WHITE,
  blend,
  ensureContrast,
  foregroundFor,
  fromHsl,
  mix,
  pickAccent,
  readableBackground,
  secondaryFor,
  toHsl,
  withAlpha,
  type Swatches,
} from './palette';

export const PLAYER_THEME_IDS = [
  'gradientBlur',
  'gradient',
  'blur',
  'solid',
  'mono',
  'amoled',
  'artworkBleed',
  'aurora',
] as const;
export type PlayerThemeId = (typeof PLAYER_THEME_IDS)[number];

export type GradientStyle = 'linear' | 'radial';
export type ColorSource = 'white' | 'theme' | 'artwork';

export type PlayerThemeOptions = {
  /** 0…1: how strongly the artwork is blurred. */
  blurStrength: number;
  /** 0…1: how dark the layer over the artwork is (a minimum: raised if text would be hard to read). */
  overlayDarkness: number;
  gradientStyle: GradientStyle;
  /**
   * White (default): controls in the text color, like Apple Music. Or the app theme's accent, or a
   * color picked from the artwork.
   */
  colorSource: ColorSource;
};
export type OptionKey = keyof PlayerThemeOptions;

export const DEFAULT_PLAYER_THEME: PlayerThemeId = 'gradientBlur';
export const DEFAULT_PLAYER_OPTIONS: PlayerThemeOptions = {
  blurStrength: 0.7,
  overlayDarkness: 0.35,
  gradientStyle: 'linear',
  colorSource: 'white',
};

export type PlayerTokens = {
  background: string;
  foreground: string;
  secondaryForeground: string;
  accent: string;
  /** Play button fill, and the glyph drawn on it. */
  controlBackground: string;
  controlForeground: string;
  progressTrack: string;
  progressFill: string;
  /** Light or dark content: status bar and system controls follow it. */
  scheme: 'light' | 'dark';
};

/** The layers `PlayerBackground` draws, bottom to top. */
export type BackgroundSpec =
  | { kind: 'solid'; color: string }
  | { kind: 'gradient'; colors: string[]; style: GradientStyle }
  | {
      kind: 'blur';
      /** expo-image blur radius for the artwork. */
      blurRadius: number;
      /** Solid color shown under the artwork (and instead of it when there's none). */
      base: string;
      /** Darkening layer over the blurred artwork (#RRGGBBAA). */
      overlay: string;
      /** Optional palette gradient over the artwork, at `opacity`. */
      gradient?: { colors: string[]; style: GradientStyle; opacity: number };
    }
  | { kind: 'bleed'; color: string }
  | { kind: 'aurora'; base: string; blobs: string[] };

export type PlayerThemeDefinition = {
  id: PlayerThemeId;
  name: string;
  description: string;
  /** Which options this theme uses (only these are shown in the picker). */
  options: OptionKey[];
};

export const PLAYER_THEMES: Record<PlayerThemeId, PlayerThemeDefinition> = {
  gradientBlur: {
    id: 'gradientBlur',
    name: 'Gradient + Blur',
    description: 'Artwork colors over a soft blur of the cover.',
    options: ['blurStrength', 'overlayDarkness', 'gradientStyle', 'colorSource'],
  },
  gradient: {
    id: 'gradient',
    name: 'Gradient',
    description: 'Two or three colors from the cover, blended.',
    options: ['gradientStyle', 'colorSource'],
  },
  blur: {
    id: 'blur',
    name: 'Blur',
    description: 'The cover itself, heavily blurred and dimmed.',
    options: ['blurStrength', 'overlayDarkness', 'colorSource'],
  },
  solid: {
    id: 'solid',
    name: 'Solid',
    description: 'One calm color from the cover.',
    options: ['colorSource'],
  },
  mono: {
    id: 'mono',
    name: 'Isai Mono',
    description: 'Ink and white, like the Isai logo. Only the accent comes from the cover.',
    options: ['colorSource'],
  },
  amoled: {
    id: 'amoled',
    name: 'AMOLED',
    description: 'Pure black, with color only on the controls.',
    options: ['colorSource'],
  },
  artworkBleed: {
    id: 'artworkBleed',
    name: 'Artwork Bleed',
    description: 'The cover fills the top and melts into its color.',
    options: ['colorSource'],
  },
  aurora: {
    id: 'aurora',
    name: 'Aurora',
    description: 'Slowly drifting light in the cover’s colors.',
    options: ['colorSource'],
  },
};

// ─── Contrast helpers ───────────────────────────────────────────────────────

/** White text needs a bit of headroom so the 60–70% secondary text stays readable too. */
const DARK_TARGET = 5.5;

/** Darkens a color (same hue) until white text on it reaches `min`. */
export function darkFor(color: string, min = DARK_TARGET): string {
  let hsl = toHsl(color);
  let current = color;
  for (let i = 0; i < 40 && contrastRatio(WHITE, current) < min; i++) {
    hsl = { ...hsl, l: Math.max(0, hsl.l - 0.025) };
    current = fromHsl(hsl);
  }
  return current;
}

/** The brighter areas of a cover once blurred: what text over a blurred cover must survive. */
function blurredArtEstimate(s: Swatches): string {
  return mix(s.dominant, s.lightVibrant, 0.35);
}

/** Black overlay strength (≥ `minimum`) that keeps white text readable over `art`. */
function overlayFor(art: string, minimum: number): number {
  for (let alpha = minimum; alpha < 0.95; alpha += 0.025) {
    if (contrastRatio(WHITE, blend('#000000', art, alpha)) >= DARK_TARGET) {
      return alpha;
    }
  }
  return 0.95;
}

function gradientStops(s: Swatches): string[] {
  return [darkFor(s.darkVibrant), darkFor(mix(s.dominant, '#000000', 0.3)), darkFor(s.darkMuted)];
}

// ─── Resolving a theme ──────────────────────────────────────────────────────

export type ResolvedPlayerTheme = { tokens: PlayerTokens; background: BackgroundSpec };

type PaletteInput = {
  swatches: Swatches;
  isFallback: boolean;
  /** The app theme's accent (used when the accent source is "Theme Accent"). */
  themeAccent?: string;
};

/**
 * An accent that works both as a color on `bg` (progress bar, like button) and as the play
 * button's fill (with a white or ink glyph on it): moved away from the background until both
 * reach 4.5:1.
 */
function controlAccent(color: string, bg: string): string {
  let accent = ensureContrast(color, bg);
  const glyphContrast = (c: string) => Math.max(contrastRatio(WHITE, c), contrastRatio(INK, c));
  const lighten = foregroundFor(bg) === WHITE;
  let hsl = toHsl(accent);
  for (let i = 0; i < 40 && glyphContrast(accent) < MIN_CONTRAST; i++) {
    hsl = { ...hsl, l: Math.min(1, Math.max(0, hsl.l + (lighten ? 0.025 : -0.025))) };
    accent = fromHsl(hsl);
  }
  return accent;
}

function tokensFor(background: string, input: PaletteInput, options: PlayerThemeOptions): PlayerTokens {
  const bg = readableBackground(background);
  const foreground = foregroundFor(bg);
  // White: controls in the text color. Without artwork colors there's nothing to pick from: the
  // theme accent (or plain text color).
  const fromArtwork = options.colorSource === 'artwork' && !input.isFallback;
  const source =
    options.colorSource === 'white'
      ? foreground
      : fromArtwork
        ? pickAccent(input.swatches, bg)
        : (input.themeAccent ?? foreground);
  // The accent fills the play button and the progress bar, so it must read on the background and
  // carry a readable glyph.
  const accent = controlAccent(source, bg);
  return {
    background: bg,
    foreground,
    secondaryForeground: secondaryFor(foreground, bg),
    accent,
    controlBackground: accent,
    controlForeground: contrastRatio(WHITE, accent) >= contrastRatio(INK, accent) ? WHITE : INK,
    progressTrack: withAlpha(foreground, 0.24),
    progressFill: accent,
    scheme: foreground === WHITE ? 'dark' : 'light',
  };
}

/**
 * Tokens and background layers for a theme, given the artwork colors.
 * `systemScheme` only matters for Isai Mono (ink in dark mode, white in light mode).
 */
export function resolvePlayerTheme(
  id: PlayerThemeId,
  options: PlayerThemeOptions,
  input: PaletteInput,
  systemScheme: 'light' | 'dark',
): ResolvedPlayerTheme {
  const s = input.swatches;
  const blurRadius = Math.round(20 + options.blurStrength * 70);

  switch (id) {
    case 'blur': {
      const art = blurredArtEstimate(s);
      const alpha = overlayFor(art, 0.2 + options.overlayDarkness * 0.6);
      const effective = blend('#000000', art, alpha);
      return {
        tokens: tokensFor(effective, input, options),
        background: {
          kind: 'blur',
          blurRadius,
          base: darkFor(s.dominant),
          overlay: withAlpha('#000000', alpha),
        },
      };
    }
    case 'gradientBlur': {
      const art = blurredArtEstimate(s);
      const opacity = 0.6 + options.overlayDarkness * 0.2;
      // Darken the stops until white text passes even where the cover shows through the most.
      const stops = gradientStops(s).map((stop) => {
        let current = stop;
        let hsl = toHsl(stop);
        for (let i = 0; i < 40 && contrastRatio(WHITE, blend(current, art, opacity)) < DARK_TARGET; i++) {
          hsl = { ...hsl, l: Math.max(0, hsl.l - 0.025) };
          current = fromHsl(hsl);
        }
        return current;
      });
      const worst = stops
        .map((stop) => blend(stop, art, opacity))
        .sort((a, b) => contrastRatio(WHITE, a) - contrastRatio(WHITE, b))[0];
      return {
        tokens: tokensFor(worst, input, options),
        background: {
          kind: 'blur',
          blurRadius,
          base: stops[1],
          overlay: withAlpha('#000000', 0),
          gradient: { colors: stops, style: options.gradientStyle, opacity },
        },
      };
    }
    case 'gradient': {
      const stops = gradientStops(s);
      const worst = [...stops].sort((a, b) => contrastRatio(WHITE, a) - contrastRatio(WHITE, b))[0];
      return {
        tokens: tokensFor(worst, input, options),
        background: { kind: 'gradient', colors: stops, style: options.gradientStyle },
      };
    }
    case 'solid': {
      const color = darkFor(mix(s.dominant, '#000000', 0.15));
      return { tokens: tokensFor(color, input, options), background: { kind: 'solid', color } };
    }
    case 'mono': {
      const color = systemScheme === 'dark' ? INK : WHITE;
      return { tokens: tokensFor(color, input, options), background: { kind: 'solid', color } };
    }
    case 'amoled': {
      return {
        tokens: tokensFor('#000000', input, options),
        background: { kind: 'solid', color: '#000000' },
      };
    }
    case 'artworkBleed': {
      // The artwork melts into its own dominant color; that color can be light (ink text then).
      const color = readableBackground(s.dominant);
      return { tokens: tokensFor(color, input, options), background: { kind: 'bleed', color } };
    }
    case 'aurora': {
      const base = darkFor(s.darkMuted, 7);
      // Blobs are drawn at 55% but can overlap and add up, so each color on its own must be dark
      // enough for white text.
      const blobs = [s.vibrant, s.darkVibrant, s.muted, s.lightVibrant].map((color) => darkFor(color));
      const worst = [...blobs].sort((a, b) => contrastRatio(WHITE, a) - contrastRatio(WHITE, b))[0];
      return { tokens: tokensFor(worst, input, options), background: { kind: 'aurora', base, blobs } };
    }
  }
}

// ─── Stored settings ────────────────────────────────────────────────────────

export function isPlayerThemeId(value: unknown): value is PlayerThemeId {
  return typeof value === 'string' && (PLAYER_THEME_IDS as readonly string[]).includes(value);
}

/** Reads saved options, filling anything missing or invalid with the defaults. */
export function sanitizeOptions(value: unknown): PlayerThemeOptions {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<Record<OptionKey, unknown>>;
  const unit = (x: unknown, fallback: number) =>
    typeof x === 'number' && Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : fallback;
  return {
    blurStrength: unit(v.blurStrength, DEFAULT_PLAYER_OPTIONS.blurStrength),
    overlayDarkness: unit(v.overlayDarkness, DEFAULT_PLAYER_OPTIONS.overlayDarkness),
    gradientStyle: v.gradientStyle === 'radial' ? 'radial' : 'linear',
    colorSource: v.colorSource === 'artwork' || v.colorSource === 'theme' ? v.colorSource : 'white',
  };
}
