import {
  router,
  useGlobalSearchParams,
  usePathname,
  useRootNavigationState,
  useSegments,
  type Href,
} from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { db } from '@/db/client';
import { readAllSettings, writeSetting } from '@/db/repos/settings';

/** Coming back within this long returns to the page you left; after that the app opens on Home. */
export const RESTORE_WITHIN_MS = 30 * 60 * 1000;
const KEY = 'lastRoute';

type SavedRoute = { href: string; params: Record<string, string>; at: number };

function isSavedRoute(value: unknown): value is SavedRoute {
  const v = value as Partial<SavedRoute> | null;
  return !!v && typeof v.href === 'string' && typeof v.at === 'number' && typeof v.params === 'object';
}

/** The page to return to on launch, if the app was left recently on a page inside the tabs. */
export function routeToRestore(saved: unknown, now = Date.now()): SavedRoute | null {
  if (!isSavedRoute(saved) || now - saved.at > RESTORE_WITHIN_MS) return null;
  // Home is where the app opens anyway.
  if (saved.href === '/(tabs)/(home)') return null;
  return saved.href.startsWith('/(tabs)/') ? saved : null;
}

/**
 * Remembers the page you're on inside the tabs, and when the app starts again soon after you
 * left (e.g. iOS closed it in the background), takes you back there. Otherwise the app opens on
 * Home. Sheets and the player aren't remembered; only pages in the tabs.
 */
export function RouteMemory() {
  const pathname = usePathname();
  const segments = useSegments() as string[];
  const params = useGlobalSearchParams();
  const navigationReady = useRootNavigationState()?.key != null;
  const restored = useRef(false);
  const current = useRef<SavedRoute | null>(null);
  // Stable keys, so saving happens when the page changes rather than on every render.
  const segmentsKey = segments.join('/');
  const paramsKey = JSON.stringify(params);

  // Once, when navigation is ready: go back to the saved page if it's recent.
  useEffect(() => {
    if (!navigationReady || restored.current) return;
    restored.current = true;
    const saved = routeToRestore(readAllSettings(db)[KEY]);
    if (saved) {
      router.navigate({ pathname: saved.href, params: saved.params } as unknown as Href);
    }
  }, [navigationReady]);

  // Save every page change inside the tabs (not sheets or the player, which sit outside them).
  useEffect(() => {
    const parts = segmentsKey.split('/');
    if (!restored.current || parts[0] !== '(tabs)') return;
    const tab = parts.find((segment) => segment.startsWith('(') && segment !== '(tabs)');
    if (!tab) return;
    const href = `/(tabs)/${tab}${pathname === '/' ? '' : pathname}`;
    const stringParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(JSON.parse(paramsKey) as Record<string, unknown>)) {
      // Dynamic segments (like an album id) are already in the path.
      if (typeof value === 'string' && !pathname.includes(`/${value}`)) stringParams[key] = value;
    }
    current.current = { href, params: stringParams, at: Date.now() };
    writeSetting(db, KEY, current.current);
  }, [pathname, segmentsKey, paramsKey]);

  // "When you left" is when the app went to the background, not when you opened that page.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && current.current) {
        current.current = { ...current.current, at: Date.now() };
        writeSetting(db, KEY, current.current);
      }
    });
    return () => subscription.remove();
  }, []);

  return null;
}
