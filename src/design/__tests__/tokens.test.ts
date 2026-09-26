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
  it('uses the chosen theme when not following the system', () => {
    expect(resolveThemeName('aurora', false, 'light')).toBe('aurora');
  });

  it('follows the system: Pearl by day, the chosen dark theme at night', () => {
    expect(resolveThemeName('aurora', true, 'light')).toBe('pearl');
    expect(resolveThemeName('aurora', true, 'dark')).toBe('aurora');
    expect(resolveThemeName('pearl', true, 'dark')).toBe('midnight');
  });
});
