import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { memo, useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { db } from '@/db/client';
import { queryKeys } from '@/db/queryKeys';
import { listPlaylistSummaries, type PlaylistSummary } from '@/db/repos/browse';
import { listFavoriteIds } from '@/db/repos/favorites';
import { SMART_PLAYLIST_IDS, SMART_PLAYLISTS } from '@/db/repos/smartPlaylists';
import { EmptyState, Icon, IconTile, ListRow, SectionHeader, Text, makeStyles, useReducedMotion, useTheme } from '@/design';
import { AlbumArtwork } from '@/features/library/components/AlbumArtwork';
import { useFixedGrid } from '@/features/library/components/useGridLayout';
import { sanitizePlaylistView, type PlaylistSort } from '@/features/library/viewOptions';
import { useSettings } from '@/features/settings/settingsStore';
import { formatCount } from '@/lib/format';

function openPlaylist(id: number) {
  router.push({ pathname: '/(tabs)/(playlists)/playlist/[id]', params: { id: String(id) } });
}

/** Sorts playlists in memory (there are only ever a handful to a few hundred). */
function sortPlaylists(list: PlaylistSummary[], sort: PlaylistSort, descending: boolean): PlaylistSummary[] {
  const byName = (a: PlaylistSummary, b: PlaylistSummary) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  const compare =
    sort === 'name'
      ? byName
      : sort === 'songs'
        ? (a: PlaylistSummary, b: PlaylistSummary) => a.songCount - b.songCount || byName(a, b)
        : (a: PlaylistSummary, b: PlaylistSummary) => a.updatedAt - b.updatedAt || byName(a, b);
  const sorted = [...list].sort(compare);
  return descending ? sorted.reverse() : sorted;
}

/** Favorites, the smart playlists, then your own playlists (list or grid, in the saved order). */
export function PlaylistsScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const reducedMotion = useReducedMotion();
  const view = sanitizePlaylistView(useSettings((s) => s.playlistsView));
  const grid = view.layout === 'grid';
  const { tileWidth, edgeCellStyle } = useFixedGrid(view.columns);

  const playlists = useQuery({ queryKey: queryKeys.playlists.list(), queryFn: () => listPlaylistSummaries(db) });
  const favorites = useQuery({
    queryKey: [...queryKeys.favorites.all, 'count'],
    queryFn: () => listFavoriteIds(db, 'song').length,
  });
  const data = useMemo(
    () => sortPlaylists(playlists.data ?? [], view.sort, view.descending),
    [playlists.data, view.sort, view.descending],
  );

  const chevron = <Icon name="chevronRight" size={theme.sizes.icon.md} color={theme.colors.textTertiary} />;
  const layoutKey = grid ? `grid-${view.columns}` : 'list';

  const header = (
    <View>
      <ListRow
        title="Favorites"
        subtitle={formatCount(favorites.data ?? 0, 'song')}
        onPress={() => router.push('/(tabs)/(playlists)/favorites')}
        leading={<IconTile name="favoriteFilled" />}
        trailing={chevron}
      />
      <SectionHeader title="Smart Playlists" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.smartRow}>
        {SMART_PLAYLIST_IDS.map((id) => (
          <Pressable
            key={id}
            onPress={() => router.push({ pathname: '/(tabs)/(playlists)/smart/[id]', params: { id } })}
            accessibilityRole="button"
            accessibilityLabel={`${SMART_PLAYLISTS[id].name}. ${SMART_PLAYLISTS[id].description}`}
            style={({ pressed }) => [styles.smartCard, pressed && styles.pressed]}
          >
            <Icon name="smart" size={theme.sizes.icon.md} color={theme.colors.accentText} />
            <Text variant="headline" numberOfLines={1}>
              {SMART_PLAYLISTS[id].name}
            </Text>
            <Text variant="caption" color="secondary" numberOfLines={2}>
              {SMART_PLAYLISTS[id].description}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {data.length > 0 ? <SectionHeader title="Your Playlists" /> : null}
    </View>
  );

  return (
    <Animated.View key={layoutKey} style={styles.screen} entering={reducedMotion ? undefined : FadeIn.duration(220)}>
      <FlashList
        data={data}
        numColumns={grid ? view.columns : 1}
        keyExtractor={(playlist) => String(playlist.id)}
        getItemType={() => layoutKey}
        ListHeaderComponent={header}
        renderItem={({ item, index }) =>
          grid ? (
            <View style={edgeCellStyle(index)}>
              <PlaylistTile playlist={item} width={tileWidth} compact={view.columns === 4} />
            </View>
          ) : (
            <ListRow
              title={item.name}
              subtitle={formatCount(item.songCount, 'song')}
              onPress={() => openPlaylist(item.id)}
              leading={
                <AlbumArtwork
                  albumId={item.albumId}
                  artworkKey={item.artworkKey}
                  size={theme.sizes.artworkRow}
                  placeholderTitle={item.name}
                />
              }
              trailing={chevron}
            />
          )
        }
        ListEmptyComponent={
          playlists.data ? (
            <EmptyState
              icon="playlists"
              title="No playlists yet"
              message="Make your own mixes. Add songs from any song’s menu with Add to Playlist."
              actionLabel="New Playlist"
              onAction={() => router.push('/playlist-edit')}
            />
          ) : null
        }
        contentInsetAdjustmentBehavior="automatic"
        // The header rows span the full width; only grid tiles use the grid padding (on their cells).
        contentContainerStyle={{ paddingBottom: theme.spacing.max }}
        style={styles.screen}
      />
    </Animated.View>
  );
}

const PlaylistTile = memo(function PlaylistTile({
  playlist,
  width,
  compact,
}: {
  playlist: PlaylistSummary;
  width: number;
  compact: boolean;
}) {
  const theme = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      onPress={() => openPlaylist(playlist.id)}
      accessibilityRole="button"
      accessibilityLabel={`${playlist.name}, ${formatCount(playlist.songCount, 'song')}`}
      style={({ pressed }) => [{ width }, pressed && styles.pressed]}
    >
      <View style={theme.shadows.card}>
        <AlbumArtwork
          albumId={playlist.albumId}
          artworkKey={playlist.artworkKey}
          size={width}
          radius={compact ? theme.radius.sm : theme.radius.md}
          placeholderTitle={playlist.name}
        />
      </View>
      <Text variant={compact ? 'caption' : 'subhead'} numberOfLines={1} style={styles.tileTitle}>
        {playlist.name}
      </Text>
      <Text variant="caption" color="secondary" numberOfLines={1}>
        {formatCount(playlist.songCount, 'song')}
      </Text>
    </Pressable>
  );
});

const useStyles = makeStyles((t) => ({
  screen: {
    flex: 1,
    backgroundColor: t.colors.bg,
  },
  smartRow: {
    paddingHorizontal: t.gutter,
    gap: t.spacing.md,
    paddingBottom: t.spacing.sm,
  },
  smartCard: {
    width: 156,
    minHeight: 112,
    padding: t.spacing.md,
    gap: t.spacing.xs,
    borderRadius: t.radius.lg,
    borderCurve: 'continuous',
    backgroundColor: t.colors.card,
    ...t.shadows.card,
  },
  tileTitle: {
    marginTop: t.spacing.sm,
    fontWeight: '500',
  },
  pressed: {
    opacity: t.motion.pressedOpacity,
    transform: [{ scale: t.motion.pressedScale }],
  },
}));

