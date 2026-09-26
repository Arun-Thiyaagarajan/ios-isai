import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery } from '@tanstack/react-query';
import { memo, useCallback, useState } from 'react';
import { View } from 'react-native';

import { db } from '@/db/client';
import { queryKeys } from '@/db/queryKeys';
import { listSongs, type SongListItem } from '@/db/repos/library';
import { Artwork, ListRow, Text, makeStyles, useTheme } from '@/design';
import { formatCount, formatDuration } from '@/lib/format';

import { scanLibrary } from './scanService';
import { useScanStore } from './scanStore';

const PAGE_SIZE = 200;

const SongRow = memo(function SongRow({ song }: { song: SongListItem }) {
  const theme = useTheme();
  const subtitle = song.isPlayable
    ? [song.artist, song.album].filter(Boolean).join(' · ')
    : 'Format not supported';

  return (
    <ListRow
      title={song.title}
      subtitle={subtitle}
      accessibilityLabel={`${song.title}, ${song.artist}, ${formatDuration(song.durationMs)}`}
      leading={<Artwork size={theme.sizes.artworkRow} recyclingKey={String(song.id)} />}
      trailing={
        <Text variant="footnote" color="secondary" tabular>
          {formatDuration(song.durationMs)}
        </Text>
      }
    />
  );
});

/** All songs, A–Z, loaded 200 at a time as you scroll. */
export function SongList({ total }: { total: number }) {
  const theme = useTheme();
  const styles = useStyles();
  const scanning = useScanStore((s) => s.status === 'scanning');
  const unavailableFolders = useScanStore((s) => s.unavailableFolders);
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

  const header = (
    <View style={styles.header}>
      <Text variant="footnote" color="secondary">
        {formatCount(total, 'song')}
        {scanning ? ' · Updating…' : ''}
      </Text>
      {unavailableFolders.length > 0 ? (
        <Text variant="footnote" color="danger">
          Couldn’t open: {unavailableFolders.join(', ')}
        </Text>
      ) : null}
    </View>
  );

  return (
    <FlashList
      data={data}
      keyExtractor={(song) => String(song.id)}
      renderItem={({ item }) => <SongRow song={item} />}
      ListHeaderComponent={header}
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
    gap: t.spacing.xs,
  },
}));
