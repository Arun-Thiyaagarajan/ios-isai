import { RESTORE_WITHIN_MS, routeToRestore } from '../RouteMemory';

jest.mock('@/db/client', () => ({ db: {} }));

describe('routeToRestore', () => {
  const now = 1_000_000_000;
  const saved = (href: string, ago: number) => ({ href, params: {}, at: now - ago });

  it('returns to a page left recently', () => {
    expect(routeToRestore(saved('/(tabs)/(albums)/album/12', 60_000), now)?.href).toBe('/(tabs)/(albums)/album/12');
  });

  it('opens on Home when the page was left long ago', () => {
    expect(routeToRestore(saved('/(tabs)/(albums)/album/12', RESTORE_WITHIN_MS + 1), now)).toBeNull();
  });

  it('ignores Home itself, pages outside the tabs, and broken values', () => {
    expect(routeToRestore(saved('/(tabs)/(home)', 1000), now)).toBeNull();
    expect(routeToRestore(saved('/player', 1000), now)).toBeNull();
    expect(routeToRestore({ href: 5 }, now)).toBeNull();
    expect(routeToRestore(undefined, now)).toBeNull();
  });
});
