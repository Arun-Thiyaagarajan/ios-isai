import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { memo, useEffect, useMemo, useRef } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { db } from '@/db/client';
import { queryKeys } from '@/db/queryKeys';
import { firstIndexes, listAllArtists, type SortedArtist } from '@/db/repos/libraryLists';
import { EmptyScreen, FastScroller, ListRow, Text, makeStyles, useReducedMotion, useTheme } from '@/design';
import { useSettings } from '@/features/settings/settingsStore';
import { headerActions } from '@/features/shell/headerActions';
import { formatCount } from '@/lib/format';
import { selectionHaptic } from '@/lib/haptics';

import { AlbumArtwork } from '../components/AlbumArtwork';
import { GRID_OUTER, useFixedGrid } from '../components/useGridLayout';
import { useBrowse } from '../navigation';
import { isAlphabetical, sanitizeArtistView } from '../viewOptions';

/** The A–Z rail appears once a list is long enough to need it. */
const RAIL_MIN_ARTISTS = 30;

/** Every artist, as a list or a grid of round pictures, in the saved sort order. */
export function ArtistsScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const browse = useBrowse();
  const reducedMotion = useReducedMotion();
  const view = sanitizeArtistView(useSettings((s) => s.artistsView));
  const listRef = useRef<FlashListRef<SortedArtist>>(null);
  const firstVisible = useRef(0);

  const artists = useQuery({
    queryKey: [...queryKeys.library.artists(), view.sort, view.descending],
    queryFn: () => listAllArtists(db, view.sort, view.descending),
  });
  const data = useMemo(() => artists.data ?? [], [artists.data]);
  const letters = useMemo(() => firstIndexes(data.map((a) => a.letter)), [data]);
  const grid = view.layout === 'grid';
  const { tileWidth, cellStyle } = useFixedGrid(view.columns);
  const showRail = isAlphabetical(view.sort) && data.length >= RAIL_MIN_ARTISTS;
  const layoutKey = grid ? `grid-${view.columns}` : 'list';

  useEffect(() => {
    const index = firstVisible.current;
    if (index > 0) {
      requestAnimationFrame(() => listRef.current?.scrollToIndex({ index, animated: false }));
    }
  }, [layoutKey]);

  const header = (
    <Stack.Screen
      options={headerActions([
        { icon: 'sort', label: 'View and Sort', onPress: () => router.push({ pathname: '/view-options', params: { list: 'artists' } }) },
      ])}
    />
  );

  if (artists.data && data.length === 0) {
    return (
      <>
        {header}
        <EmptyScreen icon="artist" title="No artists yet" message="Artists appear here once your music is scanned." />
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
          numColumns={grid ? view.columns : 1}
          keyExtractor={(artist) => String(artist.id)}
          getItemType={() => layoutKey}
          ListHeaderComponent={
            <Text variant="subhead" color="secondary" style={styles.count}>
              {formatCount(data.length, 'artist')}
            </Text>
          }
          renderItem={({ item, index }) =>
            grid ? (
              <View style={cellStyle(index)}>
                <ArtistTile artist={item} width={tileWidth} compact={view.columns === 4} onOpen={browse.artist} />
              </View>
            ) : (
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
            )
          }
          onViewableItemsChanged={({ viewableItems }) => {
            const first = viewableItems[0]?.index;
            if (typeof first === 'number') firstVisible.current = first;
          }}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{
            paddingHorizontal: grid ? GRID_OUTER : 0,
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

const ArtistTile = memo(function ArtistTile({
  artist,
  width,
  compact,
  onOpen,
}: {
  artist: SortedArtist;
  width: number;
  compact: boolean;
  onOpen: (id: number) => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={() => onOpen(artist.id)}
      accessibilityRole="button"
      accessibilityLabel={`${artist.name}, ${formatCount(artist.songCount, 'song')}`}
      style={({ pressed }) => [{ width }, styles.tile, pressed && styles.pressed]}
    >
      <AlbumArtwork
        albumId={artist.albumId}
        artworkKey={artist.artworkKey}
        size={width}
        shape="circle"
        placeholderTitle={artist.name}
      />
      <Text variant={compact ? 'caption' : 'subhead'} numberOfLines={1} align="center" style={styles.tileName}>
        {artist.name}
      </Text>
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
  tile: {
    alignItems: 'center',
  },
  tileName: {
    marginTop: t.spacing.sm,
    fontWeight: '500',
    alignSelf: 'stretch',
  },
  pressed: {
    opacity: t.motion.pressedOpacity,
    transform: [{ scale: t.motion.pressedScale }],
  },
}));
