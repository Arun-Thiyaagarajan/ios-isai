import { Pressable, View } from 'react-native';

import { Icon, makeStyles, useTheme, type IconName } from '@/design';
import { selectionHaptic, tapHaptic } from '@/lib/haptics';

import { cycleRepeat, skipToNext, skipToPrevious, toggleShuffle } from '../playerService';
import { usePlayerStore } from '../playerStore';
import { PlayPauseButton } from './PlayPauseButton';
import { PLAYER_BACKGROUND } from './playerColors';

const PLAY_SIZE = 72;
const SKIP_SIZE = 56;
/** Shuffle/repeat when off: visible but clearly inactive. */
const OFF_OPACITY = 0.5;

/** Shuffle · previous · play/pause · next · repeat. */
export function PlayerControls({ isPlaying }: { isPlaying: boolean }) {
  const theme = useTheme();
  const styles = useStyles();
  const shuffle = usePlayerStore((s) => s.queue.shuffle);
  const repeat = usePlayerStore((s) => s.repeat);

  return (
    <View style={styles.row}>
      <ModeButton
        icon="shuffle"
        on={shuffle}
        label={shuffle ? 'Shuffle on' : 'Shuffle off'}
        onPress={() => {
          selectionHaptic();
          toggleShuffle();
        }}
      />
      <SkipButton
        icon="previous"
        label="Previous"
        onPress={() => {
          tapHaptic();
          skipToPrevious();
        }}
      />
      <PlayPauseButton
        isPlaying={isPlaying}
        size={PLAY_SIZE}
        background={theme.colors.textPrimary}
        foreground={PLAYER_BACKGROUND}
      />
      <SkipButton
        icon="next"
        label="Next"
        onPress={() => {
          tapHaptic();
          skipToNext();
        }}
      />
      <ModeButton
        icon={repeat === 'one' ? 'repeatOne' : 'repeat'}
        on={repeat !== 'off'}
        label={repeat === 'off' ? 'Repeat off' : repeat === 'all' ? 'Repeat all' : 'Repeat one'}
        onPress={() => {
          selectionHaptic();
          cycleRepeat();
        }}
      />
    </View>
  );
}

function SkipButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const theme = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
    >
      <Icon name={icon} size={theme.sizes.icon.xl + 6} color={theme.colors.textPrimary} />
    </Pressable>
  );
}

/** Shuffle or repeat: full strength with a small dot underneath when on, dimmed when off. */
function ModeButton({ icon, on, label, onPress }: { icon: IconName; on: boolean; label: string; onPress: () => void }) {
  const theme = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      style={({ pressed }) => [styles.mode, pressed && styles.pressed]}
    >
      <View style={!on && styles.off}>
        <Icon name={icon} size={theme.sizes.icon.lg} color={theme.colors.textPrimary} />
      </View>
      {/* Positioned absolutely so the icon stays vertically centered with or without the dot. */}
      {on ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // Pull the outer buttons' padding into the margins so their glyphs line up with the edges.
    marginHorizontal: -t.spacing.sm,
  },
  skip: {
    width: SKIP_SIZE,
    height: SKIP_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mode: {
    width: t.sizes.touchTarget,
    height: t.sizes.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  off: {
    opacity: OFF_OPACITY,
  },
  dot: {
    position: 'absolute',
    bottom: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: t.colors.textPrimary,
  },
  pressed: {
    opacity: t.motion.pressedOpacity,
    transform: [{ scale: t.motion.pressedScale }],
  },
}));
