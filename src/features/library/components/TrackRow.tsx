import { memo } from 'react';
import { View } from 'react-native';

import type { TrackItem } from '@/db/repos/browse';
import { ListRow, Text, makeStyles, useTheme } from '@/design';
import { formatDuration } from '@/lib/format';

import { AlbumArtwork } from './AlbumArtwork';

type Props = {
  track: TrackItem;
  /** Album pages show track numbers; everywhere else shows artwork. */
  leading?: 'artwork' | 'number';
  /** Hide the album name when the whole list is one album. */
  showAlbum?: boolean;
  /** Hide the artist when every song has the same one (e.g. a single-artist album). */
  showArtist?: boolean;
  onPress?: () => void;
};

export const TrackRow = memo(function TrackRow({
  track,
  leading = 'artwork',
  showAlbum = true,
  showArtist = true,
  onPress,
}: Props) {
  const theme = useTheme();
  const styles = useStyles();

  const subtitle = !track.isPlayable
    ? 'Format not supported'
    : [showArtist && track.artist, showAlbum && track.album].filter(Boolean).join(' · ') || undefined;

  return (
    <ListRow
      title={track.title}
      subtitle={subtitle}
      onPress={onPress}
      accessibilityLabel={`${track.title}, ${track.artist}, ${formatDuration(track.durationMs)}`}
      leading={
        leading === 'artwork' ? (
          <AlbumArtwork
            albumId={track.albumId}
            artworkKey={track.artworkKey}
            size={theme.sizes.artworkRow}
            placeholderIcon="song"
          />
        ) : (
          <View style={styles.number}>
            <Text variant="callout" color="tertiary" tabular>
              {track.trackNo ?? '–'}
            </Text>
          </View>
        )
      }
      trailing={
        <Text variant="footnote" color="secondary" tabular>
          {formatDuration(track.durationMs)}
        </Text>
      }
    />
  );
});

const useStyles = makeStyles((t) => ({
  number: {
    width: t.spacing.xxxl,
    alignItems: 'center',
  },
}));
