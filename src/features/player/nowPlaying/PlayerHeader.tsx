import { router } from 'expo-router';
import { View } from 'react-native';

import { IconButton, Text, makeStyles } from '@/design';

import { usePlayerStore } from '../playerStore';
import type { QueueItem } from '../queue';

/** Close chevron, "Playing from <album / playlist>", and the "…" menu. */
export function PlayerHeader({ item }: { item: QueueItem }) {
  const styles = useStyles();
  const context = usePlayerStore((s) => s.context);
  // A restored or hand-built queue has no context: the song's album is the best description.
  const source = context?.name || item.album || 'Your Library';

  return (
    <View style={styles.row}>
      <IconButton icon="chevronDown" label="Close player" onPress={() => router.back()} />
      <View style={styles.center} accessible accessibilityLabel={`Playing from ${source}`}>
        <Text variant="caption" color="secondary" numberOfLines={1} style={styles.kicker}>
          Playing from
        </Text>
        <Text variant="footnote" numberOfLines={1} style={styles.source}>
          {source}
        </Text>
      </View>
      <IconButton
        icon="more"
        label="More options"
        onPress={() =>
          router.push({ pathname: '/song-actions', params: { songId: String(item.songId), from: 'player' } })
        }
      />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  center: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontSize: 11,
  },
  source: {
    fontWeight: '600',
  },
}));
