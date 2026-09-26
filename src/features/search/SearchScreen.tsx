import { FlashList } from '@shopify/flash-list';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { db } from '@/db/client';
import { queryKeys } from '@/db/queryKeys';
import { listRecentlyPlayedTracks } from '@/db/repos/browse';
import {
  addRecentSearch,
  clearRecentSearches,
  emptyResults,
  listRecentSearches,
  queryTokens,
  removeRecentSearch,
  searchLibrary,
} from '@/db/repos/search';
import {
  EmptyState,
  Icon,
  IconButton,
  ListRow,
  SearchField,
  SectionHeader,
  makeStyles,
  useTheme,
} from '@/design';
import { AlbumArtwork } from '@/features/library/components/AlbumArtwork';
import { TrackRow } from '@/features/library/components/TrackRow';
import { useBrowse } from '@/features/library/navigation';
import { playSongs } from '@/features/player/playerService';
import { openSongActions } from '@/features/player/songActions';
import { formatCount } from '@/lib/format';
import { useDebouncedValue } from '@/lib/useDebouncedValue';

import { browseRows, resultItems, type Item } from './resultItems';

const DEBOUNCE_MS = 150;

export function SearchScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const client = useQueryClient();
  const browse = useBrowse();
  const [text, setText] = useState('');
  const query = useDebouncedValue(text.trim(), DEBOUNCE_MS);
  const hasQuery = queryTokens(query).length > 0;

  const results = useQuery({
    queryKey: [...queryKeys.library.all, 'search', query],
    queryFn: () => searchLibrary(db, query),
    enabled: hasQuery,
    placeholderData: keepPreviousData,
  });
  const recent = useQuery({ queryKey: ['recentSearches'], queryFn: () => listRecentSearches(db) });
  const played = useQuery({
    queryKey: [...queryKeys.history.all, 'recent', 'search'],
    queryFn: () => listRecentlyPlayedTracks(db, 5),
  });

  const remember = () => {
    if (hasQuery) {
      addRecentSearch(db, query);
      client.invalidateQueries({ queryKey: ['recentSearches'] });
    }
  };
  const forget = (q: string) => {
    removeRecentSearch(db, q);
    client.invalidateQueries({ queryKey: ['recentSearches'] });
  };
  const forgetAll = () => {
    clearRecentSearches(db);
    client.invalidateQueries({ queryKey: ['recentSearches'] });
  };

  let items: Item[];
  if (hasQuery) {
    items = resultItems(query, results.data ?? emptyResults);
  } else {
    const recentSearches = recent.data ?? [];
    const playedTracks = played.data ?? [];
    const playedIds = playedTracks.filter((t) => t.isPlayable).map((t) => t.id);
    items = [
      ...(recentSearches.length
        ? [
            {
              kind: 'header',
              key: 'h-recent',
              title: 'Recent Searches',
              action: { label: 'Clear', onPress: forgetAll },
            } as Item,
            ...recentSearches.map((q): Item => ({ kind: 'recent', key: `r-${q}`, query: q })),
          ]
        : []),
      { kind: 'header', key: 'h-browse', title: 'Browse' },
      ...browseRows,
      ...(playedTracks.length
        ? [
            { kind: 'header', key: 'h-played', title: 'Recently Played' } as Item,
            ...playedTracks.map((track): Item => ({ kind: 'song', key: `rp${track.id}`, track, list: playedIds })),
          ]
        : []),
    ];
  }

  const chevron = <Icon name="chevronRight" size={theme.sizes.icon.md} color={theme.colors.textTertiary} />;

  const renderItem = ({ item }: { item: Item }) => {
    switch (item.kind) {
      case 'header':
        return <SectionHeader title={item.title} actionLabel={item.action?.label} onAction={item.action?.onPress} />;
      case 'recent':
        return (
          <ListRow
            title={item.query}
            onPress={() => setText(item.query)}
            leading={<Icon name="recent" color={theme.colors.textTertiary} />}
            trailing={
              <IconButton
                icon="close"
                label={`Remove ${item.query} from recent searches`}
                onPress={() => forget(item.query)}
                iconSize={theme.sizes.icon.sm}
              />
            }
          />
        );
      case 'browse':
        return (
          <ListRow
            title={item.title}
            onPress={() => browse.list(item.screen)}
            leading={<Icon name={item.icon} color={theme.colors.accentText} />}
            trailing={chevron}
          />
        );
      case 'song':
        return (
          <TrackRow
            track={item.track}
            onPress={
              item.track.isPlayable
                ? () => {
                    remember();
                    playSongs(item.list, Math.max(0, item.list.indexOf(item.track.id)), {
                      context: { type: 'search', name: 'Search' },
                    });
                  }
                : undefined
            }
            onMore={() => openSongActions(item.track.id)}
          />
        );
      case 'artist':
        return (
          <ListRow
            title={item.artist.name}
            subtitle={`Artist · ${formatCount(item.artist.songCount, 'song')}`}
            onPress={() => {
              remember();
              browse.artist(item.artist.id);
            }}
            leading={
              <AlbumArtwork
                albumId={item.artist.albumId}
                artworkKey={item.artist.artworkKey}
                size={theme.sizes.artworkRow}
                shape="circle"
                placeholderIcon="artist"
              />
            }
            trailing={chevron}
          />
        );
      case 'album':
        return (
          <ListRow
            title={item.album.title}
            subtitle={`Album · ${item.album.artist}`}
            onPress={() => {
              remember();
              browse.album(item.album.id);
            }}
            leading={
              <AlbumArtwork
                albumId={item.album.id}
                artworkKey={item.album.artworkKey}
                size={theme.sizes.artworkRow}
                placeholderColor={item.album.colorPrimary}
              />
            }
            trailing={chevron}
          />
        );
      case 'playlist':
        return (
          <ListRow
            title={item.playlist.name}
            subtitle={`Playlist · ${formatCount(item.playlist.songCount, 'song')}`}
            onPress={() => {
              remember();
              router.push({ pathname: '/(tabs)/(search)/playlist/[id]', params: { id: String(item.playlist.id) } });
            }}
            leading={
              <AlbumArtwork
                albumId={item.playlist.albumId}
                artworkKey={item.playlist.artworkKey}
                size={theme.sizes.artworkRow}
                placeholderIcon="playlists"
              />
            }
            trailing={chevron}
          />
        );
      case 'genre':
        return (
          <ListRow
            title={item.genre.name}
            subtitle={`Genre · ${formatCount(item.genre.songCount, 'song')}`}
            onPress={() => {
              remember();
              browse.genre(item.genre.id);
            }}
            leading={<Icon name="genre" color={theme.colors.accentText} />}
            trailing={chevron}
          />
        );
      case 'noResults':
        return (
          <EmptyState
            icon="search"
            title="No results found"
            message="Try a different song, artist, album, or keyword."
          />
        );
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.bg }]}>
      <View style={styles.fieldWrap}>
        <SearchField
          value={text}
          onChangeText={setText}
          placeholder="Songs, artists, albums, lyrics"
          autoFocus
          onSubmitEditing={remember}
          accessibilityLabel="Search your music"
        />
      </View>
      <FlashList
        data={items}
        keyExtractor={(item) => item.key}
        getItemType={(item) => item.kind}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.bottom}
      />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  screen: {
    flex: 1,
  },
  fieldWrap: {
    paddingHorizontal: t.gutter,
    paddingTop: t.spacing.sm,
    paddingBottom: t.spacing.sm,
  },
  bottom: {
    paddingBottom: t.spacing.max + t.sizes.miniPlayer,
  },
}));
