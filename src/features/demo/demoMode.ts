import { isRunningInExpoGo } from 'expo';

/**
 * Expo Go can't read music files or play them (that needs Isai's native modules), so there the app
 * runs on a sample library and a pretend player, only for trying out the UI. Never true in a real
 * build.
 */
export const isDemoMode = isRunningInExpoGo();
