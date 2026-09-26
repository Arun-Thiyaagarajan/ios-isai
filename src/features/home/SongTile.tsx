import { memo } from 'react';
import { Pressable } from 'react-native';

import type { TrackItem } from '@/db/repos/browse';
import { Text, makeStyles } from '@/design';
import { AlbumArtwork } from '@/features/library/components/AlbumArtwork';

type Props = {
  track: TrackItem;
  width: number;
  onPress: () => void;
  onLongPress?: () => void;
};

/** Square artwork with song title and artist, for Home carousels. */
export const SongTile = memo(function SongTile({ track, width, onPress, onLongPress }: Props) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${track.title}, ${track.artist}`}
      accessibilityHint="Plays the song. Long press for more actions."
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [{ width }, pressed && styles.pressed]}
    >
      <AlbumArtwork albumId={track.albumId} artworkKey={track.artworkKey} size={width} placeholderIcon="song" />
      <Text variant="subhead" numberOfLines={1} style={styles.title}>
        {track.title}
      </Text>
      <Text variant="footnote" color="secondary" numberOfLines={1}>
        {track.artist}
      </Text>
    </Pressable>
  );
});

const useStyles = makeStyles((t) => ({
  title: {
    marginTop: t.spacing.sm,
    fontWeight: '500',
  },
  pressed: {
    opacity: t.motion.pressedOpacity,
  },
}));
