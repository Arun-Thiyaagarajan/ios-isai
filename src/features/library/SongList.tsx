import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { db } from '@/db/client';
import { queryKeys } from '@/db/queryKeys';
import { listSongs } from '@/db/repos/browse';
import { Text, makeStyles, useTheme } from '@/design';
import { formatCount } from '@/lib/format';

import { TrackRow } from './components/TrackRow';
import { scanLibrary } from './scanService';
import { useScanStore } from './scanStore';

const PAGE_SIZE = 200;

/** All songs, A–Z, loaded 200 at a time as you scroll. */
export function SongList({ total }: { total: number }) {
  const theme = useTheme();
  const styles = useStyles();
  const scanning = useScanStore((s) => s.status === 'scanning');
  const [refreshing, setRefreshing] = useState(false);

  const songs = useInfiniteQuery({
    queryKey: queryKeys.library.songs(),
    queryFn: ({ pageParam }) => listSongs(db, pageParam, PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.length < PAGE_SIZE ? undefined : pages.length * PAGE_SIZE,
  });

  const data = songs.data?.pages.flat() ?? [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await scanLibrary();
    setRefreshing(false);
  }, []);

  return (
    <FlashList
      data={data}
      keyExtractor={(song) => String(song.id)}
      renderItem={({ item }) => <TrackRow track={item} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text variant="footnote" color="secondary">
            {formatCount(total, 'song')}
            {scanning ? ' · Updating…' : ''}
          </Text>
        </View>
      }
      onEndReached={() => {
        if (songs.hasNextPage && !songs.isFetchingNextPage) {
          songs.fetchNextPage();
        }
      }}
      onEndReachedThreshold={1}
      refreshing={refreshing}
      onRefresh={onRefresh}
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: theme.colors.bg }}
    />
  );
}

const useStyles = makeStyles((t) => ({
  header: {
    paddingHorizontal: t.gutter,
    paddingVertical: t.spacing.sm,
  },
}));
