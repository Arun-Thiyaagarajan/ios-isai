import type { FileTags, FolderFile, MediaStoreRow } from '@modules/isai-library';
import type { ScannedTrack } from '@/db/repos/library';

import { playability } from './formats';

function trimSlashes(path: string): string {
  return path.replace(/^\/+|\/+$/g, '');
}

/** Android: one MediaStore row → scanned track. */
export function mediaStoreRowToTrack(row: MediaStoreRow): ScannedTrack {
  const relative = trimSlashes(row.relativePath ?? '');
  // Files on SD cards get the volume name in front so folders don't merge across storage.
  const onSecondaryVolume = row.volume && row.volume !== 'external_primary';
  const folderPath = onSecondaryVolume ? trimSlashes(`${row.volume}/${relative}`) : relative;

  return {
    source: 'mediastore',
    sourceId: row.id,
    rootId: null,
    uri: row.uri,
    fileName: row.fileName,
    folderPath,
    fileSize: row.fileSize,
    mime: row.mime,
    dateAdded: row.dateAdded,
    dateModified: row.dateModified,
    durationMs: row.durationMs,
    bitrate: row.bitrate,
    title: row.title,
    artist: row.artist,
    album: row.album,
    albumArtist: row.albumArtist,
    genre: row.genre,
    year: row.year,
    trackNo: row.trackNo,
    discNo: row.discNo,
    // Embedded artwork is detected when thumbnails are generated.
    hasArt: false,
    // MediaStore indexes the composer; the other details aren't available from it.
    composer: row.composer ?? null,
    comment: null,
    copyright: null,
    bpm: null,
    lyrics: null,
    ...playability('android', row.fileName, row.mime),
  };
}

/** Where an iOS file came from: the app's Documents folder or a picked folder. */
export type IosRoot =
  | { kind: 'documents'; name: string }
  | { kind: 'bookmark'; rootId: number; name: string };

/** The folder an iOS file belongs to, with the root's name on top: "Music/Artist/Album". */
export function iosFolderPath(root: IosRoot, filePath: string): string {
  const slash = filePath.lastIndexOf('/');
  const dir = slash >= 0 ? filePath.slice(0, slash) : '';
  return trimSlashes(`${root.name}/${dir}`);
}

/** iOS: a listed file plus its tags (if they could be read) → scanned track. */
export function folderFileToTrack(
  root: IosRoot,
  file: FolderFile,
  tags: FileTags | undefined,
  now: number,
): ScannedTrack {
  const slash = file.path.lastIndexOf('/');
  const fileName = slash >= 0 ? file.path.slice(slash + 1) : file.path;
  const folderPath = iosFolderPath(root, file.path);

  return {
    source: root.kind === 'documents' ? 'documents' : 'bookmark',
    // Bookmark paths are prefixed with the root id: two picked folders may contain the same path.
    sourceId: root.kind === 'documents' ? file.path : `${root.rootId}/${file.path}`,
    rootId: root.kind === 'documents' ? null : root.rootId,
    uri: file.uri,
    fileName,
    folderPath,
    fileSize: file.fileSize,
    mime: null,
    dateAdded: now,
    dateModified: file.dateModified,
    durationMs: tags?.durationMs ?? 0,
    bitrate: null,
    title: tags?.title ?? null,
    artist: tags?.artist ?? null,
    album: tags?.album ?? null,
    albumArtist: tags?.albumArtist ?? null,
    genre: tags?.genre ?? null,
    year: tags?.year ?? null,
    trackNo: tags?.trackNo ?? null,
    discNo: tags?.discNo ?? null,
    hasArt: tags?.hasArt ?? false,
    composer: tags?.composer ?? null,
    comment: tags?.comment ?? null,
    copyright: tags?.copyright ?? null,
    bpm: tags?.bpm ?? null,
    lyrics: tags?.lyrics ?? null,
    replayGain: tags
      ? {
          trackGain: tags.rgTrackGain ?? null,
          trackPeak: tags.rgTrackPeak ?? null,
          albumGain: tags.rgAlbumGain ?? null,
          albumPeak: tags.rgAlbumPeak ?? null,
        }
      : undefined,
    ...playability('ios', fileName, null),
  };
}
