import { isLibraryAvailable } from '@modules/isai-library';
import { useQuery } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { db } from '@/db/client';
import { queryKeys } from '@/db/queryKeys';
import { getLibraryStats } from '@/db/repos/library';
import {
  Icon,
  ListRow,
  SettingsGroup,
  SwitchRow,
  Text,
  makeStyles,
  themes,
  useTheme,
  type IconName,
} from '@/design';
import { scanLibrary } from '@/features/library/scanService';
import { useScanStore } from '@/features/library/scanStore';
import { useSettings, type Settings } from '@/features/settings/settingsStore';
import { ThemePicker } from '@/features/settings/ThemePicker';
import { formatCount, formatTimeAgo } from '@/lib/format';

type BooleanSetting = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];

/** Accent-colored leading icon, identical in every row. */
function RowIcon({ name }: { name: IconName }) {
  const theme = useTheme();
  return <Icon name={name} color={theme.colors.accentText} />;
}

function Chevron() {
  const theme = useTheme();
  return <Icon name="chevronRight" size={theme.sizes.icon.md} color={theme.colors.textTertiary} />;
}

/** On/off setting bound to the settings store. */
function SettingSwitch({
  setting,
  icon,
  title,
  subtitle,
}: {
  setting: BooleanSetting;
  icon: IconName;
  title: string;
  subtitle?: string;
}) {
  const value = useSettings((s) => s[setting]);
  const set = useSettings((s) => s.set);
  return (
    <SwitchRow
      leading={<RowIcon name={icon} />}
      title={title}
      subtitle={subtitle}
      value={value}
      onValueChange={(next) => set(setting, next)}
    />
  );
}

function AppearanceSection() {
  const styles = useStyles();
  const chosen = useSettings((s) => s.theme);
  const matchSystem = useSettings((s) => s.matchSystem);
  const set = useSettings((s) => s.set);
  const darkChoice = themes[chosen].scheme === 'dark' ? themes[chosen].label : themes.midnight.label;

  return (
    <View style={styles.section}>
      <Text variant="footnote" color="secondary" accessibilityRole="header" style={styles.groupTitle}>
        APPEARANCE
      </Text>
      <ThemePicker
        selected={chosen}
        onSelect={(name) => {
          set('theme', name);
          // Choosing Pearl explicitly means "always light", so stop following the system.
          if (name === 'pearl' && matchSystem) {
            set('matchSystem', false);
          }
        }}
      />
      <Text variant="footnote" color="secondary" style={styles.themeNote}>
        {themes[chosen].description}
      </Text>
      <SettingsGroup>
        <SettingSwitch
          setting="matchSystem"
          icon="appearance"
          title="Match System"
          subtitle={`Pearl in light mode, ${darkChoice} in dark mode`}
        />
      </SettingsGroup>
    </View>
  );
}

function LibrarySection() {
  const theme = useTheme();
  const router = useRouter();
  const scanning = useScanStore((s) => s.status === 'scanning');
  const found = useScanStore((s) => s.found);

  const stats = useQuery({
    queryKey: queryKeys.library.stats(),
    queryFn: () => getLibraryStats(db),
    enabled: isLibraryAvailable,
  });

  if (!isLibraryAvailable) {
    return (
      <SettingsGroup
        title="Library"
        footer="Music scanning needs Isai’s development build; it isn’t available in Expo Go."
      >
        <ListRow title="Not available in Expo Go" leading={<RowIcon name="info" />} />
      </SettingsGroup>
    );
  }

  const lastScan = scanning
    ? `Scanning… ${formatCount(found, 'song')} found`
    : stats.data?.lastScanAt
      ? `Last scanned ${formatTimeAgo(stats.data.lastScanAt)}`
      : 'Not scanned yet';
  const footer = stats.data
    ? `${formatCount(stats.data.songs, 'song')} · ${formatCount(stats.data.albums, 'album')} · ${formatCount(stats.data.artists, 'artist')}`
    : undefined;

  return (
    <SettingsGroup title="Library" footer={footer}>
      <ListRow
        title="Scan for Music"
        subtitle={lastScan}
        disabled={scanning}
        onPress={() => scanLibrary()}
        leading={<RowIcon name="refresh" />}
        trailing={scanning ? <ActivityIndicator color={theme.colors.accent} /> : null}
      />
      <ListRow
        title="Music Folders"
        subtitle="Choose which folders Isai uses"
        subtitleLines={2}
        onPress={() => router.push('/music-folders')}
        leading={<RowIcon name="folder" />}
        trailing={<Chevron />}
      />
      <SettingSwitch
        setting="autoScan"
        icon="autoScan"
        title="Scan When Isai Opens"
        subtitle="Finds new, changed and deleted songs"
      />
    </SettingsGroup>
  );
}

export default function SettingsScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const version = Constants.expoConfig?.version ?? '';

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: theme.colors.bg }}
      contentContainerStyle={styles.bottom}
    >
      <AppearanceSection />

      <LibrarySection />

      <SettingsGroup title="Playback">
        <SettingSwitch
          setting="restoreQueue"
          icon="queue"
          title="Remember Queue"
          subtitle="Pick up where you left off when Isai opens"
        />
      </SettingsGroup>

      <SettingsGroup title="Interface">
        <SettingSwitch
          setting="miniPlayerSwipe"
          icon="swipe"
          title="Swipe to Change Songs"
          subtitle="Swipe the mini player left or right"
        />
        <SettingSwitch setting="showGreeting" icon="greeting" title="Greeting on Home" />
      </SettingsGroup>

      <SettingsGroup title="About">
        <ListRow
          title="Version"
          leading={<RowIcon name="info" />}
          trailing={
            <Text variant="body" color="secondary" tabular>
              {version}
            </Text>
          }
        />
        <ListRow
          title="Privacy"
          subtitle="Your music and listening history stay on this device. No accounts, no tracking."
          subtitleLines={3}
          leading={<RowIcon name="privacy" />}
        />
      </SettingsGroup>
    </ScrollView>
  );
}

const useStyles = makeStyles((t) => ({
  bottom: {
    paddingBottom: t.spacing.max,
  },
  section: {
    paddingTop: t.spacing.lg,
  },
  groupTitle: {
    paddingHorizontal: t.gutter * 2,
    paddingBottom: t.spacing.sm,
    letterSpacing: 0.4,
  },
  themeNote: {
    paddingHorizontal: t.gutter * 2,
    paddingTop: t.spacing.sm,
    marginBottom: -t.spacing.md,
  },
}));
