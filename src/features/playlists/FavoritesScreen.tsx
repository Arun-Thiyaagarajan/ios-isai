import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { View } from 'react-native';

import { db } from '@/db/client';
import { queryKeys } from '@/db/queryKeys';
import { listFavoriteSongs } from '@/db/repos/browse';
import { EmptyScreen, makeStyles } from '@/design';
import { TrackRow } from '@/features/library/components/TrackRow';
import { SelectionBar, useSongSelection } from '@/features/library/selection';
import { playSongs } from '@/features/player/playerService';
import type { PlayContext } from '@/features/player/playerStore';
import { PlayShuffleButtons } from '@/features/player/PlayShuffleButtons';
import { openSongActions } from '@/features/player/songActions';
import { headerActions } from '@/features/shell/headerActions';

const FAVORITES: PlayContext = { type: 'favorites', name: 'Favorites' };

export function FavoritesScreen() {
  const styles = useStyles();
  const selection = useSongSelection();
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
    <View style={styles.screen}>
      <Stack.Screen
        options={headerActions(
          selection.active
            ? [
                { icon: 'selectAll', label: 'Select All', onPress: () => selection.setAll(ids) },
                { icon: 'check', label: 'Done', onPress: selection.done },
              ]
            : [{ icon: 'select', label: 'Select', onPress: selection.start }],
        )}
      />
      <FlashList
        data={list}
        extraData={selection.selected}
        keyExtractor={(song) => String(song.id)}
        ListHeaderComponent={
          <View style={styles.header}>
            <PlayShuffleButtons songIds={ids} context={FAVORITES} />
          </View>
        }
        renderItem={({ item }) => (
          <TrackRow
            track={item}
            selected={selection.active ? selection.isSelected(item.id) : undefined}
            onPress={
              selection.active
                ? () => selection.toggle(item.id)
                : item.isPlayable
                  ? () => playSongs(ids, ids.indexOf(item.id), { context: FAVORITES })
                  : undefined
            }
            onMore={() => openSongActions(item.id)}
          />
        )}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.bottom, selection.active && styles.bottomSelecting]}
        style={styles.list}
      />
      <SelectionBar selection={selection} orderedIds={ids} context={FAVORITES} />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  screen: {
    flex: 1,
  },
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
  bottomSelecting: {
    paddingBottom: t.spacing.max * 2.5,
  },
}));
