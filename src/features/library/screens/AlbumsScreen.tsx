import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { memo, useEffect, useMemo, useRef } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { db } from '@/db/client';
import { queryKeys } from '@/db/queryKeys';
import { firstIndexes, listAllAlbums, type SortedAlbum } from '@/db/repos/libraryLists';
import { EmptyScreen, FastScroller, Text, makeStyles, useReducedMotion, useTheme } from '@/design';
import { useSettings } from '@/features/settings/settingsStore';
import { headerActions } from '@/features/shell/headerActions';
import { formatCount } from '@/lib/format';
import { selectionHaptic } from '@/lib/haptics';

import { AlbumArtwork } from '../components/AlbumArtwork';
import { GRID_OUTER, useFixedGrid } from '../components/useGridLayout';
import { useBrowse } from '../navigation';
import { isAlphabetical, sanitizeAlbumView } from '../viewOptions';

const LIST_ARTWORK = 56;
/** The A–Z rail appears once a list is long enough to need it. */
const RAIL_MIN_ALBUMS = 30;

/**
 * Every album, as a grid (2–4 columns) or a list, in the saved sort order. A–Z rail for title
 * and artist sorts; the header button opens View & Sort.
 */
export function AlbumsScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const browse = useBrowse();
  const reducedMotion = useReducedMotion();
  const view = sanitizeAlbumView(useSettings((s) => s.albumsView));
  const listRef = useRef<FlashListRef<SortedAlbum>>(null);
  // First visible album, so switching layout or columns keeps your place.
  const firstVisible = useRef(0);

  const albums = useQuery({
    queryKey: [...queryKeys.library.albums(view.sort), view.descending],
    queryFn: () => listAllAlbums(db, view.sort, view.descending),
  });
  const data = useMemo(() => albums.data ?? [], [albums.data]);

  const letters = useMemo(() => firstIndexes(data.map((album) => album.letter)), [data]);
  const showRail = isAlphabetical(view.sort) && data.length >= RAIL_MIN_ALBUMS;
  const grid = view.layout === 'grid';
  const columns = grid ? view.columns : 1;
  const { tileWidth, cellStyle } = useFixedGrid(view.columns);
  // A new layout or column count remounts the list (numColumns can't change on a mounted list).
  const layoutKey = grid ? `grid-${view.columns}` : 'list';

  // After a layout change the list is new: bring the album you were looking at back into view.
  useEffect(() => {
    const index = firstVisible.current;
    if (index > 0) {
      requestAnimationFrame(() => listRef.current?.scrollToIndex({ index, animated: false }));
    }
  }, [layoutKey]);

  // A new sort starts at the top.
  useEffect(() => {
    firstVisible.current = 0;
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [view.sort, view.descending]);

  const header = (
    <Stack.Screen
      options={headerActions([
        { icon: 'sort', label: 'View and Sort', onPress: () => router.push({ pathname: '/view-options', params: { list: 'albums' } }) },
      ])}
    />
  );

  if (albums.data && data.length === 0) {
    return (
      <>
        {header}
        {/* Same position as every other empty page: a fixed distance below the large title. */}
        <EmptyScreen icon="album" title="No albums yet" message="Albums appear here once your music is scanned." />
      </>
    );
  }

  return (
    <View style={styles.screen}>
      {header}
      <Animated.View key={layoutKey} style={styles.screen} entering={reducedMotion ? undefined : FadeIn.duration(220)}>
        <FlashList
          ref={listRef}
          data={data}
          numColumns={columns}
          keyExtractor={(album) => String(album.id)}
          getItemType={() => layoutKey}
          ListHeaderComponent={
            <Text variant="subhead" color="secondary" style={styles.count}>
              {formatCount(data.length, 'album')}
            </Text>
          }
          renderItem={({ item, index }) =>
            grid ? (
              <View style={cellStyle(index)}>
                <AlbumGridItem album={item} width={tileWidth} compact={view.columns === 4} onOpen={browse.album} />
              </View>
            ) : (
              <AlbumListItem album={item} onOpen={browse.album} />
            )
          }
          onViewableItemsChanged={({ viewableItems }) => {
            const first = viewableItems[0]?.index;
            if (typeof first === 'number') firstVisible.current = first;
          }}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{
            paddingHorizontal: grid ? GRID_OUTER : 0,
            // In the list the rail needs room; in the grid it floats over the outer margin.
            paddingRight: grid ? GRID_OUTER : showRail ? 24 : 0,
            paddingBottom: theme.spacing.max,
          }}
          style={styles.screen}
        />
      </Animated.View>
      {showRail ? (
        <FastScroller
          letters={letters.map((l) => l.letter)}
          onTick={selectionHaptic}
          onSelect={(letter) => {
            const target = letters.find((l) => l.letter === letter);
            if (target) listRef.current?.scrollToIndex({ index: target.index, animated: false });
          }}
        />
      ) : null}
    </View>
  );
}

