import Constants from 'expo-constants';

type Extra = { lockScreenPlayer?: boolean };
const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

/**
 * Build-level feature switches, set in app.config.ts `extra`. A feature switched off here is
 * gone entirely: no setting, no behavior.
 */
export const config = {
  /** Lock screen and notification player, with its "Show Player on Lock Screen" setting. */
  lockScreenPlayer: extra.lockScreenPlayer !== false,
};
