import { create } from 'zustand';

import { readAllSettings, writeSetting } from '@/db/repos/settings';
import type { AppDatabase } from '@/db/types';
import type { ThemePreference } from '@/design';

export type Settings = {
  themePreference: ThemePreference;
  oledBlack: boolean;
  /** Look for new, changed or deleted music every time Isai opens. */
  autoScan: boolean;
};

export const settingsDefaults: Settings = {
  themePreference: 'system',
  oledBlack: false,
  autoScan: true,
};

/** Guards against stored values from older versions or corrupted rows. */
const validators: { [K in keyof Settings]: (value: unknown) => value is Settings[K] } = {
  themePreference: (v): v is ThemePreference => v === 'system' || v === 'light' || v === 'dark',
  oledBlack: (v): v is boolean => typeof v === 'boolean',
  autoScan: (v): v is boolean => typeof v === 'boolean',
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
