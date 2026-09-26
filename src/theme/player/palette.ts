/**
 * Player colors from album artwork: pure functions, no React, fully unit-tested.
 *
 * Native code picks six named colors from the image (same names on iOS and Android). Here they're
 * completed (missing names filled from the others), tamed (never muddy, washed out or neon) and
 * turned into readable colors: every text/icon color keeps at least 4.5:1 contrast on its background.
 */
import type { RawPalette } from '@modules/isai-library';

import { contrastRatio, parseHex } from '@/lib/color';

export const INK = '#15171B';
export const WHITE = '#FFFFFF';
/** WCAG AA for text and icons. */
export const MIN_CONTRAST = 4.5;

export type SwatchName = 'dominant' | 'vibrant' | 'darkVibrant' | 'lightVibrant' | 'muted' | 'darkMuted';
export type Swatches = Record<SwatchName, string>;

/** Brand-ink colors used when a song has no artwork (or its colors couldn't be read). */
export const FALLBACK_SWATCHES: Swatches = {
  dominant: INK,
  vibrant: '#3A3F4B',
  darkVibrant: '#1C1F26',
  lightVibrant: '#8A90A0',
  muted: '#2A2D34',
  darkMuted: '#101114',
};

// ─── Color math ─────────────────────────────────────────────────────────────

type Hsl = { h: number; s: number; l: number };

export function toHsl(hex: string): Hsl {
  const [r8, g8, b8] = parseHex(hex);
  const r = r8 / 255;
  const g = g8 / 255;
  const b = b8 / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) {
    return { h: 0, s: 0, l };
  }
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h /= 6;
  return { h, s, l };
}

export function fromHsl({ h, s, l }: Hsl): string {
  const hue = (p: number, q: number, t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  let r: number;
  let g: number;
  let b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue(p, q, h + 1 / 3);
    g = hue(p, q, h);
    b = hue(p, q, h - 1 / 3);
  }
  const hex = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

type Range = { sMin?: number; sMax?: number; lMin?: number; lMax?: number };

/** Keeps a color's saturation and lightness inside a range (hue unchanged). */
export function clampColor(hex: string, { sMin = 0, sMax = 1, lMin = 0, lMax = 1 }: Range): string {
  const { h, s, l } = toHsl(hex);
  return fromHsl({ h, s: Math.min(sMax, Math.max(sMin, s)), l: Math.min(lMax, Math.max(lMin, l)) });
}

export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();
  return `${hex.slice(0, 7)}${a}`;
}

