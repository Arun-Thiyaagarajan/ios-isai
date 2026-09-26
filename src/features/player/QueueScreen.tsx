import { FlashList } from '@shopify/flash-list';
import { memo } from 'react';
import { View } from 'react-native';

import { Icon, IconButton, ListRow, Text, makeStyles, useTheme } from '@/design';
import { AlbumArtwork } from '@/features/library/components/AlbumArtwork';

import { clearUpNext, removeFromQueue, skipTo, toggleShuffle } from './playerService';
import { useIsPlaying, usePlayerStore } from './playerStore';
import type { QueueItem } from './queue';

const QueueRow = memo(function QueueRow({
  item,
  position,
  current,
}: {
  item: QueueItem;
  position: number;
  current?: boolean;
}) {
  const theme = useTheme();
  return (
    <ListRow
      title={item.title}
      subtitle={item.artist}
      active={current}
      onPress={current ? undefined : () => skipTo(position)}
      accessibilityHint={current ? undefined : 'Plays this song now'}
      leading={
        <AlbumArtwork albumId={item.albumId} artworkKey={item.artworkUri} size={theme.sizes.artworkRow} placeholderIcon="song" />
      }
      trailing={
        current ? null : (
          <IconButton
            icon="remove"
            label={`Remove ${item.title} from the queue`}
            onPress={() => removeFromQueue(position)}
            iconSize={theme.sizes.icon.md}
          />
        )
      }
    />
  );
});

/** What's playing and what comes next. Tap a song to jump to it; remove songs you don't want. */
export function QueueScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const queue = usePlayerStore((s) => s.queue);
  const isPlaying = useIsPlaying();
  const current = queue.items[queue.index];
  const upNext = queue.items.slice(queue.index + 1);

  if (!current) {
    return (
      <View style={styles.empty}>
        <Text variant="headline" align="center">
          The queue is empty
        </Text>
        <Text variant="subhead" color="secondary" align="center">
          Play a song, or use Play Next and Add to Queue from any song’s menu.
        </Text>
      </View>
    );
  }

  return (
    <FlashList
      data={upNext}
      keyExtractor={(item) => item.key}
      renderItem={({ item, index }) => <QueueRow item={item} position={queue.index + 1 + index} />}
      ListHeaderComponent={
        <View>
          <Text variant="title2" accessibilityRole="header" style={styles.heading}>
            {isPlaying ? 'Now Playing' : 'Paused'}
          </Text>
          <QueueRow item={current} position={queue.index} current />
          <View style={styles.upNextHeader}>
            <Text variant="headline" accessibilityRole="header" style={styles.flex}>
              Up Next
            </Text>
            <IconButton
              icon="shuffle"
              label={queue.shuffle ? 'Shuffle on' : 'Shuffle off'}
              selected={queue.shuffle}
              onPress={toggleShuffle}
              iconSize={theme.sizes.icon.md}
            />
            <IconButton
              icon="delete"
              label="Clear Up Next"
              onPress={clearUpNext}
              disabled={upNext.length === 0}
              iconSize={theme.sizes.icon.md}
            />
          </View>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.upNextEmpty}>
          <Icon name="queue" color={theme.colors.textTertiary} />
          <Text variant="subhead" color="secondary" align="center">
            Nothing up next. Use Play Next or Add to Queue from any song’s menu.
          </Text>
        </View>
      }
      contentContainerStyle={styles.bottom}
      style={{ backgroundColor: theme.colors.bgElevated }}
    />
  );
}

const useStyles = makeStyles((t) => ({
  heading: {
    paddingHorizontal: t.gutter,
    paddingTop: t.spacing.xl,
    paddingBottom: t.spacing.xs,
  },
  upNextHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: t.gutter,
    paddingRight: t.spacing.sm,
    paddingTop: t.spacing.lg,
  },
  flex: {
    flex: 1,
  },
  upNextEmpty: {
    alignItems: 'center',
    gap: t.spacing.sm,
    paddingHorizontal: t.spacing.xxxl,
    paddingVertical: t.spacing.xxl,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    gap: t.spacing.sm,
    padding: t.spacing.xxxl,
    backgroundColor: t.colors.bgElevated,
  },
  bottom: {
    paddingBottom: t.spacing.max,
  },
}));
