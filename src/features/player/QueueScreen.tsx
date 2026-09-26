import { memo, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ReorderableList, { type ReorderableListReorderEvent } from 'react-native-reorderable-list';
import { scheduleOnRN } from 'react-native-worklets';

import { Icon, IconButton, ListRow, Text, makeStyles, useTheme } from '@/design';
import { AlbumArtwork } from '@/features/library/components/AlbumArtwork';
import { DragHandle } from '@/features/library/components/DragHandle';
import { showToast } from '@/features/shell/toast';
import { selectionHaptic, tapHaptic } from '@/lib/haptics';

import { clearUpNext, moveInQueue, removeFromQueue, skipTo, toggleShuffle } from './playerService';
import { useIsPlaying, usePlayerStore } from './playerStore';
import type { QueueItem } from './queue';

const QueueRow = memo(function QueueRow({
  item,
  position,
  current,
  last,
}: {
  item: QueueItem;
  position: number;
  current?: boolean;
  /** Position of the last song in the queue (for the "Move down" action). */
  last: number;
}) {
  const theme = useTheme();
  const styles = useStyles();
  const firstUpNext = usePlayerStore((s) => s.queue.index + 1);
  return (
    <ListRow
      title={item.title}
      subtitle={item.artist}
      active={current}
      onPress={current ? undefined : () => skipTo(position)}
      accessibilityHint={current ? undefined : 'Plays this song now'}
      accessibilityActions={
        current
          ? undefined
          : [
              ...(position > firstUpNext ? [{ name: 'moveUp', label: 'Move up' }] : []),
              ...(position < last ? [{ name: 'moveDown', label: 'Move down' }] : []),
            ]
      }
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'moveUp') moveInQueue(position, position - 1);
        if (e.nativeEvent.actionName === 'moveDown') moveInQueue(position, position + 1);
      }}
      leading={
        <AlbumArtwork albumId={item.albumId} artworkKey={item.artworkUri} size={theme.sizes.artworkRow} placeholderIcon="song" />
      }
      trailing={
        current ? null : (
          <View style={styles.trailing}>
            <IconButton
              icon="remove"
              label={`Remove ${item.title} from the queue`}
              onPress={() => {
                const undo = removeFromQueue(position);
                if (undo) showToast({ icon: 'remove', message: 'Removed from Queue', undo });
              }}
              size={36}
              iconSize={theme.sizes.icon.md}
            />
            <DragHandle label={`Reorder ${item.title}`} />
          </View>
        )
      }
    />
  );
});

/**
 * Android sheets are separate windows, so gestures (dragging rows) need their own root there.
 * On iOS the list must stay the sheet's root: a flex wrapper collapses inside a form sheet.
 */
function SheetRoot({ children }: { children: ReactNode }) {
  if (Platform.OS === 'android') {
    return <GestureHandlerRootView style={rootStyles.fill}>{children}</GestureHandlerRootView>;
  }
  return <>{children}</>;
}

/**
 * What's playing and what comes next. Tap a song to jump to it, drag ≡ to reorder,
 * remove songs you don't want.
 */
export function QueueScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const queue = usePlayerStore((s) => s.queue);
  const isPlaying = useIsPlaying();
  const current = queue.items[queue.index];
  const upNext = queue.items.slice(queue.index + 1);
  const last = queue.items.length - 1;

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

  const onReorder = ({ from, to }: ReorderableListReorderEvent) => {
    // Rows are "up next" only; the queue positions start right after the current song.
    moveInQueue(queue.index + 1 + from, queue.index + 1 + to);
  };

  return (
    <SheetRoot>
      <ReorderableList
        data={upNext}
        keyExtractor={(item) => item.key}
        onReorder={onReorder}
        onDragStart={() => {
          'worklet';
          scheduleOnRN(tapHaptic);
        }}
        onDragEnd={() => {
          'worklet';
          scheduleOnRN(selectionHaptic);
        }}
        renderItem={({ item, index }) => <QueueRow item={item} position={queue.index + 1 + index} last={last} />}
        ListHeaderComponent={
          <View>
            <Text variant="title2" accessibilityRole="header" style={styles.heading}>
              {isPlaying ? 'Now Playing' : 'Paused'}
            </Text>
            <QueueRow item={current} position={queue.index} last={last} current />
            <View style={styles.upNextHeader}>
              <Text variant="headline" accessibilityRole="header" style={styles.flex}>
                Up Next
              </Text>
              <IconButton
                icon="shuffle"
                label={queue.shuffle ? 'Shuffle on' : 'Shuffle off'}
                selected={queue.shuffle}
                onPress={() => {
                  toggleShuffle();
                  showToast({ icon: 'shuffle', message: queue.shuffle ? 'Shuffle Off' : 'Shuffle On' });
                }}
                iconSize={theme.sizes.icon.md}
              />
              <IconButton
                icon="delete"
                label="Clear Up Next"
                onPress={() => {
                  const undo = clearUpNext();
                  if (undo) showToast({ icon: 'delete', message: 'Cleared Up Next', undo });
                }}
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
    </SheetRoot>
  );
}

const rootStyles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});

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
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: -t.spacing.sm,
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
