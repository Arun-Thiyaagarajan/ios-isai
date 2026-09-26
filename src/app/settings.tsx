import { isLibraryAvailable } from '@modules/isai-library';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView } from 'react-native';

import { db } from '@/db/client';
import { queryKeys } from '@/db/queryKeys';
import { getLibraryStats } from '@/db/repos/library';
import {
  Icon,
  ListRow,
  SectionHeader,
  SwitchRow,
  Text,
  makeStyles,
  themes,
  useTheme,
} from '@/design';
import { scanLibrary } from '@/features/library/scanService';
import { useScanStore } from '@/features/library/scanStore';
import { useSettings } from '@/features/settings/settingsStore';
import { ThemePicker } from '@/features/settings/ThemePicker';
import { formatCount, formatTimeAgo } from '@/lib/format';

function AppearanceSection() {
  const styles = useStyles();
  const chosen = useSettings((s) => s.theme);
  const matchSystem = useSettings((s) => s.matchSystem);
  const setSetting = useSettings((s) => s.set);
  const darkChoice = themes[chosen].scheme === 'dark' ? themes[chosen].label : themes.midnight.label;

  return (
    <>
      <ThemePicker
        selected={chosen}
        onSelect={(name) => {
          setSetting('theme', name);
          // Choosing Pearl explicitly means "always light", so stop following the system.
          if (name === 'pearl' && matchSystem) {
            setSetting('matchSystem', false);
          }
        }}
      />
      <Text variant="footnote" color="secondary" style={styles.note}>
        {themes[chosen].description}
      </Text>
      <SwitchRow
        title="Match System"
        subtitle={`Pearl in light mode, ${darkChoice} in dark mode`}
        value={matchSystem}
        onValueChange={(value) => setSetting('matchSystem', value)}
      />
    </>
  );
}

function LibrarySection() {
  const theme = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const scanning = useScanStore((s) => s.status === 'scanning');
  const found = useScanStore((s) => s.found);
  const autoScan = useSettings((s) => s.autoScan);
  const setSetting = useSettings((s) => s.set);

  const stats = useQuery({
    queryKey: queryKeys.library.stats(),
    queryFn: () => getLibraryStats(db),
    enabled: isLibraryAvailable,
  });

  if (!isLibraryAvailable) {
    return (
      <Text variant="subhead" color="secondary" style={styles.note}>
        Music scanning needs Isai’s development build; it isn’t available in Expo Go.
      </Text>
    );
  }

  const summary = stats.data
    ? `${formatCount(stats.data.songs, 'song')} · ${formatCount(stats.data.albums, 'album')} · ${formatCount(stats.data.artists, 'artist')}`
    : '';
  const lastScan = scanning
    ? `Scanning… ${formatCount(found, 'song')} found`
    : stats.data?.lastScanAt
      ? `Last scanned ${formatTimeAgo(stats.data.lastScanAt)}`
      : 'Not scanned yet';

  return (
    <>
      <ListRow
        title="Scan for Music"
        subtitle={lastScan}
        disabled={scanning}
        onPress={() => scanLibrary()}
        leading={<Icon name="refresh" color={theme.colors.accentText} />}
        trailing={scanning ? <ActivityIndicator color={theme.colors.accent} /> : null}
      />
      <ListRow
        title="Music Folders"
        subtitle="Choose which folders Isai uses"
        onPress={() => router.push('/music-folders')}
        leading={<Icon name="folder" color={theme.colors.accentText} />}
        trailing={<Icon name="chevronRight" size={theme.sizes.icon.md} color={theme.colors.textTertiary} />}
      />
      <SwitchRow
        title="Scan When Isai Opens"
        subtitle="Finds new, changed and deleted songs automatically"
        value={autoScan}
        onValueChange={(value) => setSetting('autoScan', value)}
      />
      {summary ? (
        <Text variant="footnote" color="secondary" style={styles.note}>
          Your library: {summary}
        </Text>
      ) : null}
    </>
  );
}

export default function SettingsScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const router = useRouter();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: theme.colors.bg }}
      contentContainerStyle={styles.bottom}
    >
      <SectionHeader title="Theme" />
      <AppearanceSection />

      <SectionHeader title="Library" />
      <LibrarySection />

      {__DEV__ ? (
        <>
          <SectionHeader title="Developer" />
          <ListRow
            title="Design Gallery"
            subtitle="Every design-system component in the current theme"
            onPress={() => router.push('/dev/gallery')}
            trailing={<Icon name="chevronRight" size={theme.sizes.icon.md} color={theme.colors.textTertiary} />}
          />
        </>
      ) : null}
    </ScrollView>
  );
}

const useStyles = makeStyles((t) => ({
  bottom: {
    paddingBottom: t.spacing.max,
  },
  note: {
    paddingHorizontal: t.gutter,
    paddingTop: t.spacing.sm,
  },
}));
