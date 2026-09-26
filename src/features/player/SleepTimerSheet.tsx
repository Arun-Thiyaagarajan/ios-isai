import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';

import { Icon, IconTile, ListRow, SettingsGroup, Text, makeStyles, useTheme } from '@/design';
import { selectionHaptic } from '@/lib/haptics';

import {
  SLEEP_TIMER_MINUTES,
  cancelSleepTimer,
  describeSleepTimer,
  sleepAtEndOfSong,
  startSleepTimer,
  useSleepTimer,
} from './sleepTimer';

/** Stop the music after a while, or at the end of this song. Picking an option closes the sheet. */
export function SleepTimerSheet() {
  const theme = useTheme();
  const styles = useStyles();
  const state = useSleepTimer();
  // Re-render every 15 s so the "min left" line counts down while the sheet is open.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(interval);
  }, []);

  const status = describeSleepTimer(state, now);
  const check = <Icon name="check" size={theme.sizes.icon.md} color={theme.colors.accentText} />;
  const choose = (action: () => void) => {
    selectionHaptic();
    action();
    router.back();
  };

  return (
    // The scroll view is the sheet's root (a flex wrapper would collapse inside an iOS form sheet).
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="title2" accessibilityRole="header" style={styles.title}>
        Sleep Timer
      </Text>
      <Text variant="subhead" color="secondary" style={styles.title}>
        {status ? `Music pauses: ${status.toLowerCase()}.` : 'Music keeps playing until you stop it.'}
      </Text>
      <SettingsGroup>
        <ListRow
          title="Off"
          leading={<IconTile name="close" />}
          onPress={() => choose(cancelSleepTimer)}
          trailing={!status ? check : null}
        />
        {SLEEP_TIMER_MINUTES.map((minutes) => (
          <ListRow
            key={minutes}
            title={`${minutes} minutes`}
            leading={<IconTile name="sleepTimer" />}
            onPress={() => choose(() => startSleepTimer(minutes))}
          />
        ))}
        <ListRow
          title="End of Song"
          leading={<IconTile name="song" />}
          onPress={() => choose(sleepAtEndOfSong)}
          trailing={state.endOfSong ? check : null}
        />
      </SettingsGroup>
    </ScrollView>
  );
}

const useStyles = makeStyles((t) => ({
  screen: {
    backgroundColor: t.colors.bgElevated,
  },
  content: {
    paddingTop: t.spacing.xl,
    paddingBottom: t.spacing.max,
  },
  title: {
    paddingHorizontal: t.gutter,
    paddingBottom: t.spacing.xs,
  },
}));
