import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { db } from '@/db/client';
import { queryKeys } from '@/db/queryKeys';
import {
  listeningSummary,
  monthlyMinutes,
  periodStart,
  topAlbums,
  topArtists,
  topSongs,
  type StatsPeriod,
} from '@/db/repos/stats';
import { EmptyState, SectionHeader, Text, makeStyles, useTheme } from '@/design';
import { AlbumArtwork } from '@/features/library/components/AlbumArtwork';
import { useBrowse } from '@/features/library/navigation';
import { playSongs } from '@/features/player/playerService';
import { formatCount } from '@/lib/format';
import { selectionHaptic } from '@/lib/haptics';

const PERIODS: { value: StatsPeriod; label: string }[] = [
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
  { value: 'all', label: 'All Time' },
];

const MONTH_LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const CHART_HEIGHT = 120;

/** "1,234" minutes, or "20 hr 34 min" once it's long enough to be easier read in hours. */
function formatMinutes(minutes: number): string {
  if (minutes < 120) return formatCount(minutes, 'minute');
  return `${Math.floor(minutes / 60).toLocaleString()} hr ${minutes % 60} min`;
}

/** Your listening: time, counts, a 12-month chart and your top songs, artists and albums. */
export function StatsScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const browse = useBrowse();
  const [period, setPeriod] = useState<StatsPeriod>('month');
  const since = periodStart(period);

  const stats = useQuery({
    queryKey: [...queryKeys.history.all, 'stats', period],
    queryFn: () => ({
      summary: listeningSummary(db, since),
      songs: topSongs(db, since, 10),
      artists: topArtists(db, since, 10),
      albums: topAlbums(db, since, 10),
    }),
  });
  const months = useQuery({ queryKey: [...queryKeys.history.all, 'stats', 'months'], queryFn: () => monthlyMinutes(db, 12) });

  const data = stats.data;
  const maxMonth = Math.max(1, ...(months.data ?? []).map((m) => m.minutes));

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.segmented} accessibilityRole="radiogroup">
        {PERIODS.map((option) => {
          const active = option.value === period;
          return (
            <Pressable
              key={option.value}
              onPress={() => {
                selectionHaptic();
                setPeriod(option.value);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              style={[styles.segment, active && styles.segmentActive]}
            >
              <Text variant="subhead" color={active ? 'onAccent' : 'primary'} style={styles.segmentLabel}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {data && data.summary.plays === 0 ? (
        <EmptyState
          icon="stats"
          title="Nothing here yet"
          message="Listen to some music and your stats will appear here. Songs count once you’ve heard 30 seconds."
        />
      ) : data ? (
        <>
          <View style={styles.tiles}>
            <StatTile value={formatMinutes(data.summary.minutes)} label="Listened" wide />
            <StatTile value={data.summary.plays.toLocaleString()} label="Plays" />
            <StatTile value={data.summary.songs.toLocaleString()} label="Songs" />
            <StatTile value={data.summary.artists.toLocaleString()} label="Artists" />
          </View>

          <SectionHeader title="Minutes by Month" />
          <View
            style={styles.chart}
            accessible
            accessibilityLabel={`Minutes listened per month: ${(months.data ?? [])
              .map((m) => `${new Date(m.monthStart).toLocaleString(undefined, { month: 'long' })} ${m.minutes}`)
              .join(', ')}`}
          >
            {(months.data ?? []).map((month, index, all) => {
              const current = index === all.length - 1;
              return (
                <View key={month.monthStart} style={styles.barColumn}>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: Math.max(3, (month.minutes / maxMonth) * CHART_HEIGHT),
                          backgroundColor: current ? theme.colors.accent : theme.colors.progressTrack,
                        },
                      ]}
                    />
                  </View>
                  <Text variant="caption" color={current ? 'primary' : 'secondary'} maxFontSizeMultiplier={1.1}>
                    {MONTH_LETTERS[new Date(month.monthStart).getMonth()]}
                  </Text>
                </View>
              );
            })}
          </View>

          {data.songs.length > 0 ? (
            <>
              <SectionHeader title="Top Songs" />
              {data.songs.map((song, index) => (
                <RankRow
                  key={song.id}
                  rank={index + 1}
                  title={song.title}
                  subtitle={`${song.artist} · ${formatCount(song.plays, 'play')}`}
                  artwork={<AlbumArtwork albumId={song.albumId} artworkKey={song.artworkKey} size={44} placeholderIcon="song" />}
                  onPress={() => playSongs(data.songs.map((s) => s.id), index)}
                />
              ))}
            </>
          ) : null}

          {data.artists.length > 0 ? (
            <>
              <SectionHeader title="Top Artists" />
              {data.artists.map((artist, index) => (
                <RankRow
                  key={artist.name}
                  rank={index + 1}
                  title={artist.name}
                  subtitle={`${formatCount(artist.plays, 'play')} · ${formatMinutes(artist.minutes)}`}
                  artwork={
                    <AlbumArtwork
                      albumId={artist.albumId}
                      artworkKey={artist.artworkKey}
                      size={44}
                      shape="circle"
                      placeholderIcon="artist"
                    />
                  }
                />
              ))}
            </>
          ) : null}

          {data.albums.length > 0 ? (
            <>
              <SectionHeader title="Top Albums" />
              {data.albums.map((album, index) => (
                <RankRow
                  key={album.id}
                  rank={index + 1}
                  title={album.title}
                  subtitle={`${album.artist} · ${formatCount(album.plays, 'play')}`}
                  artwork={<AlbumArtwork albumId={album.id} artworkKey={album.artworkKey} size={44} placeholderTitle={album.title} />}
                  onPress={() => browse.album(album.id)}
                />
              ))}
            </>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

function StatTile({ value, label, wide }: { value: string; label: string; wide?: boolean }) {
  const styles = useStyles();
  return (
    <View style={[styles.tile, wide && styles.tileWide]} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text variant={wide ? 'title1' : 'title2'} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text variant="footnote" color="secondary">
        {label}
      </Text>
    </View>
  );
}

function RankRow({
  rank,
  title,
  subtitle,
  artwork,
  onPress,
}: {
  rank: number;
  title: string;
  subtitle: string;
  artwork: React.ReactNode;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`Number ${rank}: ${title}, ${subtitle}`}
      style={({ pressed }) => [styles.rankRow, pressed && { backgroundColor: theme.colors.surface }]}
    >
      <Text variant="headline" color="secondary" tabular style={styles.rank}>
        {rank}
      </Text>
      {artwork}
      <View style={styles.rankText}>
        <Text variant="body" numberOfLines={1} style={styles.rankTitle}>
          {title}
        </Text>
        <Text variant="footnote" color="secondary" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  screen: {
    flex: 1,
    backgroundColor: t.colors.bg,
  },
  content: {
    paddingTop: t.spacing.md,
    paddingBottom: t.spacing.max,
  },
  segmented: {
    flexDirection: 'row',
    marginHorizontal: t.gutter,
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.md,
    borderCurve: 'continuous',
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: t.radius.sm,
  },
  segmentActive: {
    backgroundColor: t.colors.accent,
  },
  segmentLabel: {
    fontWeight: '600',
  },
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.spacing.md,
    paddingHorizontal: t.gutter,
    paddingTop: t.spacing.xl,
  },
  tile: {
    flexGrow: 1,
    flexBasis: '28%',
    padding: t.spacing.lg,
    gap: t.spacing.xxs,
    borderRadius: t.radius.lg,
    borderCurve: 'continuous',
    backgroundColor: t.colors.card,
    ...t.shadows.card,
  },
  tileWide: {
    flexBasis: '100%',
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: t.spacing.xs,
    paddingHorizontal: t.gutter,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    gap: t.spacing.xs,
  },
  barTrack: {
    height: CHART_HEIGHT,
    justifyContent: 'flex-end',
    alignSelf: 'stretch',
  },
  bar: {
    borderRadius: t.radius.xs,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    paddingHorizontal: t.gutter,
    paddingVertical: t.spacing.sm,
  },
  rank: {
    width: 24,
    textAlign: 'center',
  },
  rankText: {
    flex: 1,
    minWidth: 0,
  },
  rankTitle: {
    fontWeight: '500',
  },
}));
