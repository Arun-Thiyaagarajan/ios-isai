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
    counts: () => ['library', 'counts'] as const,
    recentAlbums: () => ['library', 'recentAlbums'] as const,
    albums: (sort: string) => ['library', 'albums', sort] as const,
    album: (id: number) => ['library', 'album', id] as const,
    artists: () => ['library', 'artists'] as const,
    artist: (id: number) => ['library', 'artist', id] as const,
    genres: () => ['library', 'genres'] as const,
    genre: (id: number) => ['library', 'genre', id] as const,
    folder: (path: string | null) => ['library', 'folder', path] as const,
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
