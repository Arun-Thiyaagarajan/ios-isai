import { ScrollView } from 'react-native';

import { makeStyles } from '../theme';
import { EmptyState, type EmptyStateProps } from './EmptyState';

/**
 * A whole screen with nothing to show. The message sits a fixed distance below the
 * (large-title) header, the same on every screen; the scroll view keeps it clear of the
 * header and tab bar on iOS.
 */
export function EmptyScreen(props: EmptyStateProps) {
  const styles = useStyles();
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={styles.screen}>
      <EmptyState {...props} />
    </ScrollView>
  );
}

const useStyles = makeStyles((t) => ({
  screen: {
    flex: 1,
    backgroundColor: t.colors.bg,
  },
}));