type ItemProps = { album: SortedAlbum; onOpen: (id: number) => void };

/** Square artwork (rounded, soft shadow) with title and artist underneath. */
const AlbumGridItem = memo(function AlbumGridItem({
  album,
  width,
  compact,
  onOpen,
}: ItemProps & { width: number; compact: boolean }) {
  const theme = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      onPress={() => onOpen(album.id)}
      accessibilityRole="button"
      accessibilityLabel={`${album.title}, ${album.artist}`}
      style={({ pressed }) => [{ width }, pressed && styles.pressed]}
    >
      <View style={[styles.gridArt, theme.shadows.card]}>
        <AlbumArtwork
          albumId={album.id}
          artworkKey={album.artworkKey}
          size={width}
          radius={compact ? theme.radius.sm : theme.radius.md}
          placeholderTitle={album.title}
        />
      </View>
      <Text variant={compact ? 'caption' : 'subhead'} numberOfLines={1} style={styles.gridTitle}>
        {album.title}
      </Text>
      <Text variant={compact ? 'caption' : 'footnote'} color="secondary" numberOfLines={1}>
        {album.artist}
      </Text>
    </Pressable>
  );
});

/** Artwork, title, and "artist · year · N songs". */
const AlbumListItem = memo(function AlbumListItem({ album, onOpen }: ItemProps) {
  const theme = useTheme();
  const styles = useStyles();
  const meta = [album.artist, album.year, formatCount(album.songCount, 'song')].filter(Boolean).join(' · ');
  return (
    <Pressable
      onPress={() => onOpen(album.id)}
      accessibilityRole="button"
      accessibilityLabel={`${album.title}, ${meta}`}
      style={({ pressed }) => [styles.listRow, pressed && { backgroundColor: theme.colors.surface }]}
    >
      <AlbumArtwork
        albumId={album.id}
        artworkKey={album.artworkKey}
        size={LIST_ARTWORK}
        radius={theme.radius.sm}
        placeholderTitle={album.title}
      />
      <View style={styles.listText}>
        <Text variant="body" numberOfLines={1} style={styles.listTitle}>
          {album.title}
        </Text>
        <Text variant="footnote" color="secondary" numberOfLines={1}>
          {meta}
        </Text>
      </View>
    </Pressable>
  );
});

const useStyles = makeStyles((t) => ({
  screen: {
    flex: 1,
    backgroundColor: t.colors.bg,
  },
  count: {
    paddingHorizontal: t.gutter,
    paddingTop: t.spacing.xs,
    paddingBottom: t.spacing.md,
  },
  pressed: {
    opacity: t.motion.pressedOpacity,
    transform: [{ scale: t.motion.pressedScale }],
  },
  gridArt: {
    borderRadius: t.radius.md,
  },
  gridTitle: {
    marginTop: t.spacing.sm,
    fontWeight: '500',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    paddingHorizontal: t.gutter,
    paddingVertical: t.spacing.sm,
  },
  listText: {
    flex: 1,
    minWidth: 0,
    gap: t.spacing.xxs,
  },
  listTitle: {
    fontWeight: '500',
  },
}));
