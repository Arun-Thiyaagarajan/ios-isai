/**
 * TanStack Query keys for database reads. Keys are nested so invalidating a prefix
 * refreshes everything under it, e.g. `queryKeys.library.all` after a scan.
 */
export const queryKeys = {
  library: {
    all: ['library'] as const,
    songCount: () => ['library', 'songCount'] as const,
    songs: () => ['library', 'songs'] as const,
    roots: () => ['library', 'roots'] as const,
    stats: () => ['library', 'stats'] as const,
    folders: () => ['library', 'folders'] as const,
  },
  playlists: {
    all: ['playlists'] as const,
    list: () => ['playlists', 'list'] as const,
    entries: (playlistId: number) => ['playlists', 'entries', playlistId] as const,
  },
  favorites: {
    all: ['favorites'] as const,
  },
  history: {
    all: ['history'] as const,
  },
};
