import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { IconButton, Surface, Text, makeStyles, useTheme } from '@/design';
import { AlbumArtwork } from '@/features/library/components/AlbumArtwork';

import { skipToNext, togglePlayPause } from './playerService';
import { useCurrentItem, useIsPlaying } from './playerStore';
import { useProgress } from './useProgress';

const ARTWORK = 40;

function ProgressLine() {
  const theme = useTheme();
  const { positionMs, durationMs } = useProgress(500);
  const fraction = durationMs > 0 ? Math.min(1, positionMs / durationMs) : 0;
  return (
    <View style={[styles.track, { backgroundColor: theme.colors.progressTrack }]}>
      <View style={[styles.fill, { width: `${fraction * 100}%`, backgroundColor: theme.colors.progressFill }]} />
    </View>
  );
}

type Props = {
  /** `accessory`: inside the iOS 26 tab bar accessory (the system draws the glass background). */
  variant?: 'floating' | 'accessory';
};

/** The song that's playing, above the tab bar. Tap to open Now Playing. */
export function MiniPlayer({ variant = 'floating' }: Props) {
  const theme = useTheme();
  const local = useStyles();
  const item = useCurrentItem();
  const isPlaying = useIsPlaying();

  if (!item) {
    return null;
  }

  const content = (
    <Pressable
      style={local.row}
      onPress={() => router.push('/player')}
      accessibilityRole="button"
      accessibilityLabel={`Now playing: ${item.title}, ${item.artist}. Opens the player.`}
    >
      <AlbumArtwork albumId={item.albumId} artworkKey={item.artworkUri} size={ARTWORK} placeholderIcon="song" />
      <View style={local.text}>
        <Text variant="subhead" numberOfLines={1} style={local.title}>
          {item.title}
        </Text>
        <Text variant="footnote" color="secondary" numberOfLines={1}>
          {item.artist}
        </Text>
      </View>
      <IconButton
        icon={isPlaying ? 'pause' : 'play'}
        label={isPlaying ? 'Pause' : 'Play'}
        onPress={togglePlayPause}
        iconSize={theme.sizes.icon.lg}
      />
      <IconButton icon="next" label="Next song" onPress={skipToNext} iconSize={theme.sizes.icon.lg} />
    </Pressable>
  );

  if (variant === 'accessory') {
    return content;
  }

  return (
    <View style={local.floatingWrap}>
      <Surface variant="glass" style={local.floating}>
        {content}
        <ProgressLine />
      </Surface>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    paddingLeft: t.spacing.sm,
    paddingRight: t.spacing.xs,
    minHeight: t.sizes.miniPlayer - 8,
    flex: 1,
  },
  text: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  title: {
    fontWeight: '600',
  },
  floatingWrap: {
    paddingHorizontal: t.spacing.sm,
    paddingBottom: t.spacing.sm,
  },
  floating: {
    borderRadius: t.radius.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surfaceHigh,
  },
}));

const styles = StyleSheet.create({
  track: {
    height: 2,
  },
  fill: {
    height: 2,
  },
});
