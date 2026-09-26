import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { db } from '@/db/client';
import { queryKeys } from '@/db/queryKeys';
import { getSongInfo } from '@/db/repos/browse';
import { setFavorite } from '@/db/repos/favorites';
import { Icon, Marquee, makeStyles, useReducedMotion, useTheme } from '@/design';

import type { QueueItem } from '../queue';

/** Artist line opacity: clearly secondary, still well above 4.5:1 on the player backgrounds. */
const SECONDARY_OPACITY = 0.6;

/** Song title and artist (left-aligned, long titles scroll) with the like button on the right. */
export function TrackInfo({ item }: { item: QueueItem }) {
  const styles = useStyles();

  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Marquee key={`t${item.key}`} variant="playerTitle" accessibilityRole="header">
          {item.title}
        </Marquee>
        <Marquee key={`a${item.key}`} variant="callout" style={styles.artist}>
          {item.artist}
        </Marquee>
      </View>
      <LikeButton songId={item.songId} />
    </View>
  );
}

function LikeButton({ songId }: { songId: number }) {
  const theme = useTheme();
  const styles = useStyles();
  const client = useQueryClient();
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);

  const song = useQuery({
    queryKey: ['song', songId],
    queryFn: () => getSongInfo(db, songId) ?? null,
  });
  const liked = song.data?.isFavorite ?? false;

  const toggle = () => {
    setFavorite(db, 'song', songId, !liked);
    client.invalidateQueries({ queryKey: ['song', songId] });
    client.invalidateQueries({ queryKey: queryKeys.favorites.all });
    if (!reducedMotion) {
      // Squeeze, then pop back with a little overshoot.
      scale.set(withSequence(withTiming(0.75, { duration: 90 }), withSpring(1, theme.motion.spring.bouncy)));
    }
  };

  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel={liked ? 'Remove from Favorites' : 'Add to Favorites'}
      accessibilityState={{ selected: liked }}
      hitSlop={8}
      style={styles.like}
    >
      <Animated.View style={animated}>
        <Icon
          name={liked ? 'favoriteFilled' : 'favorite'}
          size={theme.sizes.icon.xl}
          color={liked ? theme.colors.accent : theme.colors.textPrimary}
        />
      </Animated.View>
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  artist: {
    opacity: SECONDARY_OPACITY,
  },
  like: {
    width: t.sizes.touchTarget,
    height: t.sizes.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    // Line the heart's edge up with the right margin.
    marginRight: -t.spacing.sm,
  },
}));
