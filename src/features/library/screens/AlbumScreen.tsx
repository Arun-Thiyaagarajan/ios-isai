import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, View, useWindowDimensions } from 'react-native';

import { db } from '@/db/client';
import { queryKeys } from '@/db/queryKeys';
import { getAlbum, listAlbumTracks, type AlbumDetail, type TrackItem } from '@/db/repos/browse';
import { EmptyState, Text, makeStyles, useTheme } from '@/design';
import { formatCount } from '@/lib/format';

import { AlbumArtwork } from '../components/AlbumArtwork';
import { TrackRow } from '../components/TrackRow';
import { useBrowse } from '../navigation';

type Item = { kind: 'disc'; disc: number } | { kind: 'track'; track: TrackItem };

/** Groups tracks under "Disc 1", "Disc 2"… only when the album really has several discs. */
function withDiscHeaders(tracks: TrackItem[]): Item[] {
  const discs = new Set(tracks.map((t) => t.discNo ?? 1));
  if (discs.size < 2) {
    return tracks.map((track) => ({ kind: 'track', track }));
  }
  const items: Item[] = [];
  let lastDisc: number | null = null;
  for (const track of tracks) {
    const disc = track.discNo ?? 1;
    if (disc !== lastDisc) {
      items.push({ kind: 'disc', disc });
      lastDisc = disc;
    }
    items.push({ kind: 'track', track });
  }
  return items;
}

function formatMinutes(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  return minutes >= 60 ? `${Math.floor(minutes / 60)} hr ${minutes % 60} min` : `${minutes} min`;
}

function AlbumHeader({ album }: { album: AlbumDetail }) {
  const theme = useTheme();
  const styles = useStyles();
  const browse = useBrowse();
  const { width } = useWindowDimensions();
  const artworkSize = Math.min(width * 0.66, 320);
  const meta = [album.year, formatCount(album.songCount, 'song'), formatMinutes(album.totalDurationMs)]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.header}>
      <View style={[styles.artworkShadow, { borderRadius: theme.radius.lg }]}>
        <AlbumArtwork
          albumId={album.id}
          artworkKey={album.artworkKey}
          size={artworkSize}
          placeholderColor={album.colorPrimary}
        />
      </View>
      <Text variant="title2" align="center" accessibilityRole="header">
        {album.title}
      </Text>
      {album.albumArtistId !== null ? (
        <Pressable
          accessibilityRole="link"
          onPress={() => browse.artist(album.albumArtistId!)}
          hitSlop={8}
        >
          <Text variant="headline" color="accent" align="center">
            {album.artist}
          </Text>
        </Pressable>
      ) : (
        <Text variant="headline" color="secondary" align="center">
          {album.artist}
        </Text>
      )}
      <Text variant="footnote" color="secondary" align="center">
        {meta}
      </Text>
    </View>
  );
}

export function AlbumScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const albumId = Number(useLocalSearchParams<{ id: string }>().id);

  const album = useQuery({ queryKey: queryKeys.library.album(albumId), queryFn: () => getAlbum(db, albumId) ?? null });
  const tracks = useQuery({
    queryKey: [...queryKeys.library.album(albumId), 'tracks'],
    queryFn: () => listAlbumTracks(db, albumId),
  });

  if (album.data === null) {
    return <EmptyState icon="album" title="Album not found" message="It may have been removed from your library." />;
  }

  // Only compilations need the artist on every row.
  const variousArtists = new Set(tracks.data?.map((t) => t.artist)).size > 1;

  return (
    <>
      <Stack.Screen options={{ title: album.data?.title ?? '' }} />
      <FlashList
        data={withDiscHeaders(tracks.data ?? [])}
        keyExtractor={(item) => (item.kind === 'disc' ? `d${item.disc}` : String(item.track.id))}
        getItemType={(item) => item.kind}
        ListHeaderComponent={album.data ? <AlbumHeader album={album.data} /> : null}
        renderItem={({ item }) =>
          item.kind === 'disc' ? (
            <Text variant="footnote" color="secondary" style={styles.disc}>
              DISC {item.disc}
            </Text>
          ) : (
            <TrackRow track={item.track} leading="number" showAlbum={false} showArtist={variousArtists} />
          )
        }
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
    gap: t.spacing.xs,
    paddingHorizontal: t.gutter,
    paddingTop: t.spacing.lg,
    paddingBottom: t.spacing.xl,
  },
  artworkShadow: {
    marginBottom: t.spacing.lg,
    ...t.shadows.artwork,
  },
  disc: {
    paddingHorizontal: t.gutter,
    paddingTop: t.spacing.lg,
    paddingBottom: t.spacing.xs,
    letterSpacing: 0.5,
  },
  bottom: {
    paddingBottom: t.spacing.max,
  },
}));
