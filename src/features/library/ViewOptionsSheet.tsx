import { useLocalSearchParams } from 'expo-router';
import { ScrollView } from 'react-native';

import { Text, makeStyles } from '@/design';
import { useSettings } from '@/features/settings/settingsStore';

import { LibraryViewOptions } from './components/LibraryViewOptions';
import { ALBUM_SORTS, DEFAULT_DESCENDING, SONG_SORTS, sanitizeAlbumView, sanitizeSongView } from './viewOptions';

/**
 * View & sort sheet for a library list (`?list=albums` or `?list=songs`). Changes apply to the
 * list behind the sheet immediately and are saved.
 */
export function ViewOptionsSheet() {
  const styles = useStyles();
  const { list } = useLocalSearchParams<{ list?: string }>();
  const albumsView = sanitizeAlbumView(useSettings((s) => s.albumsView));
  const songsView = sanitizeSongView(useSettings((s) => s.songsView));
  const set = useSettings((s) => s.set);

  return (
    // The scroll view is the sheet's root (a flex wrapper would collapse inside an iOS form sheet).
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="title2" accessibilityRole="header">
        {list === 'songs' ? 'Songs' : 'Albums'}
      </Text>
      {list === 'songs' ? (
        <LibraryViewOptions
          sorts={SONG_SORTS}
          sort={songsView.sort}
          descending={songsView.descending}
          // A new sort starts in its natural direction (A–Z for names, newest/most first otherwise).
          onSortChange={(sort) => set('songsView', { sort, descending: DEFAULT_DESCENDING[sort] })}
          onDescendingChange={(descending) => set('songsView', { ...songsView, descending })}
        />
      ) : (
        <LibraryViewOptions
          layout={albumsView.layout}
          onLayoutChange={(layout) => set('albumsView', { ...albumsView, layout })}
          columns={albumsView.columns}
          onColumnsChange={(columns) => set('albumsView', { ...albumsView, columns })}
          sorts={ALBUM_SORTS}
          sort={albumsView.sort}
          descending={albumsView.descending}
          onSortChange={(sort) => set('albumsView', { ...albumsView, sort, descending: DEFAULT_DESCENDING[sort] })}
          onDescendingChange={(descending) => set('albumsView', { ...albumsView, descending })}
        />
      )}
    </ScrollView>
  );
}

const useStyles = makeStyles((t) => ({
  screen: {
    backgroundColor: t.colors.bgElevated,
  },
  content: {
    paddingHorizontal: t.gutter,
    paddingTop: t.spacing.xl,
    paddingBottom: t.spacing.max,
    gap: t.spacing.lg,
  },
}));
