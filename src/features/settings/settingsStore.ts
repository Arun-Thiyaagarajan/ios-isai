import { create } from 'zustand';

import { readAllSettings, writeSetting } from '@/db/repos/settings';
import type { AppDatabase } from '@/db/types';
import { themes, type ThemeName } from '@/design';
import {
  DEFAULT_PLAYER_OPTIONS,
  DEFAULT_PLAYER_THEME,
  isPlayerThemeId,
  type PlayerThemeId,
  type PlayerThemeOptions,
} from '@/theme/player/themes';

export type Settings = {
  /** App theme (Pure Black, Midnight, Aurora or Pearl). */
  theme: ThemeName;
  /** Follow the phone: Pearl in light mode, the chosen dark theme in dark mode. */
  matchSystem: boolean;
  /** Quietly look for new, changed or deleted music when Isai opens or comes back (max every 30 s). */
  autoScan: boolean;
  /** Bring back the last queue (paused, same position) when Isai opens. */
  restoreQueue: boolean;
  /** Swipe the mini player left/right to change songs. */
  miniPlayerSwipe: boolean;
  /** Phone volume slider on Now Playing. Off by default: most people use the side buttons. */
  showVolumeSlider: boolean;
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
  theme: 'midnight',
  matchSystem: true,
  autoScan: true,
  restoreQueue: true,
  miniPlayerSwipe: true,
  showVolumeSlider: false,
  lockScreenPlayer: true,
  playerTheme: DEFAULT_PLAYER_THEME,
  playerThemeOptions: DEFAULT_PLAYER_OPTIONS,
  showGreeting: true,
};

/** Guards against stored values from older versions or corrupted rows. */
const validators: { [K in keyof Settings]: (value: unknown) => value is Settings[K] } = {
  theme: (v): v is ThemeName => typeof v === 'string' && v in themes,
  matchSystem: (v): v is boolean => typeof v === 'boolean',
  autoScan: (v): v is boolean => typeof v === 'boolean',
  restoreQueue: (v): v is boolean => typeof v === 'boolean',
  miniPlayerSwipe: (v): v is boolean => typeof v === 'boolean',
  showVolumeSlider: (v): v is boolean => typeof v === 'boolean',
  lockScreenPlayer: (v): v is boolean => typeof v === 'boolean',
  playerTheme: isPlayerThemeId,
  // Individual values are checked (and defaulted) by sanitizeOptions where they're used.
  playerThemeOptions: (v): v is PlayerThemeOptions => v !== null && typeof v === 'object' && !Array.isArray(v),
  showGreeting: (v): v is boolean => typeof v === 'boolean',
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
