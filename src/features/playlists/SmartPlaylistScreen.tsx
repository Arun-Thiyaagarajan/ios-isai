import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { db } from '@/db/client';
import { queryKeys } from '@/db/queryKeys';
import { SMART_PLAYLISTS, isSmartPlaylistId, listSmartPlaylist } from '@/db/repos/smartPlaylists';
import { EmptyScreen, Text, makeStyles } from '@/design';
import { TrackRow } from '@/features/library/components/TrackRow';
import { SelectionBar, useSongSelection } from '@/features/library/selection';
import { playSongs } from '@/features/player/playerService';
import { PlayShuffleButtons } from '@/features/player/PlayShuffleButtons';
import { openSongActions } from '@/features/player/songActions';
import { headerActions } from '@/features/shell/headerActions';
import { formatCount } from '@/lib/format';

const EMPTY_MESSAGES = {
  onRepeat: 'Songs you play this month will appear here.',
  topSongs: 'Songs you listen to appear here once they’ve been played.',
  recentlyAdded: 'Nothing new in the last 30 days.',
  forgotten: 'Songs you played often but haven’t heard in two months will show up here.',
  neverPlayed: 'You’ve played everything in your library. Impressive!',
} as const;

/** A smart playlist: filled automatically from your library and listening history. */
export function SmartPlaylistScreen() {
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const selection = useSongSelection();
  const valid = isSmartPlaylistId(id);

  const songs = useQuery({
    // Tied to history, so plays and scans refresh it.
    queryKey: [...queryKeys.history.all, 'smart', id],
    queryFn: () => (valid ? listSmartPlaylist(db, id) : []),
    enabled: valid,
  });

  if (!valid) {
    return <EmptyScreen icon="playlists" title="Playlist not found" />;
  }
  const definition = SMART_PLAYLISTS[id];
  const list = songs.data ?? [];
  const ids = list.filter((s) => s.isPlayable).map((s) => s.id);
  const context = { type: 'playlist' as const, name: definition.name };

  if (songs.data && list.length === 0) {
    return (
      <>
        <Stack.Screen options={{ title: definition.name }} />
        <EmptyScreen icon="playlists" title={definition.name} message={EMPTY_MESSAGES[id]} />
      </>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: definition.name,
          ...headerActions(
            selection.active
              ? [
                  { icon: 'selectAll', label: 'Select All', onPress: () => selection.setAll(ids) },
                  { icon: 'check', label: 'Done', onPress: selection.done },
                ]
              : [{ icon: 'select', label: 'Select', onPress: selection.start }],
          ),
        }}
      />
      <FlashList
        data={list}
        extraData={selection.selected}
        keyExtractor={(song) => String(song.id)}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text variant="subhead" color="secondary">
              {definition.description} · {formatCount(list.length, 'song')}
            </Text>
            <PlayShuffleButtons songIds={ids} context={context} />
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
                  ? () => playSongs(ids, ids.indexOf(item.id), { context })
                  : undefined
            }
            onMore={() => openSongActions(item.id)}
          />
        )}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.bottom, selection.active && styles.bottomSelecting]}
        style={styles.screen}
      />
      <SelectionBar selection={selection} orderedIds={ids} context={context} />
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
    paddingVertical: t.spacing.md,
    gap: t.spacing.md,
  },
  bottom: {
    paddingBottom: t.spacing.max,
  },
  bottomSelecting: {
    paddingBottom: t.spacing.max * 2.5,
  },
}));
