import { QueryClient } from '@tanstack/react-query';

/**
 * Cache for database reads. Data is local, so it never goes stale on a timer:
 * writes invalidate the affected keys (see queryKeys.ts) instead.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      gcTime: 5 * 60 * 1000,
      retry: false,
      networkMode: 'always',
    },
    mutations: {
      networkMode: 'always',
    },
  },
});
