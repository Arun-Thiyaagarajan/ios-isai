import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery } from '@tanstack/react-query';

import { db } from '@/db/client';
import { queryKeys } from '@/db/queryKeys';
import { listArtists } from '@/db/repos/browse';
import { ListRow, useTheme } from '@/design';
import { formatCount } from '@/lib/format';

import { AlbumArtwork } from '../components/AlbumArtwork';
import { useBrowse } from '../navigation';

const PAGE_SIZE = 200;

export function ArtistsScreen() {
  const theme = useTheme();
  const browse = useBrowse();

  const artists = useInfiniteQuery({
    queryKey: queryKeys.library.artists(),
    queryFn: ({ pageParam }) => listArtists(db, pageParam, PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.length < PAGE_SIZE ? undefined : pages.length * PAGE_SIZE),
  });

  return (
    <FlashList
      data={artists.data?.pages.flat() ?? []}
      keyExtractor={(artist) => String(artist.id)}
      renderItem={({ item }) => (
        <ListRow
          title={item.name}
          subtitle={`${formatCount(item.albumCount, 'album')} · ${formatCount(item.songCount, 'song')}`}
          onPress={() => browse.artist(item.id)}
          leading={
            <AlbumArtwork
              albumId={item.albumId}
              artworkKey={item.artworkKey}
              size={theme.sizes.artworkRow}
              shape="circle"
              placeholderIcon="artist"
            />
          }
        />
      )}
      onEndReached={() => {
        if (artists.hasNextPage && !artists.isFetchingNextPage) {
          artists.fetchNextPage();
        }
      }}
      onEndReachedThreshold={1}
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: theme.colors.bg }}
    />
  );
}
