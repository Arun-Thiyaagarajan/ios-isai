import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { db } from '@/db/client';
import { queryKeys } from '@/db/queryKeys';
import { getAlbum, getSongInfo } from '@/db/repos/browse';
import { setFavorite } from '@/db/repos/favorites';
import { EmptyState, IconButton, Text, makeStyles, useTheme } from '@/design';
import { AlbumArtwork } from '@/features/library/components/AlbumArtwork';

import {
  cycleRepeat,
  skipToNext,
  skipToPrevious,
  togglePlayPause,
  toggleShuffle,
} from './playerService';
import { useCurrentItem, useIsPlaying, usePlayerStore } from './playerStore';
import { ProgressBar } from './ProgressBar';

/** The classic Now Playing layout: large artwork, song details, seek bar and controls. */
export function NowPlayingScreen() {
  const theme = useTheme();
  const local = useStyles();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const client = useQueryClient();

  const item = useCurrentItem();
  const isPlaying = useIsPlaying();
  const shuffle = usePlayerStore((s) => s.queue.shuffle);
  const repeat = usePlayerStore((s) => s.repeat);

  const album = useQuery({
    queryKey: queryKeys.library.album(item?.albumId ?? -1),
    queryFn: () => (item?.albumId ? (getAlbum(db, item.albumId) ?? null) : null),
    enabled: item?.albumId != null,
  });
  const song = useQuery({
    queryKey: ['song', item?.songId],
    queryFn: () => (item ? (getSongInfo(db, item.songId) ?? null) : null),
    enabled: item != null,
  });

  if (!item) {
    return (
      <View style={[local.screen, { paddingTop: insets.top }]}>
        <EmptyState icon="song" title="Nothing playing" message="Choose a song from your library to start listening." />
      </View>
    );
  }

  // iOS shows the player as a sheet that already starts below the status bar; Android is full screen.
  const topInset = Platform.OS === 'ios' ? 0 : insets.top;
  const artworkSize = Math.min(width - theme.spacing.xxl * 2, height * 0.44);
  const isFavorite = song.data?.isFavorite ?? false;
  const tint = album.data?.colorPrimary;

  const toggleFavorite = () => {
    setFavorite(db, 'song', item.songId, !isFavorite);
    client.invalidateQueries({ queryKey: ['song', item.songId] });
    client.invalidateQueries({ queryKey: queryKeys.favorites.all });
  };

  return (
    <View style={local.screen}>
      {/* A soft wash of the artwork's color at the top; it fades into the theme background. */}
      {tint ? (
        <LinearGradient
          colors={[`${tint}88`, `${tint}00`]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.75 }}
          pointerEvents="none"
        />
      ) : null}

      <View
        style={[
          local.content,
          { paddingTop: topInset + theme.spacing.sm, paddingBottom: insets.bottom + theme.spacing.lg },
        ]}
      >
        <View style={local.topBar}>
          <IconButton icon="chevronDown" label="Close player" onPress={() => router.back()} />
          <Text variant="footnote" color="secondary" numberOfLines={1} style={local.context}>
            {item.album ?? ''}
          </Text>
          <IconButton
            icon="more"
            label="More actions"
            onPress={() =>
              router.push({ pathname: '/song-actions', params: { songId: String(item.songId), from: 'player' } })
            }
          />
        </View>

        <View style={local.artworkArea}>
          <View style={[local.artworkShadow, { borderRadius: theme.radius.lg }]}>
            <AlbumArtwork
              albumId={item.albumId}
              artworkKey={item.artworkUri}
              size={artworkSize}
              placeholderColor={tint}
              placeholderIcon="song"
            />
          </View>
        </View>

        <View style={local.titleRow}>
          <View style={local.titleText}>
            <Text variant="title2" numberOfLines={1}>
              {item.title}
            </Text>
            <Text variant="callout" color="secondary" numberOfLines={1}>
              {item.artist}
            </Text>
          </View>
          <IconButton
            icon={isFavorite ? 'favoriteFilled' : 'favorite'}
            label={isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
            selected={isFavorite}
            onPress={toggleFavorite}
          />
        </View>

        <ProgressBar />

        <View style={local.controls}>
          <IconButton icon="shuffle" label={shuffle ? 'Shuffle on' : 'Shuffle off'} selected={shuffle} onPress={toggleShuffle} />
          <IconButton icon="previous" label="Previous" onPress={skipToPrevious} size={56} iconSize={theme.sizes.icon.xl + 4} />
          <IconButton
            icon={isPlaying ? 'pause' : 'play'}
            label={isPlaying ? 'Pause' : 'Play'}
            variant="filled"
            size={theme.sizes.playButton}
            iconSize={theme.sizes.icon.xl + 6}
            onPress={togglePlayPause}
          />
          <IconButton icon="next" label="Next" onPress={skipToNext} size={56} iconSize={theme.sizes.icon.xl + 4} />
          <IconButton
            icon={repeat === 'one' ? 'repeatOne' : 'repeat'}
            label={repeat === 'off' ? 'Repeat off' : repeat === 'all' ? 'Repeat all' : 'Repeat one'}
            selected={repeat !== 'off'}
            onPress={cycleRepeat}
          />
        </View>

        {/* Extra height goes here, so everything above stays anchored near the top. */}
        <View style={local.spacer} />

        <View style={local.bottomRow}>
          <IconButton icon="queue" label="Queue" onPress={() => router.push('/queue')} />
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  screen: {
    flex: 1,
    backgroundColor: t.colors.playerBg,
  },
  content: {
    flex: 1,
    paddingHorizontal: t.spacing.xxl,
    gap: t.spacing.lg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: -t.spacing.sm,
  },
  context: {
    flex: 1,
    textAlign: 'center',
  },
  artworkArea: {
    alignItems: 'center',
    paddingTop: t.spacing.sm,
    paddingBottom: t.spacing.md,
  },
  spacer: {
    flex: 1,
  },
  artworkShadow: {
    ...t.shadows.artwork,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
  },
  titleText: {
    flex: 1,
    minWidth: 0,
    gap: t.spacing.xxs,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
