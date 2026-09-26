import { isLibraryAvailable } from '@modules/isai-library';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Platform, View } from 'react-native';

import { db } from '@/db/client';
import { queryKeys } from '@/db/queryKeys';
import { countSongs } from '@/db/repos/library';
import { EmptyState, Text, makeStyles, useTheme } from '@/design';
import { TabScreen } from '@/features/shell/TabScreen';
import { formatCount } from '@/lib/format';

import { addMusicFolder, requestLibraryAccess, scanLibrary } from './scanService';
import { useScanStore } from './scanStore';
import { SongList } from './SongList';

function ScanProgress() {
  const theme = useTheme();
  const styles = useStyles();
  const found = useScanStore((s) => s.found);
  const step = useScanStore((s) => s.step);

  return (
    <View style={styles.progress} accessibilityLiveRegion="polite">
      <ActivityIndicator color={theme.colors.accent} />
      <Text variant="headline" align="center">
        {step ?? 'Looking for music…'}
      </Text>
      <Text variant="subhead" color="secondary" align="center" tabular>
        {formatCount(found, 'song')} found
      </Text>
    </View>
  );
}

/** What to show while the library has no songs: progress, a permission ask, or a way to add music. */
function EmptyLibrary() {
  const status = useScanStore((s) => s.status);
  const error = useScanStore((s) => s.error);

  if (status === 'scanning' || status === 'idle') {
    return <ScanProgress />;
  }

  if (status === 'error') {
    return (
      <EmptyState
        icon="warning"
        title="Couldn’t scan your music"
        message={error ?? undefined}
        actionLabel="Try Again"
        onAction={scanLibrary}
      />
    );
  }

  if (status === 'needsPermission') {
    return (
      <EmptyState
        icon="song"
        title="Allow access to your music"
        message="Isai plays the music stored on this phone. It only reads audio files, and nothing leaves your device."
        actionLabel="Allow Access"
        onAction={async () => {
          if (await requestLibraryAccess()) {
            await scanLibrary();
          }
        }}
      />
    );
  }

  if (Platform.OS === 'ios') {
    return (
      <EmptyState
        icon="folderAdd"
        title="Add your music"
        message="Choose a folder with music from On My iPhone, iCloud Drive or a USB drive. You can also copy songs into On My iPhone › Isai using the Files app."
        actionLabel="Add Folder"
        onAction={addMusicFolder}
      />
    );
  }

  return (
    <EmptyState
      icon="song"
      title="No music found"
      message="Isai couldn’t find any songs on this phone. Sounds shorter than 10 seconds, like ringtones, are skipped."
      actionLabel="Scan Again"
      onAction={scanLibrary}
    />
  );
}

export function LibraryScreen() {
  const songCount = useQuery({
    queryKey: queryKeys.library.songCount(),
    queryFn: () => countSongs(db),
    enabled: isLibraryAvailable,
  });

  if (!isLibraryAvailable) {
    return (
      <TabScreen>
        <EmptyState
          icon="library"
          title="Library needs the full app"
          message="Finding music on your phone uses Isai’s own native code, which Expo Go doesn’t include. Install a development build to see your songs."
        />
      </TabScreen>
    );
  }

  if (songCount.data === undefined) {
    return null;
  }

  if (songCount.data === 0) {
    return (
      <TabScreen>
        <EmptyLibrary />
      </TabScreen>
    );
  }

  return <SongList total={songCount.data} />;
}

const useStyles = makeStyles((t) => ({
  progress: {
    alignItems: 'center',
    gap: t.spacing.sm,
    paddingHorizontal: t.spacing.xxxl,
    paddingVertical: t.spacing.giant,
  },
}));
