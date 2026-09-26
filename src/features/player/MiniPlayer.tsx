import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { router } from 'expo-router';
import { useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, View } from 'react-native';

import { IconButton, Surface, Text, makeStyles, useReducedMotion, useTheme } from '@/design';
import { AlbumArtwork } from '@/features/library/components/AlbumArtwork';
import { useSettings } from '@/features/settings/settingsStore';
import { PlayerThemeProvider, usePlayerTheme } from '@/theme/player/PlayerThemeProvider';

import { skipToNext, skipToPrevious, togglePlayPause } from './playerService';
import { useCurrentItem, useIsPlaying } from './playerStore';
import type { QueueItem } from './queue';
import { useProgress } from './useProgress';

/** How far a horizontal swipe must travel to change songs. */
const SWIPE_THRESHOLD = 56;

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

/**
 * Swipe left for the next song, right for the previous one. The content follows the finger,
 * slides out when the swipe counts, and comes back in from the other side.
 */
function useSwipeToSkip() {
  const reducedMotion = useReducedMotion();
  const enabled = useSettings((s) => s.miniPlayerSwipe);
  const [offset] = useState(() => new Animated.Value(0));

  const responder = PanResponder.create({
    // Only claim clearly horizontal drags, so taps and vertical scrolling still work.
    onMoveShouldSetPanResponder: (_, g) =>
      enabled && Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderMove: (_, g) => offset.setValue(g.dx),
    onPanResponderRelease: (_, g) => {
      const direction = g.dx <= -SWIPE_THRESHOLD ? -1 : g.dx >= SWIPE_THRESHOLD ? 1 : 0;
      if (direction === 0) {
        Animated.spring(offset, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
        return;
      }
      if (direction < 0) skipToNext();
      else skipToPrevious();
      if (reducedMotion) {
        offset.setValue(0);
        return;
      }
      Animated.timing(offset, { toValue: direction * 160, duration: 120, useNativeDriver: true }).start(() => {
        offset.setValue(-direction * 60);
        Animated.spring(offset, { toValue: 0, useNativeDriver: true, bounciness: 2 }).start();
      });
    },
    onPanResponderTerminate: () => {
      Animated.spring(offset, { toValue: 0, useNativeDriver: true }).start();
    },
  });

  const opacity = offset.interpolate({ inputRange: [-160, 0, 160], outputRange: [0.2, 1, 0.2], extrapolate: 'clamp' });
  return { handlers: responder.panHandlers, style: { transform: [{ translateX: offset }], opacity } };
}

function Controls({ compact }: { compact?: boolean }) {
  const theme = useTheme();
  const isPlaying = useIsPlaying();
  const size = compact ? 36 : undefined;
  return (
    <>
      <IconButton
        icon={isPlaying ? 'pause' : 'play'}
        label={isPlaying ? 'Pause' : 'Play'}
        onPress={togglePlayPause}
        size={size}
        iconSize={compact ? theme.sizes.icon.md : theme.sizes.icon.lg}
      />
      <IconButton
        icon="next"
        label="Next song"
        onPress={skipToNext}
        size={size}
        iconSize={compact ? theme.sizes.icon.md : theme.sizes.icon.lg}
      />
    </>
  );
}

function open() {
  router.push('/player');
}

/** iOS 26 accessory content. The system draws the glass capsule; this fills it. */
function AccessoryContent({ item }: { item: QueueItem }) {
  const local = useStyles();
  const placement = NativeTabs.BottomAccessory.usePlacement();
  const swipe = useSwipeToSkip();
  const inline = placement === 'inline';

  return (
    <View style={local.accessory}>
      <Animated.View style={[local.flexRow, swipe.style]} {...swipe.handlers}>
        <Pressable
          style={local.accessoryInfo}
          onPress={open}
          accessibilityRole="button"
          accessibilityLabel={`Now playing: ${item.title}, ${item.artist}. Opens the player.`}
          accessibilityHint="Swipe left or right to change songs"
        >
          {inline ? null : (
            <AlbumArtwork albumId={item.albumId} artworkKey={item.artworkUri} size={32} placeholderIcon="song" />
          )}
          <View style={local.text}>
            <Text variant={inline ? 'footnote' : 'subhead'} numberOfLines={1} style={local.title}>
              {item.title}
            </Text>
            {inline ? null : (
              <Text variant="caption" color="secondary" numberOfLines={1}>
                {item.artist}
              </Text>
            )}
          </View>
        </Pressable>
      </Animated.View>
      <Controls compact />
    </View>
  );
}

type Props = {
  /** `accessory`: inside the iOS 26 tab bar accessory (the system draws the glass background). */
  variant?: 'floating' | 'accessory';
};

/** The song that's playing, above the tab bar. Tap to open Now Playing; swipe to change songs. */
export function MiniPlayer({ variant = 'floating' }: Props) {
  const item = useCurrentItem();

  if (!item) {
    return null;
  }

  if (variant === 'accessory') {
    // iOS 26: the system draws the glass capsule, so it keeps the app's own colors.
    return <AccessoryContent item={item} />;
  }

  // Elsewhere the bar takes the song's color (the Solid player theme, so text stays readable).
  return (
    <PlayerThemeProvider item={item} themeId="solid">
      <FloatingMiniPlayer item={item} />
    </PlayerThemeProvider>
  );
}

function FloatingMiniPlayer({ item }: { item: QueueItem }) {
  const theme = useTheme();
  const local = useStyles();
  const swipe = useSwipeToSkip();
  const { tokens } = usePlayerTheme();

  return (
    <View style={[local.floatingWrap, theme.shadows.card]}>
      <Surface variant="tonal" style={[local.floating, { backgroundColor: tokens.background }]}>
        <View style={local.row}>
          <Animated.View style={[local.flexRow, swipe.style]} {...swipe.handlers}>
            <Pressable
              style={local.info}
              onPress={open}
              accessibilityRole="button"
              accessibilityLabel={`Now playing: ${item.title}, ${item.artist}. Opens the player.`}
              accessibilityHint="Swipe left or right to change songs"
            >
              <AlbumArtwork albumId={item.albumId} artworkKey={item.artworkUri} size={40} placeholderIcon="song" />
              <View style={local.text}>
                <Text variant="subhead" numberOfLines={1} style={local.title}>
                  {item.title}
                </Text>
                <Text variant="footnote" color="secondary" numberOfLines={1}>
                  {item.artist}
                </Text>
              </View>
            </Pressable>
          </Animated.View>
          <Controls />
        </View>
        <ProgressLine />
      </Surface>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  // iOS 26 accessory: fills the system capsule, everything vertically centered.
  accessory: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: t.spacing.md,
    paddingRight: t.spacing.xs,
    gap: t.spacing.xxs,
  },
  accessoryInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
  },
  flexRow: {
    flex: 1,
    minWidth: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: t.sizes.miniPlayer - t.spacing.sm,
    paddingLeft: t.spacing.sm,
    paddingRight: t.spacing.xs,
  },
  info: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
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
    borderCurve: 'continuous',
    overflow: 'hidden',
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
