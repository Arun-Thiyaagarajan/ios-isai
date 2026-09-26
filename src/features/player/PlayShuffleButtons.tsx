import { View } from 'react-native';

import { Button, makeStyles } from '@/design';

import { playSongs } from './playerService';

/** The Play / Shuffle pair shown on album, artist, genre and playlist pages. */
export function PlayShuffleButtons({ songIds }: { songIds: number[] }) {
  const styles = useStyles();
  const disabled = songIds.length === 0;

  return (
    <View style={styles.row}>
      <Button label="Play" icon="play" fill disabled={disabled} onPress={() => playSongs(songIds, 0)} />
      <Button
        label="Shuffle"
        icon="shuffle"
        variant="secondary"
        fill
        disabled={disabled}
        onPress={() => playSongs(songIds, 0, { shuffle: true })}
      />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    alignSelf: 'stretch',
  },
}));
