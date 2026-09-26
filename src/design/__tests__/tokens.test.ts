import { contrastRatio } from '@/lib/color';

import { palettes } from '../tokens';

// WCAG AA for normal text. Tertiary text is intentionally exempt (non-essential labels only).
const AA = 4.5;

describe.each(Object.entries(palettes))('%s palette', (_name, p) => {
  it.each(['bg', 'bgElevated', 'surface'] as const)('primary and secondary text are readable on %s', (bg) => {
    expect(contrastRatio(p.textPrimary, p[bg])).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(p.textSecondary, p[bg])).toBeGreaterThanOrEqual(AA);
  });

  it('accent text is readable on the background', () => {
    expect(contrastRatio(p.accentText, p.bg)).toBeGreaterThanOrEqual(AA);
  });

  it('text on accent fills is readable', () => {
    expect(contrastRatio(p.onAccent, p.accent)).toBeGreaterThanOrEqual(AA);
  });
});
