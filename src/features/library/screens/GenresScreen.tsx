import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';

import { db } from '@/db/client';
import { queryKeys } from '@/db/queryKeys';
import { listGenres } from '@/db/repos/browse';
import { EmptyScreen, Icon, ListRow, useTheme } from '@/design';
import { formatCount } from '@/lib/format';

import { useBrowse } from '../navigation';

export function GenresScreen() {
  const theme = useTheme();
  const browse = useBrowse();
  const genres = useQuery({ queryKey: queryKeys.library.genres(), queryFn: () => listGenres(db) });

  if (genres.data?.length === 0) {
    return (
      <EmptyScreen
        icon="genre"
        title="No genres"
        message="None of your songs have a genre tag yet."
      />
    );
  }

  return (
    <FlashList
      data={genres.data ?? []}
      keyExtractor={(genre) => String(genre.id)}
      renderItem={({ item }) => (
        <ListRow
          title={item.name}
          subtitle={formatCount(item.songCount, 'song')}
          onPress={() => browse.genre(item.id)}
          leading={<Icon name="genre" color={theme.colors.accentText} />}
          trailing={<Icon name="chevronRight" size={theme.sizes.icon.md} color={theme.colors.textTertiary} />}
        />
      )}
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: theme.colors.bg }}
    />
  );
}
