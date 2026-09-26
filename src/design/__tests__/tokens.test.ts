import { contrastRatio } from '@/lib/color';

import { resolveThemeName } from '../theme';
import { themes } from '../tokens';

// WCAG AA for normal text. Tertiary/disabled text is intentionally exempt (non-essential labels only).
const AA = 4.5;

describe.each(Object.values(themes).map((t) => [t.label, t.colors] as const))('%s theme', (_label, c) => {
  it.each(['bg', 'bgElevated', 'surface', 'card', 'playerBg'] as const)(
    'primary and secondary text are readable on %s',
    (surface) => {
      expect(contrastRatio(c.textPrimary, c[surface])).toBeGreaterThanOrEqual(AA);
      expect(contrastRatio(c.textSecondary, c[surface])).toBeGreaterThanOrEqual(AA);
    },
  );

  it('accent text is readable on the background and cards', () => {
    expect(contrastRatio(c.accentText, c.bg)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(c.accentText, c.card)).toBeGreaterThanOrEqual(AA);
  });

  it('text on accent fills is readable', () => {
    expect(contrastRatio(c.onAccent, c.accent)).toBeGreaterThanOrEqual(AA);
  });

  it('icons stand out from the navigation bar (3:1 for UI graphics)', () => {
    expect(contrastRatio(c.iconSecondary, c.navBg)).toBeGreaterThanOrEqual(3);
  });
});

describe('resolveThemeName', () => {
  it('uses the chosen light or dark theme in Light and Dark mode', () => {
    expect(resolveThemeName('light', 'sky', 'graphite', 'dark')).toBe('sky');
    expect(resolveThemeName('dark', 'sky', 'graphite', 'light')).toBe('graphite');
  });

  it('follows the phone in System mode', () => {
    expect(resolveThemeName('system', 'linen', 'deepBlue', 'light')).toBe('linen');
    expect(resolveThemeName('system', 'linen', 'deepBlue', 'dark')).toBe('deepBlue');
    // No answer from the phone yet: light.
    expect(resolveThemeName('system', 'linen', 'deepBlue', null)).toBe('linen');
  });
});

describe('theme set', () => {
  it('has three light and three dark themes, none using pure black or pure white backgrounds', () => {
    const all = Object.values(themes);
    expect(all.filter((t) => t.scheme === 'light')).toHaveLength(3);
    expect(all.filter((t) => t.scheme === 'dark')).toHaveLength(3);
    for (const t of all) {
      expect(['#000000', '#FFFFFF']).not.toContain(t.colors.bg.toUpperCase());
    }
  });

  it('keeps the accent visible on every surface (3:1 for UI components)', () => {
    for (const t of Object.values(themes)) {
      for (const surface of ['bg', 'bgElevated', 'surface', 'surfaceHigh', 'card', 'navBg'] as const) {
        expect(contrastRatio(t.colors.accent, t.colors[surface])).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
