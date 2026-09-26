import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { db } from '@/db/client';
import { queryKeys } from '@/db/queryKeys';
import { listPlaylistSummaries } from '@/db/repos/browse';
import { listFavoriteIds } from '@/db/repos/favorites';
import { EmptyState, Icon, ListRow, useTheme } from '@/design';
import { AlbumArtwork } from '@/features/library/components/AlbumArtwork';
import { formatCount } from '@/lib/format';

/** Favorites first, then the user's playlists A–Z. */
export function PlaylistsScreen() {
  const theme = useTheme();
  const playlists = useQuery({ queryKey: queryKeys.playlists.list(), queryFn: () => listPlaylistSummaries(db) });
  const favorites = useQuery({
    queryKey: [...queryKeys.favorites.all, 'count'],
    queryFn: () => listFavoriteIds(db, 'song').length,
  });

  const chevron = <Icon name="chevronRight" size={theme.sizes.icon.md} color={theme.colors.textTertiary} />;

  return (
    <FlashList
      data={playlists.data ?? []}
      keyExtractor={(playlist) => String(playlist.id)}
      ListHeaderComponent={
        <ListRow
          title="Favorites"
          subtitle={formatCount(favorites.data ?? 0, 'song')}
          onPress={() => router.push('/(tabs)/(playlists)/favorites')}
          leading={<Icon name="favoriteFilled" color={theme.colors.accentText} />}
          trailing={chevron}
        />
      }
      renderItem={({ item }) => (
        <ListRow
          title={item.name}
          subtitle={formatCount(item.songCount, 'song')}
          onPress={() =>
            router.push({ pathname: '/(tabs)/(playlists)/playlist/[id]', params: { id: String(item.id) } })
          }
          leading={
            <AlbumArtwork
              albumId={item.albumId}
              artworkKey={item.artworkKey}
              size={theme.sizes.artworkRow}
              placeholderIcon="playlists"
            />
          }
          trailing={chevron}
        />
      )}
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
      style={{ backgroundColor: theme.colors.bg }}
    />
  );
}
