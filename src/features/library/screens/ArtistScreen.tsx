import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { db } from '@/db/client';
import { queryKeys } from '@/db/queryKeys';
import { getArtist, listArtistAlbums, listArtistSongs, type AlbumSummary, type ArtistSummary } from '@/db/repos/browse';
import { EmptyState, SectionHeader, Text, makeStyles, useTheme } from '@/design';
import { formatCount } from '@/lib/format';

import { AlbumArtwork } from '../components/AlbumArtwork';
import { AlbumTile } from '../components/AlbumTile';
import { TrackRow } from '../components/TrackRow';
import { useBrowse } from '../navigation';

const ARTIST_ARTWORK = 160;
const ALBUM_TILE_WIDTH = 150;

function ArtistHeader({ artist, albums }: { artist: ArtistSummary; albums: AlbumSummary[] }) {
  const styles = useStyles();
  const browse = useBrowse();

  return (
    <View>
      <View style={styles.header}>
        <AlbumArtwork
          albumId={artist.albumId}
          artworkKey={artist.artworkKey}
          size={ARTIST_ARTWORK}
          shape="circle"
          placeholderIcon="artist"
        />
        <Text variant="title1" align="center" accessibilityRole="header">
          {artist.name}
        </Text>
        <Text variant="footnote" color="secondary" align="center">
          {formatCount(albums.length, 'album')} · {formatCount(artist.songCount, 'song')}
        </Text>
      </View>

      {albums.length > 0 ? (
        <>
          <SectionHeader title="Albums" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
            {albums.map((album) => (
              <AlbumTile key={album.id} album={album} width={ALBUM_TILE_WIDTH} onPress={() => browse.album(album.id)} />
            ))}
          </ScrollView>
        </>
      ) : null}
      <SectionHeader title="Songs" />
    </View>
  );
}

export function ArtistScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const artistId = Number(useLocalSearchParams<{ id: string }>().id);

  const artist = useQuery({ queryKey: queryKeys.library.artist(artistId), queryFn: () => getArtist(db, artistId) ?? null });
  const albums = useQuery({
    queryKey: [...queryKeys.library.artist(artistId), 'albums'],
    queryFn: () => listArtistAlbums(db, artistId),
  });
  const songs = useQuery({
    queryKey: [...queryKeys.library.artist(artistId), 'songs'],
    queryFn: () => listArtistSongs(db, artistId),
  });

  if (artist.data === null) {
    return <EmptyState icon="artist" title="Artist not found" message="They may have been removed from your library." />;
  }

  return (
    <>
      <Stack.Screen options={{ title: artist.data?.name ?? '' }} />
      <FlashList
        data={songs.data ?? []}
        keyExtractor={(song) => String(song.id)}
        ListHeaderComponent={
          artist.data ? <ArtistHeader artist={artist.data} albums={albums.data ?? []} /> : null
        }
        renderItem={({ item }) => <TrackRow track={item} showArtist={false} />}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.bottom}
        style={{ backgroundColor: theme.colors.bg }}
      />
    </>
  );
}

const useStyles = makeStyles((t) => ({
  header: {
    alignItems: 'center',
    gap: t.spacing.sm,
    paddingHorizontal: t.gutter,
    paddingTop: t.spacing.lg,
  },
  carousel: {
    paddingHorizontal: t.gutter,
    gap: t.spacing.md,
  },
  bottom: {
    paddingBottom: t.spacing.max,
  },
}));
