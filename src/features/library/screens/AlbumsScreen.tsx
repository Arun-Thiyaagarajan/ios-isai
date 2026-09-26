import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery } from '@tanstack/react-query';
import { View } from 'react-native';

import { db } from '@/db/client';
import { queryKeys } from '@/db/queryKeys';
import { listAlbums } from '@/db/repos/browse';
import { makeStyles, useTheme } from '@/design';

import { AlbumTile } from '../components/AlbumTile';
import { useGridLayout } from '../components/useGridLayout';
import { useBrowse } from '../navigation';

const PAGE_SIZE = 120;

/** Every album as an artwork grid, A–Z. */
export function AlbumsScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const browse = useBrowse();
  const { columns, tileWidth, gap } = useGridLayout();

  const albums = useInfiniteQuery({
    queryKey: queryKeys.library.albums('title'),
    queryFn: ({ pageParam }) => listAlbums(db, pageParam, PAGE_SIZE, 'title'),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.length < PAGE_SIZE ? undefined : pages.length * PAGE_SIZE),
  });

  return (
    <FlashList
      data={albums.data?.pages.flat() ?? []}
      numColumns={columns}
      keyExtractor={(album) => String(album.id)}
      renderItem={({ item }) => (
        // Each cell is 1/columns of the width; padding creates the gaps between tiles.
        <View style={[styles.cell, { paddingHorizontal: gap / 2, paddingBottom: gap }]}>
          <AlbumTile album={item} width={tileWidth} onPress={() => browse.album(item.id)} />
        </View>
      )}
      onEndReached={() => {
        if (albums.hasNextPage && !albums.isFetchingNextPage) {
          albums.fetchNextPage();
        }
      }}
      onEndReachedThreshold={1}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingHorizontal: theme.gutter - gap / 2, paddingTop: theme.spacing.sm }}
      style={{ backgroundColor: theme.colors.bg }}
    />
  );
}

const useStyles = makeStyles(() => ({
  cell: {
    alignItems: 'center',
  },
}));
