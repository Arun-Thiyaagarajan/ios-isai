import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { db } from '@/db/client';
import { queryKeys } from '@/db/queryKeys';
import { setFavorite } from '@/db/repos/favorites';
import { Icon, Surface, Text, makeStyles, useTheme, type IconName } from '@/design';
import { addToQueue, playNext, playSongs } from '@/features/player/playerService';
import type { PlayContext } from '@/features/player/playerStore';
import { showToast, type ToastOptions } from '@/features/shell/toast';
import { formatCount } from '@/lib/format';
import { selectionHaptic, tapHaptic } from '@/lib/haptics';

/** Which songs are ticked in a list, while "Select" is on. */
export function useSongSelection() {
  const [active, setActive] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());

  return {
    active,
    selected,
    count: selected.size,
    isSelected: (id: number) => selected.has(id),
    start: () => {
      selectionHaptic();
      setActive(true);
    },
    done: () => {
      setActive(false);
      setSelected(new Set());
    },
    toggle: (id: number) => {
      selectionHaptic();
      setSelected((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    setAll: (ids: number[]) => setSelected(new Set(ids)),
  };
}

export type SongSelection = ReturnType<typeof useSongSelection>;

type Props = {
  selection: SongSelection;
  /** The list's songs in order, so selected songs play in the order they're shown. */
  orderedIds: number[];
  context?: PlayContext;
  /** Extra action for this list, e.g. "Remove" in a playlist. */
  extra?: { icon: IconName; label: string; onPress: (ids: number[]) => void; destructive?: boolean };
};

/**
 * The bar along the bottom while selecting songs: Play, Play Next, Add to Queue, Add to Playlist,
 * Favorite (and an optional extra). Each action ends selection mode.
 */
export function SelectionBar({ selection, orderedIds, context, extra }: Props) {
  const theme = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const client = useQueryClient();

  if (!selection.active) {
    return null;
  }
  const ids = orderedIds.filter((id) => selection.selected.has(id));
  const disabled = ids.length === 0;

  const finish = (toast?: ToastOptions) => {
    if (toast) showToast(toast);
    selection.done();
  };
  // Title case, like the rest of the toast wording ("Added 3 Songs to Queue").
  const songs = formatCount(ids.length, 'Song');

  const actions: { icon: IconName; label: string; onPress: () => void; destructive?: boolean }[] = [
    {
      icon: 'play',
      label: 'Play',
      onPress: () => {
        tapHaptic();
        playSongs(ids, 0, { context });
        finish();
      },
    },
    {
      icon: 'playNext',
      label: 'Play Next',
      onPress: () => {
        playNext(ids);
        finish({ icon: 'playNext', message: ids.length === 1 ? 'Playing Next' : `${songs} Playing Next` });
      },
    },
    {
      icon: 'addToQueue',
      label: 'Queue',
      onPress: () => {
        addToQueue(ids);
        finish({ icon: 'addToQueue', message: ids.length === 1 ? 'Added to Queue' : `Added ${songs} to Queue` });
      },
    },
    {
      icon: 'addToPlaylist',
      label: 'Playlist',
      onPress: () => {
        router.push({ pathname: '/add-to-playlist', params: { songIds: ids.join(',') } });
        finish();
      },
    },
    {
      icon: 'favorite',
      label: 'Favorite',
      onPress: () => {
        for (const id of ids) setFavorite(db, 'song', id, true);
        client.invalidateQueries({ queryKey: queryKeys.favorites.all });
        finish({
          icon: 'favoriteFilled',
          message: ids.length === 1 ? 'Added to Favorites' : `Added ${songs} to Favorites`,
        });
      },
    },
  ];
  if (extra) {
    actions.push({
      icon: extra.icon,
      label: extra.label,
      destructive: extra.destructive,
      onPress: () => {
        extra.onPress(ids);
        finish();
      },
    });
  }

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom + theme.spacing.sm }]} pointerEvents="box-none">
      <Surface variant="glass" style={styles.bar}>
        <Text variant="footnote" color="secondary" align="center" style={styles.count}>
          {ids.length === 0 ? 'Tap songs to select them' : `${formatCount(ids.length, 'song')} selected`}
        </Text>
        <View style={styles.actions}>
          {actions.map((action) => (
            <Pressable
              key={action.label}
              onPress={action.onPress}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              accessibilityState={{ disabled }}
              style={({ pressed }) => [styles.action, (pressed || disabled) && styles.dim]}
            >
              <Icon
                name={action.icon}
                size={theme.sizes.icon.md}
                color={action.destructive ? theme.colors.danger : theme.colors.accentText}
              />
              <Text variant="caption" numberOfLines={1} maxFontSizeMultiplier={1.2}>
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Surface>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: t.spacing.sm,
  },
  bar: {
    borderRadius: t.radius.xl,
    borderCurve: 'continuous',
    paddingTop: t.spacing.sm,
    paddingBottom: t.spacing.xs,
    overflow: 'hidden',
    backgroundColor: t.colors.surfaceHigh,
  },
  count: {
    paddingBottom: t.spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  action: {
    flex: 1,
    minHeight: t.sizes.touchTarget + t.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.xxs,
  },
  dim: {
    opacity: 0.45,
  },
}));
