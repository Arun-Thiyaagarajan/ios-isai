import * as Haptics from 'expo-haptics';

import { useSettings } from '@/features/settings/settingsStore';

/** A light tap for primary actions: play/pause, skipping songs, tabs. Never throws. */
export function tapHaptic(): void {
  if (!useSettings.getState().haptics) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

/** A warning buzz for failures (error toasts). Never throws. */
export function warningHaptic(): void {
  if (!useSettings.getState().haptics) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
}

/** A soft tick for toggles and selections: shuffle, repeat. Never throws. */
export function selectionHaptic(): void {
  if (!useSettings.getState().haptics) return;
  Haptics.selectionAsync().catch(() => undefined);
}
