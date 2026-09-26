import type { RawPalette } from '@modules/isai-library';

import { albums, songs } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { setFavorite } from '@/db/repos/favorites';
import {
  ScanContext,
  beginScan,
  countSongs,
  finishScan,
  setAlbumArtwork,
  setLastScanAt,
  upsertTracks,
  type ScannedTrack,
} from '@/db/repos/library';
import { saveArtworkPalette } from '@/db/repos/palettes';
import { addSongsToPlaylist, createPlaylist } from '@/db/repos/playlists';

/**
 * Sample albums for Expo Go. The covers are plain color squares (placehold.co, needs internet)
 * picked to cover the hard cases: a very bright cover, a very dark one, vivid colors, and an album
 * with no cover at all.
 */
type DemoAlbum = {
  title: string;
  artist: string;
  genre: string;
  year: number;
  /** Cover background and text color (hex without #); null = no artwork. */
  cover: { bg: string; fg: string; palette: RawPalette } | null;
  tracks: [title: string, seconds: number][];
};

const DEMO_ALBUMS: DemoAlbum[] = [
  {
    title: 'Paper Moon',
    artist: 'Kavya Raman',
    genre: 'Pop',
    year: 2024,
    // Very bright cover: white text on the player must still be readable.
    cover: {
      bg: 'F7F4EC',
      fg: '3A3A3A',
      palette: { dominant: '#F7F4EC', vibrant: '#E8C66A', lightVibrant: '#FFF6DA', darkVibrant: '#7A5B12', muted: '#CFC8B8', darkMuted: '#5E584C' },
    },
    tracks: [['Morning Light', 214], ['Paper Moon', 187], ['Soft Rain', 243], ['Letters Home', 201], ['Stay a While', 228]],
  },
  {
    title: 'Midnight Circuit',
    artist: 'Nocturne Lab',
    genre: 'Electronic',
    year: 2023,
    // Very dark cover.
    cover: {
      bg: '0B0B0F',
      fg: '6C7CFF',
      palette: { dominant: '#0B0B0F', vibrant: '#6C7CFF', lightVibrant: '#A9B2FF', darkVibrant: '#1B1F4D', muted: '#2A2B35', darkMuted: '#08080B' },
    },
    tracks: [['Boot Sequence', 256], ['Neon Veins', 312], ['Afterhours', 274], ['Static Bloom', 298]],
  },
  {
    title: 'Vinmeen Nights',
    artist: 'Arivu & Saindhavi',
    genre: 'Tamil Film',
    year: 2014,
    cover: {
      bg: 'B3261E',
      fg: 'FFE7C2',
      palette: { dominant: '#B3261E', vibrant: '#E0452F', lightVibrant: '#FFB199', darkVibrant: '#5E120D', muted: '#8F4A42', darkMuted: '#3B1A17' },
    },
    tracks: [['Vinmeen Vithaiyil', 299], ['Ennadi Maayavi Nee', 251], ['Kanave Kanave', 266], ['Neeye Neeye', 238], ['Oru Naal', 222]],
  },
  {
    title: 'Tidal',
    artist: 'Mira Okafor',
    genre: 'Indie',
    year: 2022,
    cover: {
      bg: '1FA6A0',
      fg: 'F2FFFD',
      palette: { dominant: '#1FA6A0', vibrant: '#27C4BC', lightVibrant: '#9FEDE8', darkVibrant: '#0C4F4C', muted: '#5E9E9A', darkMuted: '#1E3B3A' },
    },
    tracks: [['Low Tide', 205], ['Salt', 192], ['Harbour Lights', 247]],
  },
  {
    title: 'Unknown Album',
    artist: 'Unknown Artist',
    genre: 'Other',
    year: 2021,
    cover: null,
    tracks: [['Voice Memo 12', 64], ['Untitled Demo', 133], ['A Very Long Song Title That Should Scroll On Now Playing', 181]],
  },
];

const DEMO_LYRICS = `[00:00.00]Vinmeen vithaiyil (demo lyrics)
[00:06.00]Stars fall slowly into the night
[00:12.00]Every line lights up as it plays
[00:18.00]Tap a line to jump right there
[00:24.00]Scroll away, and it comes back
[00:30.00]After a few quiet seconds
[00:36.00]The last line fades to the end`;

const coverUri = (album: DemoAlbum) =>
  album.cover
    ? `https://placehold.co/600x600/${album.cover.bg}/${album.cover.fg}/png?text=${encodeURIComponent(album.title)}`
    : null;

/** Fills an empty library with the sample albums (once), using the same path as a real scan. */
export function seedDemoLibrary(db: AppDatabase): void {
  if (countSongs(db) > 0) {
    return;
  }
  const now = Date.now();
  const tracks: ScannedTrack[] = DEMO_ALBUMS.flatMap((album) =>
    album.tracks.map(([title, seconds], i) => {
      const fileName = `${String(i + 1).padStart(2, '0')} ${title}.mp3`;
      const sourceId = `Demo/${album.title}/${fileName}`;
      return {
        source: 'documents' as const,
        sourceId,
        rootId: null,
        uri: `demo://${sourceId}`,
        fileName,
        folderPath: `Demo/${album.title}`,
        fileSize: seconds * 40_000,
        mime: 'audio/mpeg',
        // Staggered so "Recently Added" has an order.
        dateAdded: now - i * 60_000,
        dateModified: now,
        durationMs: seconds * 1000,
        bitrate: 320_000,
        title,
        artist: album.artist,
        album: album.title === 'Unknown Album' ? null : album.title,
        albumArtist: album.title === 'Unknown Album' ? null : album.artist,
        genre: album.genre,
        year: album.year,
        trackNo: i + 1,
        discNo: 1,
        hasArt: album.cover != null,
        composer: null,
        comment: null,
        copyright: null,
        bpm: null,
        lyrics: title === 'Vinmeen Vithaiyil' ? DEMO_LYRICS : null,
        isPlayable: true,
        unplayableReason: null,
      };
    }),
  );

  const generation = beginScan(db);
  upsertTracks(db, new ScanContext(generation), tracks);
  finishScan(db, generation, { sources: ['documents'] }, now);
  setLastScanAt(db, now);

  // Covers and their colors (a real build reads both from the files).
  const albumRows = db.select({ id: albums.id, title: albums.title }).from(albums).all();
  for (const row of albumRows) {
    const album = DEMO_ALBUMS.find((a) => a.title === row.title);
    const uri = album ? coverUri(album) : null;
    setAlbumArtwork(db, row.id, uri, null);
    if (uri && album?.cover) {
      saveArtworkPalette(db, uri, album.cover.palette);
    }
  }

  // A playlist and a few favorites, so those screens aren't empty either.
  const songRows = db.select({ id: songs.id }).from(songs).all();
  const ids = songRows.map((s) => s.id);
  const playlist = createPlaylist(db, 'Demo Mix');
  addSongsToPlaylist(db, playlist.id, ids.filter((_, i) => i % 2 === 0));
  for (const id of ids.slice(0, 4)) {
    setFavorite(db, 'song', id, true);
  }
}

