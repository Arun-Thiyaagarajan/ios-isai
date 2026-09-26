import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';

import { db } from '@/db/client';
import { queryKeys } from '@/db/queryKeys';
import { getLibraryCounts, listRecentlyAddedAlbums, type LibraryCounts } from '@/db/repos/browse';
import { Icon, ListRow, SectionHeader, Text, makeStyles, useTheme, type IconName } from '@/design';

import { AlbumTile } from '../components/AlbumTile';
import { useBrowse } from '../navigation';
import { rescanLibrary } from '../scanService';
import { useScanStore } from '../scanStore';

const categories: {
  screen: 'songs' | 'albums' | 'artists' | 'genres' | 'folders';
  title: string;
  icon: IconName;
  count: keyof LibraryCounts;
}[] = [
  { screen: 'songs', title: 'Songs', icon: 'song', count: 'songs' },
  { screen: 'albums', title: 'Albums', icon: 'album', count: 'albums' },
  { screen: 'artists', title: 'Artists', icon: 'artist', count: 'artists' },
  { screen: 'genres', title: 'Genres', icon: 'genre', count: 'genres' },
  { screen: 'folders', title: 'Folders', icon: 'folder', count: 'folders' },
];

const RECENT_TILE_WIDTH = 150;

/** Library landing page: the ways to browse, then recently added albums. */
export function LibraryHome() {
  const theme = useTheme();
  const styles = useStyles();
  const browse = useBrowse();
  const scanning = useScanStore((s) => s.status === 'scanning');
  const [refreshing, setRefreshing] = useState(false);

  const counts = useQuery({ queryKey: queryKeys.library.counts(), queryFn: () => getLibraryCounts(db) });
  const recent = useQuery({
    queryKey: queryKeys.library.recentAlbums(),
    queryFn: () => listRecentlyAddedAlbums(db, 12),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await rescanLibrary();
    setRefreshing(false);
  }, []);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: theme.colors.bg }}
      contentContainerStyle={styles.bottom}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {categories.map((category) => (
        <ListRow
          key={category.screen}
          title={category.title}
          onPress={() => browse.list(category.screen)}
          leading={<Icon name={category.icon} color={theme.colors.accentText} />}
          trailing={
            <View style={styles.trailing}>
              <Text variant="callout" color="secondary" tabular>
                {counts.data ? counts.data[category.count].toLocaleString() : ''}
              </Text>
              <Icon name="chevronRight" size={theme.sizes.icon.md} color={theme.colors.textTertiary} />
            </View>
          }
        />
      ))}
      {scanning ? (
        <Text variant="footnote" color="secondary" style={styles.status}>
          Updating your library…
        </Text>
      ) : null}

      {recent.data && recent.data.length > 0 ? (
        <>
          <SectionHeader title="Recently Added" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carousel}
          >
            {recent.data.map((album) => (
              <AlbumTile
                key={album.id}
                album={album}
                width={RECENT_TILE_WIDTH}
                onPress={() => browse.album(album.id)}
              />
            ))}
          </ScrollView>
        </>
      ) : null}
    </ScrollView>
  );
}

const useStyles = makeStyles((t) => ({
  bottom: {
    paddingBottom: t.spacing.max,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
  },
  status: {
    paddingHorizontal: t.gutter,
    paddingTop: t.spacing.sm,
  },
  carousel: {
    paddingHorizontal: t.gutter,
    gap: t.spacing.md,
  },
}));
