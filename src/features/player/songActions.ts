import { router } from 'expo-router';

type Extra = {
  /** Set when the song is shown inside a playlist, to offer "Remove from Playlist". */
  playlistId?: number;
  entryId?: number;
};

/** Opens the song's action sheet: Play Next, Add to Queue, Add to Playlist, Favorite, Go to… */
export function openSongActions(songId: number, extra: Extra = {}) {
  router.push({
    pathname: '/song-actions',
    params: {
      songId: String(songId),
      ...(extra.playlistId !== undefined ? { playlistId: String(extra.playlistId) } : {}),
      ...(extra.entryId !== undefined ? { entryId: String(extra.entryId) } : {}),
    },
  });
}
