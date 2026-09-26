import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { IsaiLogo, ThemeProvider } from '@/design';

import { DOT_TRANSFORM_ORIGIN, SplashIntro } from '../SplashIntro';

describe('SplashIntro', () => {
  it('uses a numeric transform origin React Native can parse', () => {
    expect(DOT_TRANSFORM_ORIGIN).toHaveLength(3);
    for (const value of DOT_TRANSFORM_ORIGIN) {
      expect(Number.isFinite(value)).toBe(true);
    }
    // The dot's center: inside the 72 × 168 glyph box.
    expect(DOT_TRANSFORM_ORIGIN[0]).toBeGreaterThan(0);
    expect(DOT_TRANSFORM_ORIGIN[0]).toBeLessThan(72);
    expect(DOT_TRANSFORM_ORIGIN[1]).toBeGreaterThan(0);
    expect(DOT_TRANSFORM_ORIGIN[1]).toBeLessThan(168);
  });

  it('renders the launch overlay without crashing and hands off on layout', async () => {
    jest.useFakeTimers();
    await render(
      <ThemeProvider>
        <SplashIntro />
      </ThemeProvider>,
    );
    const overlay = screen.getByTestId('splash-intro', { includeHiddenElements: true });
    await act(async () => {
      fireEvent(overlay, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } } });
    });
    // Let the native-splash hide settle, then run the ~0.9 s animation to its end.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    // The overlay removes itself once the animation finishes.
    expect(screen.queryByTestId('splash-intro', { includeHiddenElements: true })).toBeNull();
    jest.useRealTimers();
  });

  it('plays only once per launch', async () => {
    const { toJSON } = await render(
      <ThemeProvider>
        <SplashIntro />
      </ThemeProvider>,
    );
    expect(toJSON()).toBeNull();
  });

  it('draws the logo with an accessible label', async () => {
    await render(<IsaiLogo width={48} />);
    expect(screen.getByLabelText('Isai')).toBeTruthy();
  });
});
