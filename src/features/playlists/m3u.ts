/**
 * M3U / M3U8 playlists, the plain-text format most players and computers understand:
 *
 *   #EXTM3U
 *   #EXTINF:215,Anirudh - Vaathi Coming
 *   Music/Master/Vaathi Coming.mp3
 */

export type M3uEntry = {
  /** The path line as written (relative or absolute, / or \ separators). */
  path: string;
  /** From the #EXTINF line, when present. */
  title?: string;
  artist?: string;
  durationMs?: number;
};

/** The file name at the end of a path ("C:\\Music\\a b.mp3" → "a b.mp3"), URL-decoded. */
export function fileNameOf(path: string): string {
  const last = path.split(/[\\/]/).pop() ?? path;
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

export function parseM3u(text: string): M3uEntry[] {
  const entries: M3uEntry[] = [];
  let pending: Omit<M3uEntry, 'path'> | null = null;
  for (const raw of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#EXTINF:')) {
      // #EXTINF:<seconds>,<artist> - <title>   (the "artist - " part is optional)
      const [durationPart, ...rest] = line.slice('#EXTINF:'.length).split(',');
      const label = rest.join(',').trim();
      const seconds = Number.parseFloat(durationPart);
      const split = label.indexOf(' - ');
      pending = {
        durationMs: Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1000) : undefined,
        artist: split > 0 ? label.slice(0, split).trim() : undefined,
        title: (split > 0 ? label.slice(split + 3) : label).trim() || undefined,
      };
      continue;
    }
    if (line.startsWith('#')) continue;
    entries.push({ path: line, ...(pending ?? {}) });
    pending = null;
  }
  return entries;
}

export type M3uSong = { title: string; artist: string; durationMs: number; path: string };

export function buildM3u(songs: M3uSong[]): string {
  const lines = ['#EXTM3U'];
  for (const song of songs) {
    lines.push(`#EXTINF:${Math.round(song.durationMs / 1000)},${song.artist} - ${song.title}`, song.path);
  }
  return `${lines.join('\n')}\n`;
}

/** A safe file name for a playlist ("Road Trip / 2026" → "Road Trip - 2026.m3u8"). */
export function m3uFileName(playlistName: string): string {
  const cleaned = playlistName.replace(/[\\/:*?"<>|]+/g, ' - ').replace(/\s+/g, ' ').trim();
  return `${cleaned || 'Playlist'}.m3u8`;
}
