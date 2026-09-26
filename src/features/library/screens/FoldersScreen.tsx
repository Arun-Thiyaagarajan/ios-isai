import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';

import { db } from '@/db/client';
import { queryKeys } from '@/db/queryKeys';
import { listFolderSongs, listSubfolders, type FolderEntry, type TrackItem } from '@/db/repos/browse';
import { Icon, ListRow, useTheme } from '@/design';
import { formatCount } from '@/lib/format';

import { playSongs } from '@/features/player/playerService';
import { openSongActions } from '@/features/player/songActions';

import { TrackRow } from '../components/TrackRow';
import { useBrowse } from '../navigation';

type Item = { kind: 'folder'; folder: FolderEntry } | { kind: 'song'; song: TrackItem };

/** Browse music the way it's stored: folders first, then the songs in this folder. */
export function FoldersScreen() {
  const theme = useTheme();
  const browse = useBrowse();
  const { path } = useLocalSearchParams<{ path?: string }>();
  const current = path ?? null;

  const contents = useQuery({
    queryKey: queryKeys.library.folder(current),
    queryFn: (): Item[] => [
      ...listSubfolders(db, current).map((folder) => ({ kind: 'folder' as const, folder })),
      ...(current ? listFolderSongs(db, current) : []).map((song) => ({ kind: 'song' as const, song })),
    ],
  });

  const folderSongIds = (contents.data ?? [])
    .filter((item): item is Extract<Item, { kind: 'song' }> => item.kind === 'song' && item.song.isPlayable)
    .map((item) => item.song.id);

  const title = current ? current.slice(current.lastIndexOf('/') + 1) : 'Folders';

  return (
    <>
      <Stack.Screen options={{ title }} />
      <FlashList
        data={contents.data ?? []}
        keyExtractor={(item) => (item.kind === 'folder' ? `f${item.folder.id}` : `s${item.song.id}`)}
        getItemType={(item) => item.kind}
        renderItem={({ item }) =>
          item.kind === 'folder' ? (
            <ListRow
              title={item.folder.name}
              subtitle={formatCount(item.folder.totalSongs, 'song')}
              onPress={() => browse.folder(item.folder.path)}
              leading={<Icon name="folder" color={theme.colors.accentText} />}
              trailing={<Icon name="chevronRight" size={theme.sizes.icon.md} color={theme.colors.textTertiary} />}
            />
          ) : (
            <TrackRow
              track={item.song}
              onPress={
                item.song.isPlayable
                  ? () => playSongs(folderSongIds, folderSongIds.indexOf(item.song.id))
                  : undefined
              }
              onMore={() => openSongActions(item.song.id)}
            />
          )
        }
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: theme.colors.bg }}
      />
    </>
  );
}
