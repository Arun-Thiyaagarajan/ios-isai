import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { View } from 'react-native';

import { db } from '@/db/client';
import { queryKeys } from '@/db/queryKeys';
import { listFavoriteSongs } from '@/db/repos/browse';
import { EmptyScreen, makeStyles } from '@/design';
import { TrackRow } from '@/features/library/components/TrackRow';
import { playSongs } from '@/features/player/playerService';
import { PlayShuffleButtons } from '@/features/player/PlayShuffleButtons';
import { openSongActions } from '@/features/player/songActions';

export function FavoritesScreen() {
  const styles = useStyles();
  const songs = useQuery({ queryKey: [...queryKeys.favorites.all, 'songs'], queryFn: () => listFavoriteSongs(db) });
  const list = songs.data ?? [];
  const ids = list.filter((s) => s.isPlayable).map((s) => s.id);

  if (songs.data && list.length === 0) {
    return (
      <EmptyScreen
        icon="favorite"
        title="No favorites yet"
        message="Tap the heart in the player, or choose Add to Favorites from any song’s menu."
      />
    );
  }

  return (
    <FlashList
      data={list}
      keyExtractor={(song) => String(song.id)}
      ListHeaderComponent={
        <View style={styles.header}>
          <PlayShuffleButtons songIds={ids} />
        </View>
      }
      renderItem={({ item }) => (
        <TrackRow
          track={item}
          onPress={item.isPlayable ? () => playSongs(ids, ids.indexOf(item.id)) : undefined}
          onMore={() => openSongActions(item.id)}
        />
      )}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.bottom}
      style={styles.list}
    />
  );
}

const useStyles = makeStyles((t) => ({
  list: {
    backgroundColor: t.colors.bg,
  },
  header: {
    paddingHorizontal: t.gutter,
    paddingVertical: t.spacing.md,
  },
  bottom: {
    paddingBottom: t.spacing.max,
  },
}));
