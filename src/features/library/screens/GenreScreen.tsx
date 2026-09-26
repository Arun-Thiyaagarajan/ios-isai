import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { db } from '@/db/client';
import { queryKeys } from '@/db/queryKeys';
import { getGenre, listGenreSongs } from '@/db/repos/browse';
import { EmptyScreen, makeStyles, Text, useTheme } from '@/design';
import { formatCount } from '@/lib/format';

import { playSongs } from '@/features/player/playerService';
import { PlayShuffleButtons } from '@/features/player/PlayShuffleButtons';
import { openSongActions } from '@/features/player/songActions';

import { TrackRow } from '../components/TrackRow';

export function GenreScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const genreId = Number(useLocalSearchParams<{ id: string }>().id);

  const genre = useQuery({ queryKey: queryKeys.library.genre(genreId), queryFn: () => getGenre(db, genreId) ?? null });
  const songs = useQuery({
    queryKey: [...queryKeys.library.genre(genreId), 'songs'],
    queryFn: () => listGenreSongs(db, genreId),
  });

  const playableIds = (songs.data ?? []).filter((s) => s.isPlayable).map((s) => s.id);

  if (genre.data === null) {
    return <EmptyScreen icon="genre" title="Genre not found" />;
  }

  return (
    <>
      <Stack.Screen options={{ title: genre.data?.name ?? '' }} />
      <FlashList
        data={songs.data ?? []}
        keyExtractor={(song) => String(song.id)}
        ListHeaderComponent={
          <View style={styles.header}>
            <PlayShuffleButtons songIds={playableIds} context={{ type: 'genre', name: genre.data?.name ?? '' }} />
            <Text variant="footnote" color="secondary">
              {formatCount(songs.data?.length ?? 0, 'song')}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TrackRow
            track={item}
            onPress={item.isPlayable ? () => playSongs(playableIds, playableIds.indexOf(item.id), {
                    context: { type: 'genre', name: genre.data?.name ?? '' },
                  }) : undefined}
            onMore={() => openSongActions(item.id)}
          />
        )}
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: theme.colors.bg }}
      />
    </>
  );
}

const useStyles = makeStyles((t) => ({
  header: {
    paddingHorizontal: t.gutter,
    paddingVertical: t.spacing.sm,
    gap: t.spacing.md,
  },
}));
