import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { View } from 'react-native';

import { db } from '@/db/client';
import { queryKeys } from '@/db/queryKeys';
import { listMostPlayedTracks, listRecentlyPlayedTracks, type TrackItem } from '@/db/repos/browse';
import { EmptyScreen, makeStyles } from '@/design';
import { TrackRow } from '@/features/library/components/TrackRow';
import { playSongs } from '@/features/player/playerService';
import type { PlayContext } from '@/features/player/playerStore';
import { PlayShuffleButtons } from '@/features/player/PlayShuffleButtons';
import { openSongActions } from '@/features/player/songActions';
import { formatCount } from '@/lib/format';

const HISTORY_LIMIT = 100;

function TrackListScreen({
  tracks,
  empty,
  note,
  context,
}: {
  tracks: TrackItem[] | undefined;
  empty: { title: string; message: string };
  note?: (track: TrackItem) => string | undefined;
  context: PlayContext;
}) {
  const styles = useStyles();
  const list = tracks ?? [];
  const ids = list.filter((t) => t.isPlayable).map((t) => t.id);

  if (tracks && list.length === 0) {
    return <EmptyScreen icon="song" title={empty.title} message={empty.message} />;
  }

  return (
    <FlashList
      data={list}
      keyExtractor={(track) => String(track.id)}
      ListHeaderComponent={
        <View style={styles.header}>
          <PlayShuffleButtons songIds={ids} context={context} />
        </View>
      }
      renderItem={({ item }) => (
        <TrackRow
          track={item}
          note={note?.(item)}
          onPress={item.isPlayable ? () => playSongs(ids, ids.indexOf(item.id), { context }) : undefined}
          onMore={() => openSongActions(item.id)}
        />
      )}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.bottom}
      style={styles.list}
    />
  );
}

export function RecentlyPlayedScreen() {
  const tracks = useQuery({
    queryKey: [...queryKeys.history.all, 'recent', 'all'],
    queryFn: () => listRecentlyPlayedTracks(db, HISTORY_LIMIT),
  });
  return (
    <TrackListScreen
      tracks={tracks.data}
      context={{ type: 'recent', name: 'Recently Played' }}
      empty={{ title: 'Nothing played yet', message: 'Songs you play will appear here.' }}
    />
  );
}

export function MostPlayedScreen() {
  const tracks = useQuery({
    queryKey: [...queryKeys.history.all, 'most', 'all'],
    queryFn: () => listMostPlayedTracks(db, HISTORY_LIMIT),
  });
  return (
    <TrackListScreen
      tracks={tracks.data}
      context={{ type: 'mostPlayed', name: 'Most Played' }}
      empty={{ title: 'No plays yet', message: 'Songs you listen to all the way through are counted here.' }}
      note={(track) =>
        'playCount' in track ? `${track.artist} · ${formatCount(track.playCount as number, 'play')}` : undefined
      }
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
