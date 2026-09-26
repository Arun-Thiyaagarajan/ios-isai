import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { db } from '@/db/client';
import { queryKeys } from '@/db/queryKeys';
import { getSongInfo } from '@/db/repos/browse';
import { setFavorite } from '@/db/repos/favorites';
import { removePlaylistEntries } from '@/db/repos/playlists';
import { Icon, ListRow, Text, makeStyles, useTheme, type IconName } from '@/design';
import { AlbumArtwork } from '@/features/library/components/AlbumArtwork';

import { addToQueue, playNext } from './playerService';

type Action = { icon: IconName; title: string; onPress: () => void; destructive?: boolean };

/** Closes every sheet and modal, then opens a library page. */
function goTo(href: string) {
  router.dismissAll();
  router.push(href as Href);
}

/** The menu for one song: queue it, add it to a playlist, favorite it, or jump to its album/artist. */
export function SongActionsSheet() {
  const theme = useTheme();
  const styles = useStyles();
  const client = useQueryClient();
  const params = useLocalSearchParams<{ songId: string; playlistId?: string; entryId?: string }>();
  const songId = Number(params.songId);

  const song = useQuery({ queryKey: ['song', songId], queryFn: () => getSongInfo(db, songId) ?? null });
  const info = song.data;

  if (!info) {
    return null;
  }

  const close = () => router.back();
  const actions: Action[] = [
    {
      icon: 'playNext',
      title: 'Play Next',
      onPress: () => {
        playNext([songId]);
        close();
      },
    },
    {
      icon: 'addToQueue',
      title: 'Add to Queue',
      onPress: () => {
        addToQueue([songId]);
        close();
      },
    },
    {
      icon: 'addToPlaylist',
      title: 'Add to Playlist…',
      onPress: () => router.replace({ pathname: '/add-to-playlist', params: { songIds: String(songId) } }),
    },
    {
      icon: info.isFavorite ? 'favoriteFilled' : 'favorite',
      title: info.isFavorite ? 'Remove from Favorites' : 'Add to Favorites',
      onPress: () => {
        setFavorite(db, 'song', songId, !info.isFavorite);
        client.invalidateQueries({ queryKey: ['song', songId] });
        client.invalidateQueries({ queryKey: queryKeys.favorites.all });
        close();
      },
    },
  ];
  if (info.albumId !== null) {
    actions.push({ icon: 'album', title: 'Go to Album', onPress: () => goTo(`/(tabs)/(library)/album/${info.albumId}`) });
  }
  if (info.artistId !== null) {
    actions.push({ icon: 'artist', title: 'Go to Artist', onPress: () => goTo(`/(tabs)/(library)/artist/${info.artistId}`) });
  }
  if (params.playlistId && params.entryId) {
    const playlistId = Number(params.playlistId);
    actions.push({
      icon: 'remove',
      title: 'Remove from This Playlist',
      destructive: true,
      onPress: () => {
        removePlaylistEntries(db, playlistId, [Number(params.entryId)]);
        client.invalidateQueries({ queryKey: queryKeys.playlists.all });
        close();
      },
    });
  }

  return (
    <ScrollView style={{ backgroundColor: theme.colors.bgElevated }} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <AlbumArtwork albumId={info.albumId} artworkKey={info.artworkKey} size={56} placeholderIcon="song" />
        <View style={styles.headerText}>
          <Text variant="headline" numberOfLines={2}>
            {info.title}
          </Text>
          <Text variant="subhead" color="secondary" numberOfLines={1}>
            {[info.artist, info.album].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </View>
      {actions.map((action) => (
        <ListRow
          key={action.title}
          title={action.title}
          onPress={action.onPress}
          leading={
            <Icon name={action.icon} color={action.destructive ? theme.colors.danger : theme.colors.accentText} />
          }
        />
      ))}
    </ScrollView>
  );
}

const useStyles = makeStyles((t) => ({
  content: {
    paddingTop: t.spacing.xl,
    paddingBottom: t.spacing.xxxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    paddingHorizontal: t.gutter,
    paddingBottom: t.spacing.md,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    gap: t.spacing.xxs,
  },
}));
