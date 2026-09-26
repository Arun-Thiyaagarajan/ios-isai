import { memo } from 'react';
import { View } from 'react-native';

import type { TrackItem } from '@/db/repos/browse';
import { IconButton, ListRow, Text, makeStyles, useTheme } from '@/design';
import { formatDuration } from '@/lib/format';

import { usePlayerStore } from '@/features/player/playerStore';

import { AlbumArtwork } from './AlbumArtwork';

type Props = {
  track: TrackItem;
  /** Album pages show track numbers; everywhere else shows artwork. */
  leading?: 'artwork' | 'number';
  /** Hide the album name when the whole list is one album. */
  showAlbum?: boolean;
  /** Hide the artist when every song has the same one (e.g. a single-artist album). */
  showArtist?: boolean;
  /** Replaces the subtitle, e.g. "File missing" in playlists. */
  note?: string;
  /** Highlights the row as the song that's playing. */
  active?: boolean;
  onPress?: () => void;
  /** Opens the song's actions (Play Next, Add to Playlist…). Also triggered by a long press. */
  onMore?: () => void;
};

export const TrackRow = memo(function TrackRow({
  track,
  leading = 'artwork',
  showAlbum = true,
  showArtist = true,
  note,
  active,
  onPress,
  onMore,
}: Props) {
  const theme = useTheme();
  const styles = useStyles();
  // Only rows whose "is playing" answer changes re-render when the song changes.
  const isCurrent = usePlayerStore((s) => s.queue.items[s.queue.index]?.songId === track.id);

  const subtitle = note
    ? note
    : !track.isPlayable
    ? 'Format not supported'
    : [showArtist && track.artist, showAlbum && track.album].filter(Boolean).join(' · ') || undefined;

  return (
    <ListRow
      title={track.title}
      subtitle={subtitle}
      onPress={onPress}
      onLongPress={onMore}
      active={active ?? isCurrent}
      accessibilityActions={onMore ? [{ name: 'longpress', label: 'More actions' }] : undefined}
      onAccessibilityAction={onMore ? () => onMore() : undefined}
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
        <View style={styles.trailing}>
          <Text variant="footnote" color="secondary" tabular>
            {formatDuration(track.durationMs)}
          </Text>
          {onMore ? (
            <IconButton icon="more" label={`More actions for ${track.title}`} onPress={onMore} size={36} iconSize={theme.sizes.icon.md} />
          ) : null}
        </View>
      }
    />
  );
});

const useStyles = makeStyles((t) => ({
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xxs,
  },
  number: {
    width: t.spacing.xxxl,
    alignItems: 'center',
  },
}));
