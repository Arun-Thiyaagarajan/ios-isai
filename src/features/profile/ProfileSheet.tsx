import { isLibraryAvailable } from '@modules/isai-library';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';

import { config } from '@/config';
import { db } from '@/db/client';
import { queryKeys } from '@/db/queryKeys';
import { getLibraryStats, setDuplicateHiding } from '@/db/repos/library';
import { listPlaylists } from '@/db/repos/playlists';
import {
  Icon,
  IconTile,
  IsaiLogo,
  ListRow,
  SettingsGroup,
  SwitchRow,
  Text,
  TextField,
  makeStyles,
  themes,
  useTheme,
  type IconName,
} from '@/design';
import { scanLibrary } from '@/features/library/scanService';
import { useScanStore } from '@/features/library/scanStore';
import { useSettings, type Settings } from '@/features/settings/settingsStore';
import { backUpNow, restoreFromBackup } from '@/features/transfer/fileTransfer';
import { formatCount, formatTimeAgo } from '@/lib/format';
import { selectionHaptic } from '@/lib/haptics';

import { ProfileAvatar } from './ProfileAvatar';
import { randomName } from './randomNames';

const NAME_MAX_LENGTH = 40;

type BooleanSetting = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];

/** The icon at the start of each row, in a small tinted rounded square. */
function RowIcon({ name }: { name: IconName }) {
  return <IconTile name={name} />;
}

function Chevron() {
  const theme = useTheme();
  return <Icon name="chevronRight" size={theme.sizes.icon.sm} color={theme.colors.textTertiary} />;
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

/** Copies a picked photo into the app's own folder, so it survives the picker's cache being cleared. */
async function keepPhoto(pickedUri: string): Promise<string> {
  const folder = new Directory(Paths.document, 'profile');
  folder.create({ idempotent: true, intermediates: true });
  const ext = pickedUri.split('?')[0].split('.').pop()?.toLowerCase();
  const safeExt = ext && /^(jpe?g|png|heic|webp)$/.test(ext) ? ext : 'jpg';
  const target = new File(folder, `avatar-${Date.now()}.${safeExt}`);
  await new File(pickedUri).copy(target);
  return target.uri;
}

function removeStoredPhoto(uri: string | null) {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Already gone: nothing to clean up.
  }
}

