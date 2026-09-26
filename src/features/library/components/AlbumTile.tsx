import { memo } from 'react';
import { Pressable } from 'react-native';

import type { AlbumSummary } from '@/db/repos/browse';
import { Text, makeStyles } from '@/design';

import { AlbumArtwork } from './AlbumArtwork';

type Props = {
  album: AlbumSummary;
  width: number;
  onPress: () => void;
};

/** Square artwork with title and artist underneath, for grids and carousels. */
export const AlbumTile = memo(function AlbumTile({ album, width, onPress }: Props) {
  const styles = useStyles();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${album.title}, ${album.artist}`}
      onPress={onPress}
      style={({ pressed }) => [{ width }, pressed && styles.pressed]}
    >
      <AlbumArtwork
        albumId={album.id}
        artworkKey={album.artworkKey}
        size={width}
        placeholderColor={album.colorPrimary}
      />
      <Text variant="subhead" numberOfLines={1} style={styles.title}>
        {album.title}
      </Text>
      <Text variant="subhead" color="secondary" numberOfLines={1}>
        {album.artist}
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
