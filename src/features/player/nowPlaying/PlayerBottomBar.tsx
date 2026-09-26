import { audio, isAudioAvailable, RoutePickerView } from '@modules/isai-audio';
import { router } from 'expo-router';
import { Platform, View } from 'react-native';

import { IconButton, makeStyles, useTheme } from '@/design';

/** Lyrics · output device · queue. */
export function PlayerBottomBar() {
  const styles = useStyles();

  return (
    <View style={styles.row}>
      <IconButton icon="lyrics" label="Lyrics" onPress={() => router.push('/lyrics')} />
      <OutputButton />
      <IconButton icon="queue" label="Queue" onPress={() => router.push('/queue')} />
    </View>
  );
}

/**
 * iOS: the system AirPlay/Bluetooth picker. Android: the system output switcher (Android 14+),
 * or Bluetooth settings on older versions. An empty slot on builds without either.
 */
function OutputButton() {
  const theme = useTheme();
  const styles = useStyles();

  if (Platform.OS === 'ios') {
    return RoutePickerView ? (
      <RoutePickerView
        style={styles.output}
        buttonColor={theme.colors.textPrimary}
        activeColor={theme.colors.accent}
        accessibilityLabel="Output device"
      />
    ) : (
      <View style={styles.output} />
    );
  }

  if (!isAudioAvailable || typeof audio().showOutputSwitcher !== 'function') {
    return <View style={styles.output} />;
  }
  return (
    <IconButton
      icon="output"
      label="Output device"
      onPress={() => {
        audio()
          .showOutputSwitcher?.()
          .catch(() => undefined);
      }}
    />
  );
}

const useStyles = makeStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: -t.spacing.sm,
  },
  output: {
    width: t.sizes.touchTarget,
    height: t.sizes.touchTarget,
  },
}));