/** Avatar, name, and a one-line library summary. */
function ProfileHeader() {
  const theme = useTheme();
  const styles = useStyles();
  const name = useSettings((s) => s.profileName);
  const photo = useSettings((s) => s.profilePhotoUri);
  const set = useSettings((s) => s.set);

  const stats = useQuery({ queryKey: queryKeys.library.stats(), queryFn: () => getLibraryStats(db) });
  const playlists = useQuery({ queryKey: queryKeys.playlists.list(), queryFn: () => listPlaylists(db) });

  const choosePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]?.uri) {
      return;
    }
    try {
      const kept = await keepPhoto(result.assets[0].uri);
      removeStoredPhoto(photo);
      set('profilePhotoUri', kept);
    } catch {
      Alert.alert('Couldn’t use that photo', 'Please try a different one.');
    }
  };

  const editPhoto = () => {
    if (!photo) {
      choosePhoto();
      return;
    }
    Alert.alert('Profile Photo', undefined, [
      { text: 'Choose New Photo', onPress: choosePhoto },
      {
        text: 'Remove Photo',
        style: 'destructive',
        onPress: () => {
          removeStoredPhoto(photo);
          set('profilePhotoUri', null);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const summary = [
    stats.data ? formatCount(stats.data.songs, 'song') : null,
    stats.data ? formatCount(stats.data.albums, 'album') : null,
    playlists.data ? formatCount(playlists.data.length, 'playlist') : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.header}>
      <View style={styles.avatarBlock}>
        <ProfileAvatar size={80} onPress={editPhoto} accessibilityLabel="Change profile photo" />
        <Pressable onPress={editPhoto} accessibilityRole="button" hitSlop={8}>
          <Text variant="subhead" color="accent" style={styles.editLabel}>
            {photo ? 'Edit' : 'Add Photo'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.nameRow}>
        <TextField
          value={name}
          onChangeText={(text) => set('profileName', text.slice(0, NAME_MAX_LENGTH))}
          placeholder="Your name (optional)"
          accessibilityLabel="Your name"
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          maxLength={NAME_MAX_LENGTH}
          style={styles.nameField}
        />
        <Pressable
          onPress={() => {
            selectionHaptic();
            set('profileName', randomName(name));
          }}
          accessibilityRole="button"
          accessibilityLabel="Random name"
          style={({ pressed }) => [styles.dice, pressed && styles.pressed]}
        >
          <Icon name="dice" size={theme.sizes.icon.md} color={theme.colors.accentText} />
        </Pressable>
      </View>

      {summary ? (
        <Text variant="footnote" color="secondary" align="center">
          {summary}
        </Text>
      ) : null}
    </View>
  );
}

/** Hide Duplicates: marks extra copies in the library (not just a display filter), then refreshes. */
function HideDuplicatesRow() {
  const client = useQueryClient();
  const value = useSettings((s) => s.hideDuplicates);
  const set = useSettings((s) => s.set);
  return (
    <SwitchRow
      leading={<RowIcon name="duplicate" />}
      title="Hide Duplicates"
      subtitle="Show each song once, keeping the best-quality copy"
      value={value}
      onValueChange={(next) => {
        set('hideDuplicates', next);
        setDuplicateHiding(db, next);
        client.invalidateQueries({ queryKey: queryKeys.library.all });
      }}
    />
  );
}

function LibraryRows() {
  const theme = useTheme();
  const scanning = useScanStore((s) => s.status === 'scanning');
  const found = useScanStore((s) => s.found);
  const stats = useQuery({
    queryKey: queryKeys.library.stats(),
    queryFn: () => getLibraryStats(db),
    enabled: isLibraryAvailable,
  });

  if (!isLibraryAvailable) {
    return (
      <SettingsGroup title="Library" footer="Music scanning needs Isai’s development build; it isn’t available in Expo Go.">
        <ListRow title="Not available in Expo Go" leading={<RowIcon name="info" />} />
      </SettingsGroup>
    );
  }

  const lastScan = scanning
    ? `Scanning… ${formatCount(found, 'song')} found`
    : stats.data?.lastScanAt
      ? `Last scanned: ${formatTimeAgo(stats.data.lastScanAt)}`
      : 'Not scanned yet';

  return (
    <SettingsGroup title="Library">
      <ListRow
        title="Rescan Library"
        subtitle={lastScan}
        disabled={scanning}
        onPress={() => scanLibrary()}
        leading={<RowIcon name="refresh" />}
        trailing={scanning ? <ActivityIndicator color={theme.colors.accent} /> : null}
      />
      <ListRow
        title="Music Folders"
        subtitle="Choose which folders Isai uses"
        onPress={() => router.push('/music-folders')}
        leading={<RowIcon name="folder" />}
        trailing={<Chevron />}
      />
      <SettingSwitch
        setting="autoScan"
        icon="autoScan"
        title="Check for New Music"
        subtitle="Looks for added and deleted songs when Isai opens"
      />
      <HideDuplicatesRow />
    </SettingsGroup>
  );
}

/**
 * Profile and settings, as a sheet from the avatar on Home: who you are, a library summary, and
 * every setting in grouped rows. Swipe down (or tap outside) to close.
 */
export function ProfileSheet() {
  const theme = useTheme();
  const styles = useStyles();
  const mode = useSettings((s) => s.themeMode);
  const lightTheme = useSettings((s) => s.lightTheme);
  const darkTheme = useSettings((s) => s.darkTheme);
  const version = Constants.expoConfig?.version ?? '';

  const appearance =
    mode === 'system'
      ? `System · ${themes[lightTheme].label} / ${themes[darkTheme].label}`
      : mode === 'light'
        ? `Light · ${themes[lightTheme].label}`
        : `Dark · ${themes[darkTheme].label}`;

  return (
    // The scroll view is the sheet's root (a flex wrapper would collapse inside an iOS form sheet).
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <ProfileHeader />

      <SettingsGroup title="Appearance">
        <ListRow
          title="Appearance"
          subtitle={appearance}
          onPress={() => router.push('/appearance')}
          leading={<RowIcon name="appearance" />}
          trailing={<Chevron />}
        />
      </SettingsGroup>

      <SettingsGroup title="Playback">
        {config.lockScreenPlayer ? (
          <SettingSwitch
            setting="lockScreenPlayer"
            icon="lockScreen"
            title="Show Player on Lock Screen"
            subtitle="Controls on the lock screen and in notifications"
          />
        ) : null}
        <SettingSwitch
          setting="restoreQueue"
          icon="queue"
          title="Remember Queue"
          subtitle="Pick up where you left off when Isai opens"
        />
        <SettingSwitch setting="showLyricsButton" icon="lyrics" title="Lyrics" subtitle="Show the lyrics button on Now Playing" />
        <SettingSwitch setting="showVolumeSlider" icon="volumeHigh" title="Volume Slider" subtitle="Show a volume control on Now Playing" />
      </SettingsGroup>

      <LibraryRows />

      <SettingsGroup title="Interface">
        <SettingSwitch setting="haptics" icon="haptics" title="Haptics" subtitle="Gentle taps on controls and tabs" />
        <SettingSwitch setting="miniPlayerSwipe" icon="swipe" title="Swipe to Change Songs" subtitle="Swipe the mini player left or right" />
        <SettingSwitch setting="showGreeting" icon="greeting" title="Greeting on Home" />
      </SettingsGroup>

      <SettingsGroup title="Backup & Restore" footer="Backups hold your playlists, favorites, play counts, edited song info, lyrics and settings, not the music files.">
        <ListRow
          title="Back Up Now"
          subtitle="Save a backup file, e.g. to Files or Drive"
          onPress={backUpNow}
          leading={<RowIcon name="backup" />}
          trailing={<Chevron />}
        />
        <ListRow
          title="Restore from Backup"
          subtitle="Adds to what’s here; nothing is deleted"
          onPress={restoreFromBackup}
          leading={<RowIcon name="importFile" />}
          trailing={<Chevron />}
        />
      </SettingsGroup>

      <SettingsGroup title="About">
        <View style={styles.about}>
          <View style={styles.logo}>
            <IsaiLogo width={18} color={theme.colors.onAccent} />
          </View>
          <View style={styles.aboutText}>
            <Text variant="headline">About Isai</Text>
            <Text variant="footnote" color="secondary">
              Version {version} · Your music and listening history stay on this device.
            </Text>
          </View>
        </View>
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
  header: {
    alignItems: 'center',
    gap: t.spacing.md,
    paddingHorizontal: t.gutter,
  },
  avatarBlock: {
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  editLabel: {
    fontWeight: '600',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: t.spacing.sm,
  },
  nameField: {
    flex: 1,
    textAlign: 'center',
  },
  dice: {
    width: t.sizes.touchTarget,
    height: t.sizes.touchTarget,
    borderRadius: t.radius.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.surface,
  },
  pressed: {
    opacity: t.motion.pressedOpacity,
  },
  about: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    paddingHorizontal: t.gutter,
    paddingVertical: t.spacing.md,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: t.radius.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.accent,
  },
  aboutText: {
    flex: 1,
    gap: t.spacing.xxs,
  },
}));
