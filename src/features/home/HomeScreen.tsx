import { useQuery } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useCallback, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import Animated, { useAnimatedScrollHandler } from 'react-native-reanimated';

import { db } from '@/db/client';
import { queryKeys } from '@/db/queryKeys';
import {
  getLibraryCounts,
  listFavoriteSongs,
  listMostPlayedTracks,
  listPlaylistSummaries,
  listRecentlyAddedAlbums,
  listRecentlyPlayedTracks,
} from '@/db/repos/browse';
import { listeningSummary, periodStart, topArtists } from '@/db/repos/stats';
import { listSongIds } from '@/db/repos/player';
import { Button, EmptyScreen, Icon, IconButton, SectionHeader, Text, makeStyles, useTheme } from '@/design';
import { AlbumArtwork } from '@/features/library/components/AlbumArtwork';
import { AlbumTile } from '@/features/library/components/AlbumTile';
import { TrackRow } from '@/features/library/components/TrackRow';
import { useBrowse } from '@/features/library/navigation';
import { rescanLibrary } from '@/features/library/scanService';
import { useScanStore } from '@/features/library/scanStore';
import { playSongs, togglePlayPause } from '@/features/player/playerService';
import { useCurrentItem, useIsPlaying, type PlayContext } from '@/features/player/playerStore';
import { openSongActions } from '@/features/player/songActions';
import { useSettings } from '@/features/settings/settingsStore';
import { formatCount } from '@/lib/format';

import { pickGreeting } from './greetings';
import { HomeBrandHeader, homeScroll } from './HomeBrandHeader';
import { SongTile } from './SongTile';

const TILE = 140;
const CAROUSEL_LIMIT = 15;

const ALL_SONGS: PlayContext = { type: 'songs', name: 'Songs' };
const FAVORITES: PlayContext = { type: 'favorites', name: 'Favorites' };
const RECENT: PlayContext = { type: 'recent', name: 'Recently Played' };
const MOST_PLAYED: PlayContext = { type: 'mostPlayed', name: 'Most Played' };