/** `top` drawn at `alpha` over an opaque `bottom`, as a solid color (for contrast checks). */
export function blend(top: string, bottom: string, alpha: number): string {
  const t = parseHex(top);
  const b = parseHex(bottom);
  const mix = (i: number) => Math.round(t[i] * alpha + b[i] * (1 - alpha));
  return `#${[0, 1, 2].map((i) => mix(i).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/** Mixes two opaque colors: `amount` 0 = a, 1 = b. */
export function mix(a: string, b: string, amount: number): string {
  return blend(b, a, amount);
}

// ─── Palette ────────────────────────────────────────────────────────────────

/**
 * Limits per named color, so covers never produce muddy, washed-out or neon players.
 * Dark swatches stay dark enough for white text, light ones light enough for ink text.
 */
const LIMITS: Record<SwatchName, Range> = {
  dominant: { sMax: 0.8 },
  vibrant: { sMin: 0.3, sMax: 0.85, lMin: 0.35, lMax: 0.65 },
  lightVibrant: { sMin: 0.25, sMax: 0.8, lMin: 0.6, lMax: 0.82 },
  darkVibrant: { sMin: 0.2, sMax: 0.75, lMin: 0.1, lMax: 0.28 },
  muted: { sMin: 0.06, sMax: 0.4, lMin: 0.3, lMax: 0.6 },
  darkMuted: { sMin: 0.04, sMax: 0.35, lMin: 0.07, lMax: 0.2 },
};

const isHex = (value: unknown): value is string =>
  typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value);

/**
 * Completes and tames the colors native code picked from a cover. Returns null when there's
 * nothing usable (no dominant color), so the caller can use the ink fallback.
 */
export function normalizePalette(raw: RawPalette | null | undefined): Swatches | null {
  if (!raw) {
    return null;
  }
  const pick = (...names: SwatchName[]) => names.map((n) => raw[n]).find(isHex);
  const dominant = pick('dominant', 'vibrant', 'muted', 'darkVibrant', 'darkMuted', 'lightVibrant');
  if (!dominant) {
    return null;
  }
  const vibrant = pick('vibrant', 'lightVibrant', 'darkVibrant') ?? dominant;
  const muted = pick('muted', 'darkMuted') ?? dominant;
  const filled: Swatches = {
    dominant,
    vibrant,
    // Missing light/dark variants are derived from their neighbours; clamping below shifts them.
    lightVibrant: pick('lightVibrant') ?? vibrant,
    darkVibrant: pick('darkVibrant') ?? vibrant,
    muted,
    darkMuted: pick('darkMuted') ?? muted,
  };
  const result = {} as Swatches;
  for (const name of Object.keys(LIMITS) as SwatchName[]) {
    result[name] = clampColor(filled[name], LIMITS[name]);
  }
  return result;
}

/** White or ink, whichever reads better on `background`. */
export function foregroundFor(background: string): string {
  return contrastRatio(WHITE, background) >= contrastRatio(INK, background) ? WHITE : INK;
}

/**
 * A background that white or ink text can sit on at 4.5:1. Mid-tones where neither reaches it
 * are pushed darker (or lighter, if they're already light) just far enough.
 */
export function readableBackground(background: string): string {
  const best = () => Math.max(contrastRatio(WHITE, background), contrastRatio(INK, background));
  if (best() >= MIN_CONTRAST) {
    return background;
  }
  const hsl = toHsl(background);
  const darken = hsl.l <= 0.62;
  for (let step = 1; step <= 30; step++) {
    const l = Math.min(1, Math.max(0, hsl.l + (darken ? -0.02 : 0.02) * step));
    const candidate = fromHsl({ ...hsl, l });
    if (Math.max(contrastRatio(WHITE, candidate), contrastRatio(INK, candidate)) >= MIN_CONTRAST) {
      return candidate;
    }
  }
  return darken ? INK : WHITE;
}

/**
 * Nudges a color lighter or darker (away from the background) until it reaches `min` contrast.
 * Falls back to the plain foreground if even that can't be reached.
 */
export function ensureContrast(color: string, background: string, min = MIN_CONTRAST): string {
  if (contrastRatio(color, background) >= min) {
    return color;
  }
  const lighten = foregroundFor(background) === WHITE;
  const hsl = toHsl(color);
  for (let step = 1; step <= 25; step++) {
    const l = Math.min(1, Math.max(0, hsl.l + (lighten ? 0.03 : -0.03) * step));
    const candidate = fromHsl({ ...hsl, l });
    if (contrastRatio(candidate, background) >= min) {
      return candidate;
    }
  }
  return foregroundFor(background);
}

/**
 * Secondary text: the foreground at 60–70% strength, made stronger only if that would fall
 * below 4.5:1 on this background.
 */
export function secondaryFor(foreground: string, background: string): string {
  for (let alpha = 0.65; alpha < 1; alpha += 0.05) {
    if (contrastRatio(blend(foreground, background, alpha), background) >= MIN_CONTRAST) {
      return withAlpha(foreground, alpha);
    }
  }
  return foreground;
}

/**
 * The accent: the most saturated artwork color that reads on `background` (4.5:1), or the most
 * saturated one nudged until it does. Covers without color (fallback) use the foreground.
 */
export function pickAccent(swatches: Swatches, background: string, isFallback = false): string {
  if (isFallback) {
    return foregroundFor(background);
  }
  const candidates = (['vibrant', 'lightVibrant', 'darkVibrant', 'dominant', 'muted'] as const)
    .map((name) => swatches[name])
    .sort((a, b) => toHsl(b).s - toHsl(a).s);
  const readable = candidates.find(
    (c) => toHsl(c).s >= 0.25 && contrastRatio(c, background) >= MIN_CONTRAST,
  );
  if (readable) {
    return readable;
  }
  // Keep the most colorful one, but never neon: cap saturation before fixing contrast.
  return ensureContrast(clampColor(candidates[0], { sMax: 0.85 }), background);
}

export type PlayerColors = {
  /** The requested background, adjusted if needed so text on it can reach 4.5:1. */
  background: string;
  accent: string;
  foreground: string;
  secondaryForeground: string;
};

/** Background, accent, text and secondary-text colors for artwork colors on `requested`. */
export function derivePlayerColors(swatches: Swatches, requested: string, isFallback = false): PlayerColors {
  const background = readableBackground(requested);
  const foreground = foregroundFor(background);
  return {
    background,
    accent: pickAccent(swatches, background, isFallback),
    foreground,
    secondaryForeground: secondaryFor(foreground, background),
  };
}
