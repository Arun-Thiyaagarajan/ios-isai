import { router } from 'expo-router';
import { View } from 'react-native';

import { EmptyState, makeStyles } from '@/design';

/** Player theme picker. For now a placeholder; the themes themselves are being built. */
export function PlayerThemeScreen() {
  const styles = useStyles();
  return (
    <View style={styles.screen}>
      <EmptyState
        icon="appearance"
        title="Player themes are on the way"
        message="Blur, gradient and more backgrounds for Now Playing are coming in the next update."
        actionLabel="Done"
        onAction={() => router.back()}
      />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  screen: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: t.colors.bgElevated,
    paddingVertical: t.spacing.xxxl,
  },
}));
