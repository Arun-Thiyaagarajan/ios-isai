import { useRouter, useSegments, type Href } from 'expo-router';
import { useMemo } from 'react';

/**
 * Opens library detail pages inside the current tab's stack, so Album → Artist → Album
 * stays in the tab you started from. Each tab declares the detail routes it supports
 * (one-line files re-exporting the screens in features/library/screens).
 */
export function useBrowse() {
  const router = useRouter();
  const segments = useSegments() as string[];
  const tab = segments.find((s) => s.startsWith('(') && s !== '(tabs)') ?? '(library)';

  return useMemo(() => {
    const base = `/(tabs)/${tab}`;
    return {
      album: (id: number) => router.push(`${base}/album/${id}` as Href),
      artist: (id: number) => router.push(`${base}/artist/${id}` as Href),
      genre: (id: number) => router.push(`${base}/genre/${id}` as Href),
      folder: (path: string) =>
        router.push({ pathname: `${base}/folders` as never, params: { path } } as Href),
      list: (screen: 'songs' | 'albums' | 'artists' | 'genres' | 'folders') =>
        router.push(`${base}/${screen}` as Href),
    };
  }, [router, tab]);
}
