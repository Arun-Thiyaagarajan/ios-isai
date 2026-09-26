import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

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
import { listSongIds } from '@/db/repos/player';
import { Button, EmptyScreen, IconButton, SectionHeader, Text, makeStyles, useTheme } from '@/design';
import { AlbumArtwork } from '@/features/library/components/AlbumArtwork';
import { AlbumTile } from '@/features/library/components/AlbumTile';
import { TrackRow } from '@/features/library/components/TrackRow';
import { useBrowse } from '@/features/library/navigation';
import { scanLibrary } from '@/features/library/scanService';
import { useScanStore } from '@/features/library/scanStore';
import { playSongs, togglePlayPause } from '@/features/player/playerService';
import { useCurrentItem, useIsPlaying } from '@/features/player/playerStore';
import { openSongActions } from '@/features/player/songActions';
import { useSettings } from '@/features/settings/settingsStore';
import { formatCount } from '@/lib/format';

import { SongTile } from './SongTile';

const TILE = 140;
const CAROUSEL_LIMIT = 15;

function greeting(hour = new Date().getHours()) {
  if (hour < 5) return 'Late night listening';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await scanLibrary();
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
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: theme.colors.bg }}
      contentContainerStyle={styles.bottom}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.intro}>
        {showGreeting ? <Text variant="title2">{greeting()}</Text> : null}
        <Text variant="subhead" color="secondary">
          {formatCount(songCount, 'song')} in your library
        </Text>
      </View>

      <View style={styles.quickActions}>
        <Button
          label="Shuffle All"
          icon="shuffle"
          fill
          onPress={() => playSongs(listSongIds(db), 0, { shuffle: true })}
        />
        {favoriteIds.length > 0 ? (
          <Button
            label="Favorites"
            icon="favoriteFilled"
            variant="secondary"
            fill
            onPress={() => playSongs(favoriteIds, 0, { shuffle: true })}
          />
        ) : null}
      </View>

      <ContinueListening />

      {recentList.length > 0 ? (
        <>
          <SectionHeader title="Recently Played" onAction={() => router.push('/(tabs)/(home)/recent')} />
          <Carousel>
            {recentList.map((track) => (
              <SongTile
                key={track.id}
                track={track}
                width={TILE}
                onPress={() => playSongs(recentIds, Math.max(0, recentIds.indexOf(track.id)))}
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
              onPress={track.isPlayable ? () => playSongs(mostIds, mostIds.indexOf(track.id)) : undefined}
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
                onPress={() => playSongs(favoriteIds, Math.max(0, favoriteIds.indexOf(track.id)))}
                onLongPress={() => openSongActions(track.id)}
              />
            ))}
          </Carousel>
        </>
      ) : null}
    </ScrollView>
  );
}

const useStyles = makeStyles((t) => ({
  bottom: {
    paddingBottom: t.spacing.max + t.sizes.miniPlayer,
  },
  intro: {
    paddingHorizontal: t.gutter,
    paddingTop: t.spacing.sm,
    gap: t.spacing.xxs,
  },
  quickActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    paddingHorizontal: t.gutter,
    paddingTop: t.spacing.lg,
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
