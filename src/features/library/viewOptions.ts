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

export const SORT_LABELS: Record<AlbumSort | SongSort, string> = {
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
export const DEFAULT_DESCENDING: Record<AlbumSort | SongSort, boolean> = {
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
export function isAlphabetical(sort: AlbumSort | SongSort): boolean {
  return sort === 'title' || sort === 'artist' || sort === 'album';
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
