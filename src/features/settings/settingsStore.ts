import { create } from 'zustand';

import { readAllSettings, writeSetting } from '@/db/repos/settings';
import type { AppDatabase } from '@/db/types';
import { themes, type DarkThemeName, type LightThemeName, type ThemeMode } from '@/design';
import {
  DEFAULT_ALBUM_VIEW,
  DEFAULT_ARTIST_VIEW,
  DEFAULT_PLAYLIST_VIEW,
  DEFAULT_SONG_VIEW,
  type AlbumViewOptions,
  type ArtistViewOptions,
  type PlaylistViewOptions,
  type SongViewOptions,
} from '@/features/library/viewOptions';
import {
  DEFAULT_PLAYER_OPTIONS,
  DEFAULT_PLAYER_THEME,
  isPlayerThemeId,
  type PlayerThemeId,
  type PlayerThemeOptions,
} from '@/theme/player/themes';

/**
 * Everything the user chooses, profile included, in one store. Saved in SQLite (`settings` table)
 * and loaded synchronously at startup, so the first frame already uses it.
 */
export type Settings = {
  // Profile
  /** Optional; shown in the Home greeting and as avatar initials. */
  profileName: string;
  /** Optional photo (a copy in the app's documents folder), shown instead of the initials. */
  profilePhotoUri: string | null;

  // Appearance
  /** Light, Dark, or System (follow the phone). */
  themeMode: ThemeMode;
  /** Used in Light mode, and in System mode when the phone is light. */
  lightTheme: LightThemeName;
  /** Used in Dark mode, and in System mode when the phone is dark. */
  darkTheme: DarkThemeName;

  // Library
  /** Quietly look for new, changed or deleted music when Isai opens or comes back (max every 30 s). */
  autoScan: boolean;
  albumsView: AlbumViewOptions;
  songsView: SongViewOptions;
  artistsView: ArtistViewOptions;
  playlistsView: PlaylistViewOptions;
  /** Show each song once when the same song is in the library more than once. */
  hideDuplicates: boolean;

  // Playback and interface
  /** Bring back the last queue (paused, same position) when Isai opens. */
  restoreQueue: boolean;
  /** Swipe the mini player left/right to change songs. */
  miniPlayerSwipe: boolean;
  /** Phone volume slider on Now Playing. Off by default: most people use the side buttons. */
  showVolumeSlider: boolean;
  /** Lyrics button on Now Playing. */
  showLyricsButton: boolean;
  /** Haptic feedback on controls and tabs. */
  haptics: boolean;
  /** Lock screen and notification player (controls, artwork, seek bar). Playback is unaffected. */
  lockScreenPlayer: boolean;
  /** Now Playing background style (separate from the app theme). */
  playerTheme: PlayerThemeId;
  /** Blur, darkness, gradient style and accent source for the player theme. */
  playerThemeOptions: PlayerThemeOptions;
  /** Time-of-day greeting at the top of Home. */
  showGreeting: boolean;
};

export const settingsDefaults: Settings = {
  profileName: '',
  profilePhotoUri: null,
  themeMode: 'system',
  lightTheme: 'isaiLight',
  darkTheme: 'isaiDark',
  autoScan: true,
  albumsView: DEFAULT_ALBUM_VIEW,
  songsView: DEFAULT_SONG_VIEW,
  artistsView: DEFAULT_ARTIST_VIEW,
  playlistsView: DEFAULT_PLAYLIST_VIEW,
  hideDuplicates: false,
  restoreQueue: true,
  miniPlayerSwipe: true,
  showVolumeSlider: false,
  showLyricsButton: true,
  haptics: true,
  lockScreenPlayer: true,
  playerTheme: DEFAULT_PLAYER_THEME,
  playerThemeOptions: DEFAULT_PLAYER_OPTIONS,
  showGreeting: true,
};

const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';
const isObject = (v: unknown): v is object => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Guards against stored values from older versions or corrupted rows. Objects are only checked
 * for shape here; their fields are cleaned (and defaulted) where they're used.
 */
const validators: { [K in keyof Settings]: (value: unknown) => value is Settings[K] } = {
  profileName: (v): v is string => typeof v === 'string',
  profilePhotoUri: (v): v is string | null => v === null || typeof v === 'string',
  themeMode: (v): v is ThemeMode => v === 'light' || v === 'dark' || v === 'system',
  lightTheme: (v): v is LightThemeName =>
    typeof v === 'string' && v in themes && themes[v as LightThemeName].scheme === 'light',
  darkTheme: (v): v is DarkThemeName =>
    typeof v === 'string' && v in themes && themes[v as DarkThemeName].scheme === 'dark',
  autoScan: isBoolean,
  albumsView: (v): v is AlbumViewOptions => isObject(v),
  songsView: (v): v is SongViewOptions => isObject(v),
  artistsView: (v): v is ArtistViewOptions => isObject(v),
  playlistsView: (v): v is PlaylistViewOptions => isObject(v),
  hideDuplicates: isBoolean,
  restoreQueue: isBoolean,
  miniPlayerSwipe: isBoolean,
  showVolumeSlider: isBoolean,
  showLyricsButton: isBoolean,
  haptics: isBoolean,
  lockScreenPlayer: isBoolean,
  playerTheme: isPlayerThemeId,
  playerThemeOptions: (v): v is PlayerThemeOptions => isObject(v),
  showGreeting: isBoolean,
};

type SettingsState = Settings & {
  hydrated: boolean;
  /** Loads saved settings synchronously so the first frame already uses them. */
  hydrate: (db: AppDatabase) => void;
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
};

let database: AppDatabase | null = null;

export const useSettings = create<SettingsState>()((set) => ({
  ...settingsDefaults,
  hydrated: false,

  hydrate: (db) => {
    database = db;
    const stored = readAllSettings(db);
    const next: Partial<Settings> = {};
    for (const key of Object.keys(settingsDefaults) as (keyof Settings)[]) {
      const value = stored[key];
      if (validators[key](value)) {
        Object.assign(next, { [key]: value });
      }
    }
    set({ ...next, hydrated: true });
  },

  set: (key, value) => {
    set({ [key]: value } as Pick<Settings, typeof key>);
    if (database) {
      writeSetting(database, key, value);
    }
  },
}));