/** The song that's playing (or paused), with a big play/pause button. Tap to open the player. */
function ContinueListening() {
  const theme = useTheme();
  const styles = useStyles();
  const item = useCurrentItem();
  const isPlaying = useIsPlaying();
  if (!item) return null;

  return (
    <>
      <SectionHeader title={isPlaying ? 'Now Playing' : 'Continue Listening'} />
      <Pressable
        onPress={() => router.push('/player')}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}, ${item.artist}. Opens the player.`}
        style={({ pressed }) => [styles.nowCard, pressed && styles.pressed]}
      >
        <AlbumArtwork albumId={item.albumId} artworkKey={item.artworkUri} size={64} placeholderIcon="song" />
        <View style={styles.nowText}>
          <Text variant="headline" numberOfLines={1}>
            {item.title}
          </Text>
          <Text variant="subhead" color="secondary" numberOfLines={1}>
            {item.artist}
          </Text>
        </View>
        <IconButton
          icon={isPlaying ? 'pause' : 'play'}
          label={isPlaying ? 'Pause' : 'Resume'}
          variant="filled"
          size={48}
          iconSize={theme.sizes.icon.lg}
          onPress={togglePlayPause}
        />
      </Pressable>
    </>
  );
}

/** This month in one line ("3 hr 12 min · mostly A.R. Rahman"); opens Your Listening. */
function ListeningCard() {
  const theme = useTheme();
  const styles = useStyles();
  const stats = useQuery({
    queryKey: [...queryKeys.history.all, 'stats', 'home'],
    queryFn: () => {
      const since = periodStart('month');
      return { summary: listeningSummary(db, since), topArtist: topArtists(db, since, 1)[0]?.name ?? null };
    },
  });
  if (!stats.data || stats.data.summary.plays === 0) return null;
  const { summary, topArtist } = stats.data;
  const time = summary.minutes >= 60 ? `${Math.floor(summary.minutes / 60)} hr ${summary.minutes % 60} min` : `${summary.minutes} min`;

  return (
    <Pressable
      onPress={() => router.push('/(tabs)/(home)/stats')}
      accessibilityRole="button"
      accessibilityLabel={`Your listening this month: ${time}${topArtist ? `, mostly ${topArtist}` : ''}. Opens your stats.`}
      style={({ pressed }) => [styles.listeningCard, pressed && styles.pressed]}
    >
      <View style={styles.listeningIcon}>
        <Icon name="stats" size={theme.sizes.icon.md} color={theme.colors.onAccent} />
      </View>
      <View style={styles.nowText}>
        <Text variant="headline">{time} this month</Text>
        <Text variant="subhead" color="secondary" numberOfLines={1}>
          {topArtist ? `Mostly ${topArtist} · ` : ''}
          {formatCount(summary.songs, 'song')}
        </Text>
      </View>
      <Icon name="chevronRight" size={theme.sizes.icon.sm} color={theme.colors.textTertiary} />
    </Pressable>
  );
}

function Carousel({ children }: { children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
      {children}
    </ScrollView>
  );
}

export function HomeScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const browse = useBrowse();
  const scanStatus = useScanStore((s) => s.status);
  const showGreeting = useSettings((s) => s.showGreeting);
  const profileName = useSettings((s) => s.profileName);
  const [refreshing, setRefreshing] = useState(false);

  const counts = useQuery({ queryKey: queryKeys.library.counts(), queryFn: () => getLibraryCounts(db) });
  const recent = useQuery({
    queryKey: [...queryKeys.history.all, 'recent'],
    queryFn: () => listRecentlyPlayedTracks(db, CAROUSEL_LIMIT),
  });
  const mostPlayed = useQuery({
    queryKey: [...queryKeys.history.all, 'most'],
    queryFn: () => listMostPlayedTracks(db, 5),
  });
  const added = useQuery({
    queryKey: queryKeys.library.recentAlbums(),
    queryFn: () => listRecentlyAddedAlbums(db, 12),
  });
  const favorites = useQuery({
    queryKey: [...queryKeys.favorites.all, 'songs'],
    queryFn: () => listFavoriteSongs(db),
  });
  const playlists = useQuery({ queryKey: queryKeys.playlists.list(), queryFn: () => listPlaylistSummaries(db) });

  // A new greeting each time Home opens, and on pull to refresh (never the same one twice in a row).
  const [greeting, setGreeting] = useState(() => pickGreeting(profileName));
  // Changing your name in the profile updates the greeting straight away.
  const [greetedName, setGreetedName] = useState(profileName);
  if (greetedName !== profileName) {
    setGreetedName(profileName);
    setGreeting(pickGreeting(profileName));
  }
  const headerHeight = useHeaderHeight();
  const onScroll = useAnimatedScrollHandler((event) => {
    // iOS reports the resting position as minus the header inset; count from the top of the content.
    homeScroll.set(event.contentOffset.y + (event.contentInset?.top ?? 0));
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setGreeting((previous) => pickGreeting(useSettings.getState().profileName, undefined, undefined, previous));
    await rescanLibrary();
    setRefreshing(false);
  }, []);

  const songCount = counts.data?.songs ?? 0;
  if (counts.data && songCount === 0 && scanStatus !== 'scanning') {
    return (
      <EmptyScreen
        icon="song"
        title="Welcome to Isai"
        message="Add your music in the Library tab, and your listening will show up here."
        actionLabel="Go to Library"
        onAction={() => router.navigate('/(tabs)/(library)')}
      />
    );
  }

  const recentList = recent.data ?? [];
  const recentIds = recentList.filter((t) => t.isPlayable).map((t) => t.id);
  const favoriteList = (favorites.data ?? []).slice(0, CAROUSEL_LIMIT);
  const favoriteIds = (favorites.data ?? []).filter((t) => t.isPlayable).map((t) => t.id);
  const mostList = mostPlayed.data ?? [];
  const mostIds = mostList.filter((t) => t.isPlayable).map((t) => t.id);

  return (
    <Animated.ScrollView
      onScroll={onScroll}
      // Android: the bar floats over the page, so start the content below it.
      contentContainerStyle={[styles.bottom, Platform.OS === 'android' && { paddingTop: headerHeight }]}
      scrollEventThrottle={16}
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: theme.colors.bg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Stack.Screen
        options={{
          // The top bar is translucent: the page scrolls under a soft blur instead of a solid bar.
          headerTransparent: true,
          headerShadowVisible: false,
          headerBlurEffect: theme.scheme === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight',
          // Android has no live blur here; a lightly see-through bar gives the same layered look.
          headerStyle: Platform.OS === 'android' ? { backgroundColor: `${theme.colors.bg}E6` } : undefined,
        }}
      />
      <View style={styles.intro}>
        <HomeBrandHeader />
        {showGreeting ? (
          <Text variant="title2" style={styles.greeting}>
            {greeting}
          </Text>
        ) : null}
        <Text variant="subhead" color="secondary">
          {formatCount(songCount, 'song')} in your library
        </Text>
      </View>

      <View style={styles.quickActions}>
        <Button
          label="Shuffle All"
          icon="shuffle"
          fill
          onPress={() => playSongs(listSongIds(db), 0, { shuffle: true, context: ALL_SONGS })}
        />
        {favoriteIds.length > 0 ? (
          <Button
            label="Favorites"
            icon="favoriteFilled"
            variant="secondary"
            fill
            onPress={() => playSongs(favoriteIds, 0, { shuffle: true, context: FAVORITES })}
          />
        ) : null}
      </View>

      <ContinueListening />

      <ListeningCard />

      {recentList.length > 0 ? (
        <>
          <SectionHeader title="Recently Played" onAction={() => router.push('/(tabs)/(home)/recent')} />
          <Carousel>
            {recentList.map((track) => (
              <SongTile
                key={track.id}
                track={track}
                width={TILE}
                onPress={() => playSongs(recentIds, Math.max(0, recentIds.indexOf(track.id)), { context: RECENT })}
                onLongPress={() => openSongActions(track.id)}
              />
            ))}
          </Carousel>
        </>
      ) : null}

      {(added.data?.length ?? 0) > 0 ? (
        <>
          <SectionHeader title="Recently Added" onAction={() => browse.list('albums')} />
          <Carousel>
            {added.data!.map((album) => (
              <AlbumTile key={album.id} album={album} width={TILE} onPress={() => browse.album(album.id)} />
            ))}
          </Carousel>
        </>
      ) : null}

      {mostList.length > 0 ? (
        <>
          <SectionHeader title="Most Played" onAction={() => router.push('/(tabs)/(home)/most-played')} />
          {mostList.map((track) => (
            <TrackRow
              key={track.id}
              track={track}
              note={`${track.artist} · ${formatCount(track.playCount, 'play')}`}
              onPress={track.isPlayable ? () => playSongs(mostIds, mostIds.indexOf(track.id), { context: MOST_PLAYED }) : undefined}
              onMore={() => openSongActions(track.id)}
            />
          ))}
        </>
      ) : null}

      {(playlists.data?.length ?? 0) > 0 ? (
        <>
          <SectionHeader title="Your Playlists" onAction={() => router.navigate('/(tabs)/(playlists)')} />
          <Carousel>
            {playlists.data!.map((playlist) => (
              <Pressable
                key={playlist.id}
                accessibilityRole="button"
                accessibilityLabel={`${playlist.name}, ${formatCount(playlist.songCount, 'song')}`}
                onPress={() =>
                  router.push({ pathname: '/(tabs)/(home)/playlist/[id]', params: { id: String(playlist.id) } })
                }
                style={({ pressed }) => [{ width: TILE }, pressed && styles.pressed]}
              >
                <AlbumArtwork
                  albumId={playlist.albumId}
                  artworkKey={playlist.artworkKey}
                  size={TILE}
                  placeholderIcon="playlists"
                />
                <Text variant="subhead" numberOfLines={1} style={styles.tileTitle}>
                  {playlist.name}
                </Text>
                <Text variant="footnote" color="secondary" numberOfLines={1}>
                  {formatCount(playlist.songCount, 'song')}
                </Text>
              </Pressable>
            ))}
          </Carousel>
        </>
      ) : null}

      {favoriteList.length > 0 ? (
        <>
          <SectionHeader title="Favorites" onAction={() => router.push('/(tabs)/(home)/favorites')} />
          <Carousel>
            {favoriteList.map((track) => (
              <SongTile
                key={track.id}
                track={track}
                width={TILE}
                onPress={() => playSongs(favoriteIds, Math.max(0, favoriteIds.indexOf(track.id)), { context: FAVORITES })}
                onLongPress={() => openSongActions(track.id)}
              />
            ))}
          </Carousel>
        </>
      ) : null}
    </Animated.ScrollView>
  );
}

const useStyles = makeStyles((t) => ({
  bottom: {
    paddingBottom: t.spacing.max + t.sizes.miniPlayer,
  },
  intro: {
    paddingHorizontal: t.gutter,
    paddingTop: t.spacing.sm,
    gap: t.spacing.xs,
  },
  greeting: {
    marginTop: t.spacing.sm,
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    paddingHorizontal: t.gutter,
    paddingTop: t.spacing.lg,
  },
  listeningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    marginHorizontal: t.gutter,
    marginTop: t.spacing.lg,
    padding: t.spacing.md,
    borderRadius: t.radius.lg,
    borderCurve: 'continuous',
    backgroundColor: t.colors.card,
    ...t.shadows.card,
  },
  listeningIcon: {
    width: 44,
    height: 44,
    borderRadius: t.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.accent,
  },
  nowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    marginHorizontal: t.gutter,
    padding: t.spacing.md,
    borderRadius: t.radius.lg,
    borderCurve: 'continuous',
    backgroundColor: t.colors.card,
  },
  nowText: {
    flex: 1,
    minWidth: 0,
    gap: t.spacing.xxs,
  },
  carousel: {
    paddingHorizontal: t.gutter,
    gap: t.spacing.md,
  },
  tileTitle: {
    marginTop: t.spacing.sm,
    fontWeight: '500',
  },
  pressed: {
    opacity: t.motion.pressedOpacity,
  },
}));
