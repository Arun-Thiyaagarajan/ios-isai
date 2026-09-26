import * as Haptics from 'expo-haptics';

/** A light tap for primary actions: play/pause, skipping songs. Never throws. */
export function tapHaptic(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

/** A soft tick for toggles and selections: shuffle, repeat. Never throws. */
export function selectionHaptic(): void {
  Haptics.selectionAsync().catch(() => undefined);
}
