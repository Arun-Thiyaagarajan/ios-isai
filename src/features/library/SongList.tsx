import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { db } from '@/db/client';
import { queryKeys } from '@/db/queryKeys';
import type { TrackItem } from '@/db/repos/browse';
import { listSongIdsSorted, listSongsSorted, songLetterIndex } from '@/db/repos/libraryLists';
import { Button, FastScroller, Text, makeStyles, useTheme } from '@/design';
import { playSongs } from '@/features/player/playerService';
import type { PlayContext } from '@/features/player/playerStore';
import { openSongActions } from '@/features/player/songActions';
import { useSettings } from '@/features/settings/settingsStore';
import { headerActions } from '@/features/shell/headerActions';
import { formatCount } from '@/lib/format';
import { selectionHaptic } from '@/lib/haptics';

import { TrackRow } from './components/TrackRow';
import { SelectionBar, useSongSelection } from './selection';
import { scanLibrary } from './scanService';
import { useScanStore } from './scanStore';
import { SORT_LABELS, isAlphabetical, sanitizeSongView } from './viewOptions';

const PAGE_SIZE = 200;
/** The A–Z rail appears once a list is long enough to need it. */
const RAIL_MIN_SONGS = 50;

const ALL_SONGS: PlayContext = { type: 'songs', name: 'Songs' };

/** All songs in the saved sort order, loaded 200 at a time, with an A–Z rail for name sorts. */
export function SongList({ total }: { total: number }) {
  const theme = useTheme();
  const styles = useStyles();
  const scanning = useScanStore((s) => s.status === 'scanning');
  const view = sanitizeSongView(useSettings((s) => s.songsView));
  const [refreshing, setRefreshing] = useState(false);
  const listRef = useRef<FlashListRef<TrackItem>>(null);
  const selection = useSongSelection();

  const songs = useInfiniteQuery({
    queryKey: [...queryKeys.library.songs(), view.sort, view.descending],
    queryFn: ({ pageParam }) => listSongsSorted(db, pageParam, PAGE_SIZE, view.sort, view.descending),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => (lastPage.length < PAGE_SIZE ? undefined : pages.length * PAGE_SIZE),
  });
  const showRail = isAlphabetical(view.sort) && total >= RAIL_MIN_SONGS;
  const letters = useQuery({
    queryKey: [...queryKeys.library.songs(), 'letters', view.sort, view.descending],
    queryFn: () => songLetterIndex(db, view.sort, view.descending),
    enabled: showRail,
  });

  const data = songs.data?.pages.flat() ?? [];
  // Every song in list order, only while selecting (for "Select All" and play order).
  const orderedIds = useMemo(
    () => (selection.active ? listSongIdsSorted(db, view.sort, view.descending) : []),
    [selection.active, view.sort, view.descending],
  );
  const playAll = (startId?: number, shuffle = false) => {
    const ids = listSongIdsSorted(db, view.sort, view.descending);
    playSongs(ids, startId === undefined ? 0 : Math.max(0, ids.indexOf(startId)), { shuffle, context: ALL_SONGS });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await scanLibrary();
    setRefreshing(false);
  };

  /** Loads pages until `index` is in the list, then jumps to it. */
  const jumpTo = async (index: number) => {
    let loaded = data.length;
    let hasMore = songs.hasNextPage;
    while (loaded <= index && hasMore) {
      const result = await songs.fetchNextPage();
      loaded = result.data?.pages.flat().length ?? loaded;
      hasMore = result.hasNextPage;
    }
    requestAnimationFrame(() => listRef.current?.scrollToIndex({ index: Math.min(index, loaded - 1), animated: false }));
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={headerActions(
          selection.active
            ? [
                { icon: 'selectAll', label: 'Select All', onPress: () => selection.setAll(orderedIds) },
                { icon: 'check', label: 'Done', onPress: selection.done },
              ]
            : [
                { icon: 'select', label: 'Select', onPress: selection.start },
                { icon: 'sort', label: 'Sort', onPress: () => router.push({ pathname: '/view-options', params: { list: 'songs' } }) },
              ],
        )}
      />
      <FlashList
        ref={listRef}
        data={data}
        keyExtractor={(song) => String(song.id)}
        renderItem={({ item }) => (
          <TrackRow
            track={item}
            selected={selection.active ? selection.isSelected(item.id) : undefined}
            onPress={
              selection.active
                ? () => selection.toggle(item.id)
                : item.isPlayable
                  ? () => playAll(item.id)
                  : undefined
            }
            onMore={() => openSongActions(item.id)}
          />
        )}
        ListHeaderComponent={
          <View style={styles.header}>
            <Button label="Shuffle All" icon="shuffle" variant="secondary" onPress={() => playAll(undefined, true)} />
            <Text variant="footnote" color="secondary">
              {formatCount(total, 'song')} · {SORT_LABELS[view.sort]}
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
        // Extra room at the bottom while the selection bar is up.
        contentContainerStyle={{ paddingRight: showRail ? 20 : 0, paddingBottom: theme.spacing.max * (selection.active ? 2.5 : 1) }}
        extraData={selection.selected}
        style={styles.screen}
      />
      {showRail && letters.data ? (
        <FastScroller
          letters={letters.data.map((l) => l.letter)}
          onTick={selectionHaptic}
          onSelect={(letter) => {
            const target = letters.data?.find((l) => l.letter === letter);
            if (target) jumpTo(target.index);
          }}
        />
      ) : null}
      <SelectionBar selection={selection} orderedIds={orderedIds} context={ALL_SONGS} />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  screen: {
    flex: 1,
    backgroundColor: t.colors.bg,
  },
  header: {
    paddingHorizontal: t.gutter,
    paddingVertical: t.spacing.sm,
    gap: t.spacing.md,
  },
}));
