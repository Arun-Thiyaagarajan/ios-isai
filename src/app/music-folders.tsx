import { isLibraryAvailable } from '@modules/isai-library';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, Alert, Platform, ScrollView, View } from 'react-native';

import { db } from '@/db/client';
import { queryKeys } from '@/db/queryKeys';
import { listMusicFolders, listRoots, setFolderExcluded } from '@/db/repos/library';
import {
  EmptyScreen,
  EmptyState,
  Icon,
  IconButton,
  ListRow,
  makeStyles,
  SectionHeader,
  SwitchRow,
  Text,
  useTheme,
} from '@/design';
import {
  addMusicFolder,
  removeMusicFolder,
  requestLibraryAccess,
  scanLibrary,
} from '@/features/library/scanService';
import { useScanStore } from '@/features/library/scanStore';
import { formatCount } from '@/lib/format';

/** iOS: where Isai looks for music (its own folder plus folders the user picked). */
function IosSources() {
  const theme = useTheme();
  const roots = useQuery({ queryKey: queryKeys.library.roots(), queryFn: () => listRoots(db) });

  const confirmRemove = (rootId: number, name: string) =>
    Alert.alert(`Remove “${name}”?`, 'Its songs will be removed from Isai. The files themselves are not deleted.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeMusicFolder(rootId) },
    ]);

  return (
    <>
      <SectionHeader title="Where Isai Looks" />
      <ListRow
        title="Isai Folder"
        subtitle="On My iPhone › Isai. Copy music here with the Files app."
        leading={<Icon name="folder" color={theme.colors.accentText} />}
      />
      {roots.data?.map((root) => (
        <ListRow
          key={root.id}
          title={root.displayName}
          subtitle="Folder you added"
          leading={<Icon name="folder" color={theme.colors.accentText} />}
          trailing={
            <IconButton
              icon="delete"
              label={`Remove ${root.displayName}`}
              onPress={() => confirmRemove(root.id, root.displayName)}
            />
          }
        />
      ))}
      <ListRow
        title="Add Folder…"
        subtitle="From On My iPhone, iCloud Drive or a USB drive"
        onPress={addMusicFolder}
        leading={<Icon name="folderAdd" color={theme.colors.accentText} />}
      />
    </>
  );
}

export default function MusicFoldersScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const client = useQueryClient();
  const status = useScanStore((s) => s.status);
  const scanning = status === 'scanning';

  const folders = useQuery({
    queryKey: queryKeys.library.folders(),
    queryFn: () => listMusicFolders(db),
    enabled: isLibraryAvailable,
  });

  if (!isLibraryAvailable) {
    return (
      <EmptyScreen
        icon="folder"
        title="Needs the full app"
        message="Music folders need Isai’s development build; they aren’t available in Expo Go."
      />
    );
  }

  const toggle = (path: string, include: boolean) => {
    setFolderExcluded(db, path, !include);
    client.invalidateQueries({ queryKey: queryKeys.library.folders() });
    // Apply right away: hidden songs disappear, re-enabled ones come back.
    scanLibrary();
  };

  const list = folders.data ?? [];

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: theme.colors.bg }}
      contentContainerStyle={styles.bottom}
    >
      {Platform.OS === 'ios' ? <IosSources /> : null}

      <SectionHeader title="Folders With Music" />
      <View style={styles.intro}>
        <Text variant="subhead" color="secondary">
          {Platform.OS === 'android'
            ? 'Isai finds every song on your phone automatically. Turn off a folder to hide its songs (and those in folders inside it).'
            : 'Turn off a folder to hide its songs (and those in folders inside it).'}
        </Text>
        {scanning ? (
          <View style={styles.scanning}>
            <ActivityIndicator color={theme.colors.accent} />
            <Text variant="footnote" color="secondary">
              Updating your library…
            </Text>
          </View>
        ) : null}
      </View>

      {status === 'needsPermission' ? (
        <EmptyState
          icon="song"
          title="Allow access to your music"
          message="Isai needs permission to see the songs on this phone."
          actionLabel="Allow Access"
          onAction={async () => {
            if (await requestLibraryAccess()) {
              await scanLibrary();
            }
          }}
        />
      ) : list.length === 0 && !scanning ? (
        <Text variant="subhead" color="tertiary" style={styles.intro}>
          No folders with music yet.
        </Text>
      ) : (
        list.map((folder) => (
          <SwitchRow
            key={folder.path}
            title={folder.name}
            subtitle={
              folder.excluded
                ? `${folder.path} · Hidden`
                : `${folder.path} · ${formatCount(folder.songCount, 'song')}`
            }
            leading={
              <Icon
                name="folder"
                color={folder.excluded ? theme.colors.textTertiary : theme.colors.accentText}
              />
            }
            value={!folder.excluded}
            onValueChange={(include) => toggle(folder.path, include)}
          />
        ))
      )}
    </ScrollView>
  );
}

const useStyles = makeStyles((t) => ({
  bottom: {
    paddingBottom: t.spacing.max,
  },
  intro: {
    paddingHorizontal: t.gutter,
    paddingBottom: t.spacing.sm,
    gap: t.spacing.sm,
  },
  scanning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
}));
