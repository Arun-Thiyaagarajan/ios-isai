import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { db } from '@/db/client';
import { getLyrics } from '@/db/repos/lyrics';
import { EmptyState, Text, makeStyles, useTheme } from '@/design';

import { useCurrentItem } from './playerStore';

/** Lyrics of the song that's playing: from the file, or typed in Edit Info. Follows song changes. */
export function LyricsSheet() {
  const theme = useTheme();
  const styles = useStyles();
  const item = useCurrentItem();

  const lyrics = useQuery({
    queryKey: ['lyrics', item?.songId],
    queryFn: () => (item ? getLyrics(db, item.songId) : null),
    enabled: item != null,
  });

  if (!item) {
    return (
      <View style={styles.screen}>
        <EmptyState icon="lyrics" title="Nothing playing" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text variant="headline" numberOfLines={2}>
          {item.title}
        </Text>
        <Text variant="subhead" color="secondary" numberOfLines={1}>
          {item.artist}
        </Text>
      </View>

      {lyrics.data ? (
        <View style={styles.lines}>
          {lyrics.data.lines.map((line, index) =>
            // A blank line between verses becomes a gap.
            line.trim() === '' ? (
              <View key={index} style={{ height: theme.spacing.lg }} />
            ) : (
              <Text key={index} variant="title2" style={styles.line}>
                {line}
              </Text>
            ),
          )}
        </View>
      ) : lyrics.isFetched ? (
        <EmptyState
          icon="lyrics"
          title="No lyrics for this song"
          message="Add them yourself with Edit Info."
          actionLabel="Edit Info"
          onAction={() => router.replace({ pathname: '/edit-song', params: { songId: String(item.songId) } })}
        />
      ) : null}
    </ScrollView>
  );
}

const useStyles = makeStyles((t) => ({
  screen: {
    flex: 1,
    backgroundColor: t.colors.bgElevated,
  },
  content: {
    paddingHorizontal: t.gutter,
    paddingTop: t.spacing.xl,
    paddingBottom: t.spacing.max,
    gap: t.spacing.xl,
  },
  header: {
    gap: t.spacing.xxs,
  },
  lines: {
    gap: t.spacing.sm,
  },
  line: {
    lineHeight: 32,
  },
}));
