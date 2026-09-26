import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useReducedMotion, useTheme } from '@/design';
import { AlbumArtwork } from '@/features/library/components/AlbumArtwork';
import { tapHaptic } from '@/lib/haptics';

import { skipToNext, skipToPrevious } from '../playerService';
import type { QueueItem } from '../queue';

export const ARTWORK_RADIUS = 20;
/** Artwork size while paused, so the cover "sinks back" when the music stops. */
const PAUSED_SCALE = 0.92;
/** How far (points) or how fast (points/second) a swipe must go to change the song. */
const SWIPE_DISTANCE = 80;
const SWIPE_VELOCITY = 700;
/** The cover follows the finger at this fraction, so it feels attached but heavy. */
const DRAG_FOLLOW = 0.6;

function swipeToNext() {
  tapHaptic();
  skipToNext();
}

function swipeToPrevious() {
  tapHaptic();
  skipToPrevious();
}

type Props = {
  item: QueueItem;
  size: number;
  isPlaying: boolean;
  /** The cover is drawn by the background (Artwork Bleed): keep only the swipe area. */
  hidden?: boolean;
};

/**
 * Large square cover. Shrinks a little while paused and springs back on play.
 * Swipe left for the next song, right for the previous one.
 */
export function PlayerArtwork({ item, size, isPlaying, hidden = false }: Props) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(isPlaying ? 1 : PAUSED_SCALE);
  const dragX = useSharedValue(0);

  useEffect(() => {
    const target = isPlaying ? 1 : PAUSED_SCALE;
    scale.set(reducedMotion ? target : withSpring(target, theme.motion.spring.gentle));
  }, [isPlaying, reducedMotion, scale, theme.motion.spring.gentle]);

  const swipe = Gesture.Pan()
    // Horizontal only: vertical drags keep closing the player.
    .activeOffsetX([-12, 12])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      dragX.set(e.translationX * DRAG_FOLLOW);
    })
    .onEnd((e) => {
      const next = e.translationX < -SWIPE_DISTANCE || e.velocityX < -SWIPE_VELOCITY;
      const previous = e.translationX > SWIPE_DISTANCE || e.velocityX > SWIPE_VELOCITY;
      if (next) {
        scheduleOnRN(swipeToNext);
      } else if (previous) {
        scheduleOnRN(swipeToPrevious);
      }
      dragX.set(withSpring(0, theme.motion.spring.snappy));
    })
    .onFinalize(() => {
      if (dragX.get() !== 0) {
        dragX.set(withSpring(0, theme.motion.spring.snappy));
      }
    });

  const animated = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(dragX.get()), [0, size], [1, 0.5], 'clamp'),
    transform: [
      { translateX: dragX.get() },
      { rotateZ: `${interpolate(dragX.get(), [-size, size], [-4, 4], 'clamp')}deg` },
      { scale: scale.get() },
    ],
  }));

  return (
    <GestureDetector gesture={swipe}>
      <Animated.View
        style={[!hidden && theme.shadows.artwork, styles.frame, { width: size, height: size }, animated]}
        accessible
        accessibilityRole="image"
        accessibilityLabel={item.album ? `${item.album} artwork` : 'Artwork'}
        accessibilityActions={[
          { name: 'next', label: 'Next song' },
          { name: 'previous', label: 'Previous song' },
        ]}
        onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'next' ? skipToNext() : skipToPrevious())}
      >
        {hidden ? null : (
          <AlbumArtwork
            albumId={item.albumId}
            artworkKey={item.artworkUri}
            size={size}
            radius={ARTWORK_RADIUS}
            placeholderIcon="song"
          />
        )}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: ARTWORK_RADIUS,
    borderCurve: 'continuous',
    // Softer and wider than the list shadow: the cover floats above the background.
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
});
