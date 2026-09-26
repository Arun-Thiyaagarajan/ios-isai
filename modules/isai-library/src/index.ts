import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

// ─── Shared ─────────────────────────────────────────────────────────────────

export type PermissionResponse = {
  status: 'granted' | 'denied' | 'undetermined';
  granted: boolean;
  canAskAgain: boolean;
};

// ─── Android (MediaStore) ───────────────────────────────────────────────────

/** One row from MediaStore. Missing tags are null. Times are epoch milliseconds. */
export type MediaStoreRow = {
  id: string;
  uri: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  albumArtist: string | null;
  genre: string | null;
  year: number | null;
  trackNo: number | null;
  discNo: number | null;
  durationMs: number;
  fileSize: number;
  mime: string | null;
  dateAdded: number;
  dateModified: number;
  fileName: string;
  /** e.g. "Music/Artist/Album/" (no volume). */
  relativePath: string | null;
  volume: string | null;
  bitrate: number | null;
};

type AndroidLibraryModule = {
  getPermissionsAsync(): Promise<PermissionResponse>;
  requestPermissionsAsync(): Promise<PermissionResponse>;
  getMediaStoreVersion(): string;
  queryAudio(afterId: number, limit: number, minDurationMs: number): Promise<MediaStoreRow[]>;
};

// ─── iOS (folders) ──────────────────────────────────────────────────────────

/** "documents" for the app's own folder, or a bookmark string from `pickFolder`. */
export type FolderRootRef = 'documents' | string;

export type PickedFolder = { name: string; bookmark: string };

export type FolderFile = {
  /** Path relative to the root, e.g. "Artist/Album/01 Song.flac". */
  path: string;
  uri: string;
  fileSize: number;
  dateModified: number;
};

export type FolderListing = {
  files: FolderFile[];
  /** Present when iOS asked for the stored bookmark to be replaced. */
  refreshedBookmark?: string;
};

export type FileTags = {
  path: string;
  /** False when AVFoundation can't open the format (e.g. Ogg, Opus). */
  readable: boolean;
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  genre?: string;
  year?: number;
  trackNo?: number;
  discNo?: number;
  durationMs: number;
  hasArt: boolean;
};

type IosLibraryModule = {
  /** Shows the system folder picker. Resolves null when cancelled. */
  pickFolder(): Promise<PickedFolder | null>;
  listAudioFiles(root: FolderRootRef): Promise<FolderListing>;
  readTags(root: FolderRootRef, paths: string[]): Promise<FileTags[]>;
};

// ─── Module access ──────────────────────────────────────────────────────────

const native = requireOptionalNativeModule<AndroidLibraryModule & IosLibraryModule>('IsaiLibrary');

/**
 * False in Expo Go and on web: the library needs Isai's own native code,
 * which only exists in a development or release build.
 */
export const isLibraryAvailable = native != null;

export function androidLibrary(): AndroidLibraryModule {
  if (!native || Platform.OS !== 'android') {
    throw new Error('Android music library module is not available in this build');
  }
  return native;
}

export function iosLibrary(): IosLibraryModule {
  if (!native || Platform.OS !== 'ios') {
    throw new Error('iOS music library module is not available in this build');
  }
  return native;
}
