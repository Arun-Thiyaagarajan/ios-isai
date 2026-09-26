import type {
  AlbumSummary,
  ArtistSummary,
  GenreSummary,
  PlaylistSummary,
  TrackItem,
} from '@/db/repos/browse';
import type { SearchResults } from '@/db/repos/search';
import type { IconName } from '@/design';
import { normalizeKey } from '@/lib/normalize';

export type Item =
  | { kind: 'header'; key: string; title: string; action?: { label: string; onPress: () => void } }
  | { kind: 'recent'; key: string; query: string }
  | { kind: 'browse'; key: string; title: string; icon: IconName; screen: 'songs' | 'albums' | 'artists' | 'genres' | 'folders' }
  | { kind: 'song'; key: string; track: TrackItem; list: number[] }
  | { kind: 'artist'; key: string; artist: ArtistSummary }
  | { kind: 'album'; key: string; album: AlbumSummary }
  | { kind: 'playlist'; key: string; playlist: PlaylistSummary }
  | { kind: 'genre'; key: string; genre: GenreSummary }
  | { kind: 'noResults'; key: string };

export const browseRows: Extract<Item, { kind: 'browse' }>[] = [
  { kind: 'browse', key: 'b-songs', title: 'Songs', icon: 'song', screen: 'songs' },
  { kind: 'browse', key: 'b-albums', title: 'Albums', icon: 'album', screen: 'albums' },
  { kind: 'browse', key: 'b-artists', title: 'Artists', icon: 'artist', screen: 'artists' },
  { kind: 'browse', key: 'b-genres', title: 'Genres', icon: 'genre', screen: 'genres' },
  { kind: 'browse', key: 'b-folders', title: 'Folders', icon: 'folder', screen: 'folders' },
];

/**
 * Songs come first, unless the query names an artist or album (then that group leads,
 * like searching "rahman" shows the artist before their songs).
 */
export function resultItems(query: string, results: SearchResults): Item[] {
  const q = normalizeKey(query);
  const startsWith = (name: string) => normalizeKey(name).replace(/[^\p{L}\p{N} ]/gu, '').startsWith(q.replace(/[^\p{L}\p{N} ]/gu, ''));
  const songIds = results.songs.filter((s) => s.isPlayable).map((s) => s.id);

  const groups: { lead: boolean; items: Item[] }[] = [
    {
      lead: results.artists.some((a) => startsWith(a.name)),
      items: results.artists.length
        ? [
            { kind: 'header', key: 'h-artists', title: 'Artists' },
            ...results.artists.map((artist): Item => ({ kind: 'artist', key: `a${artist.id}`, artist })),
          ]
        : [],
    },
    {
      lead: results.albums.some((a) => startsWith(a.title)),
      items: results.albums.length
        ? [
            { kind: 'header', key: 'h-albums', title: 'Albums' },
            ...results.albums.map((album): Item => ({ kind: 'album', key: `al${album.id}`, album })),
          ]
        : [],
    },
    {
      lead: true,
      items: results.songs.length
        ? [
            { kind: 'header', key: 'h-songs', title: 'Songs' },
            ...results.songs.map((track): Item => ({ kind: 'song', key: `s${track.id}`, track, list: songIds })),
          ]
        : [],
    },
    {
      lead: false,
      items: results.playlists.length
        ? [
            { kind: 'header', key: 'h-playlists', title: 'Playlists' },
            ...results.playlists.map((playlist): Item => ({ kind: 'playlist', key: `p${playlist.id}`, playlist })),
          ]
        : [],
    },
    {
      lead: false,
      items: results.genres.length
        ? [
            { kind: 'header', key: 'h-genres', title: 'Genres' },
            ...results.genres.map((genre): Item => ({ kind: 'genre', key: `g${genre.id}`, genre })),
          ]
        : [],
    },
  ];
  const [artists, albums, ...rest] = groups;
  const ordered = [
    ...(artists.lead ? [artists] : []),
    ...(albums.lead ? [albums] : []),
    ...rest.slice(0, 1),
    ...(artists.lead ? [] : [artists]),
    ...(albums.lead ? [] : [albums]),
    ...rest.slice(1),
  ];
  const items = ordered.flatMap((g) => g.items);
  return items.length ? items : [{ kind: 'noResults', key: 'none' }];
}

