import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { db } from '@/db/client';
import { queryKeys } from '@/db/queryKeys';
import { listSongs } from '@/db/repos/browse';
import { listSongIds } from '@/db/repos/player';
import { Button, Text, makeStyles, useTheme } from '@/design';
import { playSongs } from '@/features/player/playerService';
import type { PlayContext } from '@/features/player/playerStore';
import { openSongActions } from '@/features/player/songActions';
import { formatCount } from '@/lib/format';

import { TrackRow } from './components/TrackRow';
import { scanLibrary } from './scanService';
import { useScanStore } from './scanStore';

const PAGE_SIZE = 200;

/** All songs, A–Z, loaded 200 at a time as you scroll. */
const ALL_SONGS: PlayContext = { type: 'songs', name: 'Songs' };

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
      renderItem={({ item, index }) => (
        <TrackRow
          track={item}
          onPress={item.isPlayable ? () => playSongs(listSongIds(db), index, { context: ALL_SONGS }) : undefined}
          onMore={() => openSongActions(item.id)}
        />
      )}
      ListHeaderComponent={
        <View style={styles.header}>
          <Button
            label="Shuffle All"
            icon="shuffle"
            variant="secondary"
            onPress={() => playSongs(listSongIds(db), 0, { shuffle: true, context: ALL_SONGS })}
          />
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
    gap: t.spacing.md,
  },
}));
