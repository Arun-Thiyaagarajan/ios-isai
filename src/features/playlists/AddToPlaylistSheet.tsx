import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView } from 'react-native';

import { db } from '@/db/client';
import { queryKeys } from '@/db/queryKeys';
import { listPlaylistSummaries } from '@/db/repos/browse';
import { addSongsToPlaylist } from '@/db/repos/playlists';
import { Icon, ListRow, Text, makeStyles, useTheme } from '@/design';
import { AlbumArtwork } from '@/features/library/components/AlbumArtwork';
import { formatCount } from '@/lib/format';

/** Pick a playlist to add songs to, or create a new one. */
export function AddToPlaylistSheet() {
  const theme = useTheme();
  const styles = useStyles();
  const client = useQueryClient();
  const { songIds = '' } = useLocalSearchParams<{ songIds?: string }>();
  const ids = songIds.split(',').map(Number).filter(Number.isFinite);

  const playlists = useQuery({ queryKey: queryKeys.playlists.list(), queryFn: () => listPlaylistSummaries(db) });

  const addTo = (playlistId: number) => {
    addSongsToPlaylist(db, playlistId, ids);
    client.invalidateQueries({ queryKey: queryKeys.playlists.all });
    router.back();
  };

  return (
    <ScrollView style={{ backgroundColor: theme.colors.bgElevated }} contentContainerStyle={styles.content}>
      <Text variant="title2" accessibilityRole="header" style={styles.heading}>
        Add to Playlist
      </Text>
      <ListRow
        title="New Playlist…"
        onPress={() => router.replace({ pathname: '/playlist-edit', params: { songIds } })}
        leading={<Icon name="playlistNew" color={theme.colors.accentText} />}
      />
      {playlists.data?.map((playlist) => (
        <ListRow
          key={playlist.id}
          title={playlist.name}
          subtitle={formatCount(playlist.songCount, 'song')}
          onPress={() => addTo(playlist.id)}
          leading={
            <AlbumArtwork
              albumId={playlist.albumId}
              artworkKey={playlist.artworkKey}
              size={theme.sizes.artworkRow}
              placeholderIcon="playlists"
            />
          }
        />
      ))}
    </ScrollView>
  );
}

const useStyles = makeStyles((t) => ({
  content: {
    paddingBottom: t.spacing.xxxl,
  },
  heading: {
    paddingHorizontal: t.gutter,
    paddingTop: t.spacing.xl,
    paddingBottom: t.spacing.sm,
  },
}));
