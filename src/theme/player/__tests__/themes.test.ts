import { contrastRatio } from '@/lib/color';

import { FALLBACK_SWATCHES, MIN_CONTRAST, blend, normalizePalette, type Swatches } from '../palette';
import {
  DEFAULT_PLAYER_OPTIONS,
  PLAYER_THEME_IDS,
  resolvePlayerTheme,
  sanitizeOptions,
  type PlayerThemeOptions,
} from '../themes';

/** Contrast of a possibly-translucent #RRGGBBAA color drawn on an opaque `bg`. */
function effective(color: string, bg: string): number {
  const alpha = color.length === 9 ? parseInt(color.slice(7), 16) / 255 : 1;
  return contrastRatio(blend(color.slice(0, 7), bg, alpha), bg);
}

const covers: Record<string, { swatches: Swatches; isFallback: boolean }> = {
  dark: { swatches: normalizePalette({ dominant: '#0A0A0C', darkMuted: '#101012', darkVibrant: '#1A0F2E' })!, isFallback: false },
  bright: { swatches: normalizePalette({ dominant: '#FFD400', vibrant: '#FF3B00', lightVibrant: '#FFF27A' })!, isFallback: false },
  colorful: {
    swatches: normalizePalette({
      dominant: '#1E88E5',
      vibrant: '#E91E63',
      darkVibrant: '#4A148C',
      lightVibrant: '#80DEEA',
      muted: '#8D6E63',
      darkMuted: '#3E2723',
    })!,
    isFallback: false,
  },
  nearlyWhite: { swatches: normalizePalette({ dominant: '#FAFAF7', lightVibrant: '#F4F1E8', muted: '#DAD6CC' })!, isFallback: false },
  noArtwork: { swatches: FALLBACK_SWATCHES, isFallback: true },
};

const optionSets: PlayerThemeOptions[] = [
  DEFAULT_PLAYER_OPTIONS,
  { blurStrength: 0, overlayDarkness: 0, gradientStyle: 'radial', colorSource: 'artwork' },
  { blurStrength: 1, overlayDarkness: 1, gradientStyle: 'linear', colorSource: 'brand' },
];

describe('player themes keep everything readable (4.5:1)', () => {
  for (const id of PLAYER_THEME_IDS) {
    for (const [coverName, cover] of Object.entries(covers)) {
      for (const scheme of ['light', 'dark'] as const) {
        it(`${id} · ${coverName} cover · ${scheme} mode`, () => {
          for (const options of optionSets) {
            const { tokens } = resolvePlayerTheme(id, options, cover, scheme);
            const bg = tokens.background;
            expect(contrastRatio(tokens.foreground, bg)).toBeGreaterThanOrEqual(MIN_CONTRAST);
            expect(effective(tokens.secondaryForeground, bg)).toBeGreaterThanOrEqual(MIN_CONTRAST);
            expect(contrastRatio(tokens.accent, bg)).toBeGreaterThanOrEqual(MIN_CONTRAST);
            expect(contrastRatio(tokens.progressFill, bg)).toBeGreaterThanOrEqual(MIN_CONTRAST);
            // The play glyph on the play button.
            expect(contrastRatio(tokens.controlForeground, tokens.controlBackground)).toBeGreaterThanOrEqual(
              MIN_CONTRAST,
            );
          }
        });
      }
    }
  }
});

describe('theme specifics', () => {
  it('Isai Mono is ink in dark mode and white in light mode', () => {
    const cover = covers.colorful;
    expect(resolvePlayerTheme('mono', DEFAULT_PLAYER_OPTIONS, cover, 'dark').tokens).toMatchObject({
      background: '#15171B',
      foreground: '#FFFFFF',
    });
    expect(resolvePlayerTheme('mono', DEFAULT_PLAYER_OPTIONS, cover, 'light').tokens).toMatchObject({
      background: '#FFFFFF',
      foreground: '#15171B',
    });
  });

  it('AMOLED is pure black with the accent on the controls', () => {
    const { tokens, background } = resolvePlayerTheme('amoled', DEFAULT_PLAYER_OPTIONS, covers.colorful, 'dark');
    expect(background).toEqual({ kind: 'solid', color: '#000000' });
    expect(tokens.controlBackground).toBe(tokens.accent);
    expect(tokens.progressFill).toBe(tokens.accent);
  });

  it('the brand color source uses white/ink instead of an artwork accent', () => {
    const { tokens } = resolvePlayerTheme('solid', { ...DEFAULT_PLAYER_OPTIONS, colorSource: 'brand' }, covers.colorful, 'dark');
    expect(tokens.accent).toBe(tokens.foreground);
  });

  it('raises the blur overlay when the cover is bright', () => {
    const light = resolvePlayerTheme('blur', { ...DEFAULT_PLAYER_OPTIONS, overlayDarkness: 0 }, covers.nearlyWhite, 'dark');
    const dark = resolvePlayerTheme('blur', { ...DEFAULT_PLAYER_OPTIONS, overlayDarkness: 0 }, covers.dark, 'dark');
    const alpha = (spec: typeof light.background) =>
      spec.kind === 'blur' ? parseInt(spec.overlay.slice(7), 16) : -1;
    expect(alpha(light.background)).toBeGreaterThan(alpha(dark.background));
  });

  it('cleans stored options', () => {
    expect(sanitizeOptions(null)).toEqual(DEFAULT_PLAYER_OPTIONS);
    expect(sanitizeOptions({ blurStrength: 7, gradientStyle: 'radial', colorSource: 'x' })).toEqual({
      ...DEFAULT_PLAYER_OPTIONS,
      blurStrength: 1,
      gradientStyle: 'radial',
    });
  });
});
