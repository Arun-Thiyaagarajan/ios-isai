import { contrastRatio } from '@/lib/color';

import {
  FALLBACK_SWATCHES,
  INK,
  MIN_CONTRAST,
  WHITE,
  blend,
  clampColor,
  derivePlayerColors,
  ensureContrast,
  foregroundFor,
  fromHsl,
  normalizePalette,
  pickAccent,
  toHsl,
  type Swatches,
} from '../palette';

/** Contrast of a possibly-translucent #RRGGBBAA color drawn on `bg`. */
function effectiveContrast(color: string, bg: string): number {
  const alpha = color.length === 9 ? parseInt(color.slice(7), 16) / 255 : 1;
  return contrastRatio(blend(color.slice(0, 7), bg, alpha), bg);
}

const covers: Record<string, Parameters<typeof normalizePalette>[0]> = {
  dark: { dominant: '#0A0A0C', darkMuted: '#101012', darkVibrant: '#1A0F2E' },
  bright: { dominant: '#FFD400', vibrant: '#FF3B00', lightVibrant: '#FFF27A' },
  colorful: {
    dominant: '#1E88E5',
    vibrant: '#E91E63',
    darkVibrant: '#4A148C',
    lightVibrant: '#80DEEA',
    muted: '#8D6E63',
    darkMuted: '#3E2723',
  },
  nearlyWhite: { dominant: '#FAFAF7', lightVibrant: '#F4F1E8', muted: '#DAD6CC' },
};

describe('color math', () => {
  it('round-trips HSL', () => {
    for (const hex of ['#15171B', '#FF3B00', '#80DEEA', '#FFFFFF', '#000000']) {
      expect(fromHsl(toHsl(hex))).toBe(hex);
    }
  });

  it('clamps saturation and lightness', () => {
    const neon = clampColor('#00FF00', { sMax: 0.6 });
    expect(toHsl(neon).s).toBeCloseTo(0.6, 1);
    expect(toHsl(clampColor('#FAFAFA', { lMax: 0.3 })).l).toBeCloseTo(0.3, 1);
  });

  it('picks white or ink for readability', () => {
    expect(foregroundFor('#101010')).toBe(WHITE);
    expect(foregroundFor('#F5F5F0')).toBe(INK);
  });

  it('nudges low-contrast colors until they read', () => {
    const fixed = ensureContrast('#333A40', '#15171B');
    expect(contrastRatio(fixed, '#15171B')).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });
});

describe('normalizePalette', () => {
  it('returns null without any usable color', () => {
    expect(normalizePalette(null)).toBeNull();
    expect(normalizePalette({})).toBeNull();
    expect(normalizePalette({ dominant: 'red' })).toBeNull();
  });

  it('fills every swatch from what the cover has', () => {
    const swatches = normalizePalette({ dominant: '#336699' })!;
    expect(Object.keys(swatches).sort()).toEqual(
      ['darkMuted', 'darkVibrant', 'dominant', 'lightVibrant', 'muted', 'vibrant'].sort(),
    );
  });

  it('keeps dark swatches dark and light ones light', () => {
    const swatches = normalizePalette(covers.colorful)!;
    expect(toHsl(swatches.darkVibrant).l).toBeLessThanOrEqual(0.29);
    expect(toHsl(swatches.darkMuted).l).toBeLessThanOrEqual(0.21);
    expect(toHsl(swatches.lightVibrant).l).toBeGreaterThanOrEqual(0.59);
  });

  it('never produces neon colors', () => {
    const swatches = normalizePalette({ dominant: '#00FF00', vibrant: '#FF00FF' })!;
    for (const color of Object.values(swatches)) {
      expect(toHsl(color).s).toBeLessThanOrEqual(0.86);
    }
  });
});

describe('derivePlayerColors', () => {
  const backgrounds = (s: Swatches) => [s.darkVibrant, s.dominant, s.darkMuted, s.lightVibrant, INK, WHITE, '#000000'];

  it.each(Object.keys(covers))('keeps text and accent readable for a %s cover', (name) => {
    const swatches = normalizePalette(covers[name])!;
    for (const requested of backgrounds(swatches)) {
      const colors = derivePlayerColors(swatches, requested);
      const bg = colors.background;
      expect(contrastRatio(colors.foreground, bg)).toBeGreaterThanOrEqual(MIN_CONTRAST);
      expect(contrastRatio(colors.accent, bg)).toBeGreaterThanOrEqual(MIN_CONTRAST);
      expect(effectiveContrast(colors.secondaryForeground, bg)).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
  });

  it('uses the most saturated readable color as the accent', () => {
    const swatches = normalizePalette(covers.colorful)!;
    const accent = pickAccent(swatches, INK);
    expect(toHsl(accent).s).toBeGreaterThan(0.4);
  });

  it('falls back to plain white on ink without artwork', () => {
    const colors = derivePlayerColors(FALLBACK_SWATCHES, INK, true);
    expect(colors).toMatchObject({ accent: WHITE, foreground: WHITE });
  });
});
