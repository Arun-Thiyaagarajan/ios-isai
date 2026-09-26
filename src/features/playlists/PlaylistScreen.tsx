import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import ReorderableList, { reorderItems, type ReorderableListReorderEvent } from 'react-native-reorderable-list';
import { scheduleOnRN } from 'react-native-worklets';

import { db } from '@/db/client';
import { queryKeys } from '@/db/queryKeys';
import { getPlaylistSummary, listPlaylistTracks, type PlaylistTrack } from '@/db/repos/browse';
import { deletePlaylist, movePlaylistEntry } from '@/db/repos/playlists';
import { EmptyScreen, makeStyles, Text } from '@/design';
import { AlbumArtwork } from '@/features/library/components/AlbumArtwork';
import { DragHandle } from '@/features/library/components/DragHandle';
import { TrackRow } from '@/features/library/components/TrackRow';
import { playSongs } from '@/features/player/playerService';
import { PlayShuffleButtons } from '@/features/player/PlayShuffleButtons';
import { openSongActions } from '@/features/player/songActions';
import { headerActions } from '@/features/shell/headerActions';
import { formatCount } from '@/lib/format';
import { selectionHaptic, tapHaptic } from '@/lib/haptics';

function minutes(ms: number) {
  const m = Math.round(ms / 60_000);
  return m >= 60 ? `${Math.floor(m / 60)} hr ${m % 60} min` : `${m} min`;
}

export function PlaylistScreen() {
  const styles = useStyles();
  const client = useQueryClient();
  const playlistId = Number(useLocalSearchParams<{ id: string }>().id);
  const [reordering, setReordering] = useState(false);

  const summary = useQuery({
    queryKey: [...queryKeys.playlists.entries(playlistId), 'summary'],
    queryFn: () => getPlaylistSummary(db, playlistId) ?? null,
  });
  const tracks = useQuery({
    queryKey: queryKeys.playlists.entries(playlistId),
    queryFn: () => listPlaylistTracks(db, playlistId),
  });

  if (summary.data === null) {
    return <EmptyScreen icon="playlists" title="Playlist not found" message="It may have been deleted." />;
  }

  const list = tracks.data ?? [];
  const playable = list.filter((t) => !t.missing && t.isPlayable);
  const playableIds = playable.map((t) => t.id);

  /** Moves a song: shown at once, then saved (positions are fractional, so one row is updated). */
  const move = ({ from, to }: ReorderableListReorderEvent) => {
    const entry = list[from];
    if (!entry || from === to) return;
    client.setQueryData<PlaylistTrack[]>(queryKeys.playlists.entries(playlistId), (old) =>
      old ? reorderItems(old, from, to) : old,
    );
    movePlaylistEntry(db, playlistId, entry.entryId, to);
    client.invalidateQueries({ queryKey: queryKeys.playlists.all });
  };

  const showMenu = () => {
    const name = summary.data?.name ?? 'Playlist';
    Alert.alert(name, undefined, [
      ...(list.length > 1 ? [{ text: 'Reorder Songs', onPress: () => setReordering(true) }] : []),
      { text: 'Rename', onPress: () => router.push({ pathname: '/playlist-edit', params: { playlistId: String(playlistId) } }) },
      {
        text: 'Delete Playlist',
        style: 'destructive',
        onPress: () =>
          Alert.alert(`Delete “${name}”?`, 'The songs stay in your library.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => {
                deletePlaylist(db, playlistId);
                client.invalidateQueries({ queryKey: queryKeys.playlists.all });
                router.back();
              },
            },
          ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: summary.data?.name ?? '',
          ...headerActions(
            reordering
              ? [{ icon: 'check', label: 'Done', onPress: () => setReordering(false) }]
              : [{ icon: 'more', label: 'Playlist options', onPress: showMenu }],
          ),
        }}
      />
      <ReorderableList
        data={list}
        dragEnabled={reordering}
        onReorder={move}
        onDragStart={() => {
          'worklet';
          scheduleOnRN(tapHaptic);
        }}
        onDragEnd={() => {
          'worklet';
          scheduleOnRN(selectionHaptic);
        }}
        keyExtractor={(track) => String(track.entryId)}
        ListHeaderComponent={
          summary.data ? (
            <View style={styles.header}>
              <AlbumArtwork
                albumId={summary.data.albumId}
                artworkKey={summary.data.artworkKey}
                size={200}
                placeholderIcon="playlists"
              />
              <Text variant="title2" align="center" accessibilityRole="header">
                {summary.data.name}
              </Text>
              <Text variant="footnote" color="secondary" align="center">
                {formatCount(summary.data.songCount, 'song')} · {minutes(summary.data.totalDurationMs)}
              </Text>
              <PlayShuffleButtons songIds={playableIds} context={{ type: 'playlist', name: summary.data.name }} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          tracks.data ? (
            <Text variant="subhead" color="secondary" align="center" style={styles.empty}>
              This playlist is empty. Add songs from any song’s menu with Add to Playlist.
            </Text>
          ) : null
        }
        renderItem={({ item, index }) => (
          <TrackRow
            track={item}
            reorderHandle={reordering ? <DragHandle label={`Reorder ${item.title}`} /> : undefined}
            onMoveUp={reordering && index > 0 ? () => move({ from: index, to: index - 1 }) : undefined}
            onMoveDown={reordering && index < list.length - 1 ? () => move({ from: index, to: index + 1 }) : undefined}
            note={item.missing ? 'File missing — it will return if the file comes back' : undefined}
            onPress={
              item.missing || !item.isPlayable
                ? undefined
                : () => playSongs(playableIds, playableIds.indexOf(item.id), {
                    context: { type: 'playlist', name: summary.data?.name ?? '' },
                  })
            }
            onMore={item.missing ? undefined : () => openSongActions(item.id, { playlistId, entryId: item.entryId })}
          />
        )}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.bottom}
        style={styles.list}
      />
    </>
  );
}

const useStyles = makeStyles((t) => ({
  list: {
    backgroundColor: t.colors.bg,
  },
  header: {
    alignItems: 'center',
    gap: t.spacing.sm,
    paddingHorizontal: t.gutter,
    paddingTop: t.spacing.lg,
    paddingBottom: t.spacing.lg,
  },
  empty: {
    paddingHorizontal: t.spacing.xxxl,
    paddingTop: t.spacing.lg,
  },
  bottom: {
    paddingBottom: t.spacing.max,
  },
}));
