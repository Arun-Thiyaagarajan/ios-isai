/**
 * How library lists are shown and sorted. Shared by the Albums and Songs screens and the reusable
 * `LibraryViewOptions` control; saved in settings.
 */

export type LibraryLayout = 'list' | 'grid';
export type GridColumns = 2 | 3 | 4;

export const ALBUM_SORTS = ['title', 'artist', 'year', 'added', 'songs'] as const;
export type AlbumSort = (typeof ALBUM_SORTS)[number];

export const SONG_SORTS = ['title', 'artist', 'album', 'added', 'duration', 'plays'] as const;
export type SongSort = (typeof SONG_SORTS)[number];

export const ARTIST_SORTS = ['name', 'albums', 'songs'] as const;
export type ArtistSort = (typeof ARTIST_SORTS)[number];

export const PLAYLIST_SORTS = ['name', 'updated', 'songs'] as const;
export type PlaylistSort = (typeof PLAYLIST_SORTS)[number];

export type SortKey = AlbumSort | SongSort | ArtistSort | PlaylistSort;

export const SORT_LABELS: Record<SortKey, string> = {
  name: 'Name',
  albums: 'Number of Albums',
  updated: 'Recently Updated',
  title: 'Title',
  artist: 'Artist',
  album: 'Album',
  year: 'Year',
  added: 'Recently Added',
  songs: 'Number of Songs',
  duration: 'Duration',
  plays: 'Most Played',
};

/** The direction each sort starts in: A–Z for names, newest/most first for the rest. */
export const DEFAULT_DESCENDING: Record<SortKey, boolean> = {
  name: false,
  albums: true,
  updated: true,
  title: false,
  artist: false,
  album: false,
  year: true,
  added: true,
  songs: true,
  duration: true,
  plays: true,
};

/** Sorts where an A–Z letter rail makes sense. */
export function isAlphabetical(sort: SortKey): boolean {
  return sort === 'title' || sort === 'artist' || sort === 'album' || sort === 'name';
}

export type AlbumViewOptions = {
  layout: LibraryLayout;
  columns: GridColumns;
  sort: AlbumSort;
  descending: boolean;
};

export type SongViewOptions = {
  sort: SongSort;
  descending: boolean;
};

/** Artists and playlists: a list or grid, like albums. */
export type CollectionViewOptions<S extends SortKey> = {
  layout: LibraryLayout;
  columns: GridColumns;
  sort: S;
  descending: boolean;
};
export type ArtistViewOptions = CollectionViewOptions<ArtistSort>;
export type PlaylistViewOptions = CollectionViewOptions<PlaylistSort>;

export const DEFAULT_ARTIST_VIEW: ArtistViewOptions = { layout: 'list', columns: 3, sort: 'name', descending: false };
export const DEFAULT_PLAYLIST_VIEW: PlaylistViewOptions = { layout: 'list', columns: 2, sort: 'name', descending: false };

function sanitizeCollection<S extends SortKey>(
  value: unknown,
  sorts: readonly S[],
  fallback: CollectionViewOptions<S>,
): CollectionViewOptions<S> {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<Record<string, unknown>>;
  return {
    layout: v.layout === 'grid' ? 'grid' : v.layout === 'list' ? 'list' : fallback.layout,
    columns: v.columns === 2 || v.columns === 3 || v.columns === 4 ? v.columns : fallback.columns,
    sort: (sorts as readonly unknown[]).includes(v.sort) ? (v.sort as S) : fallback.sort,
    descending: typeof v.descending === 'boolean' ? v.descending : fallback.descending,
  };
}

export const sanitizeArtistView = (value: unknown) => sanitizeCollection(value, ARTIST_SORTS, DEFAULT_ARTIST_VIEW);
export const sanitizePlaylistView = (value: unknown) => sanitizeCollection(value, PLAYLIST_SORTS, DEFAULT_PLAYLIST_VIEW);

export const DEFAULT_ALBUM_VIEW: AlbumViewOptions = { layout: 'grid', columns: 2, sort: 'title', descending: false };
export const DEFAULT_SONG_VIEW: SongViewOptions = { sort: 'title', descending: false };

export function sanitizeAlbumView(value: unknown): AlbumViewOptions {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<Record<keyof AlbumViewOptions, unknown>>;
  return {
    layout: v.layout === 'list' ? 'list' : 'grid',
    columns: v.columns === 3 || v.columns === 4 ? v.columns : 2,
    sort: (ALBUM_SORTS as readonly unknown[]).includes(v.sort) ? (v.sort as AlbumSort) : 'title',
    descending: v.descending === true,
  };
}

export function sanitizeSongView(value: unknown): SongViewOptions {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<Record<keyof SongViewOptions, unknown>>;
  return {
    sort: (SONG_SORTS as readonly unknown[]).includes(v.sort) ? (v.sort as SongSort) : 'title',
    descending: v.descending === true,
  };
}
