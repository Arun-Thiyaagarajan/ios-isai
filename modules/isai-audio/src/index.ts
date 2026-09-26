import { requireNativeView, requireOptionalNativeModule } from 'expo';
import type { ComponentType } from 'react';
import type { ColorValue, ViewProps } from 'react-native';

type EventSubscription = { remove(): void };

/** A queue entry as the native player needs it. */
export type NativeQueueItem = {
  key: string;
  /** Android: content:// URI. */
  uri?: string;
  /** iOS: "documents" or a folder bookmark, plus the path inside it. */
  root?: string;
  path?: string;
  title: string;
  artist: string;
  album: string | null;
  artworkUri: string | null;
  durationMs: number;
  /** Volume levelling (ReplayGain) for this song, dB; the engine picks one by mode. */
  trackGainDb?: number;
  albumGainDb?: number;
};

/** Equalizer settings for the engines (see effectsForNative in src/features/audio/equalizer.ts). */
export type NativeAudioEffects = {
  enabled: boolean;
  bandsDb: number[];
  bassDb: number;
  preampDb: number;
  replayGain: 'off' | 'track' | 'album';
};

export type NativeRepeatMode = 'off' | 'all' | 'one';

export type PlaybackStateEvent = {
  index: number;
  key: string | null;
  isPlaying: boolean;
  isBuffering: boolean;
  /** The queue played to its end. */
  ended: boolean;
  positionMs: number;
  durationMs: number;
  queueLength: number;
  repeat: NativeRepeatMode;
  /** When `positionMs` was measured (epoch ms), so the UI can advance the clock smoothly. */
  timestamp: number;
};

/** A song stopped being the current one: it finished, or the listener skipped away. */
export type TransitionEvent = {
  fromKey: string;
  toKey?: string | null;
  completed: boolean;
  playedMs: number;
  durationMs: number;
};

export type PlaybackErrorEvent = { key: string | null; message: string };

type Events = {
  onPlaybackState: (event: PlaybackStateEvent) => void;
  onTransition: (event: TransitionEvent) => void;
  onError: (event: PlaybackErrorEvent) => void;
  /** Android: the media volume changed (buttons, system panel). */
  onVolumeChange: (event: { volume: number }) => void;
};

type IsaiAudioModule = {
  setQueue(items: NativeQueueItem[], index: number, positionMs: number, play: boolean): Promise<void>;
  insert(at: number, items: NativeQueueItem[]): Promise<void>;
  remove(from: number, to: number): Promise<void>;
  move(from: number, to: number): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seekTo(positionMs: number): Promise<void>;
  skipToNext(): Promise<void>;
  skipToPrevious(): Promise<void>;
  skipTo(index: number): Promise<void>;
  setRepeatMode(mode: NativeRepeatMode): Promise<void>;
  /** Equalizer, bass boost, overall gain and levelling mode; missing in older builds. */
  setAudioEffects?(effects: NativeAudioEffects): Promise<void>;
  /** Show or hide the lock screen / notification player; missing in older builds. */
  setLockScreenControls?(enabled: boolean): Promise<void>;
  getState(): Promise<(PlaybackStateEvent & { keys: string[] }) | null>;
  /** Android only: media volume 0…1. (iOS changes volume through `VolumeView`.) */
  getVolume?(): number;
  setVolume?(volume: number): Promise<void>;
  /** Android only: opens the system output picker; false if none could be shown. */
  showOutputSwitcher?(): Promise<boolean>;
  addListener<E extends keyof Events>(event: E, listener: Events[E]): EventSubscription;
};

const native = requireOptionalNativeModule<IsaiAudioModule>('IsaiAudio');

/** False in Expo Go: playback needs Isai's development build. */
export const isAudioAvailable = native != null;

export function audio(): IsaiAudioModule {
  if (!native) {
    throw new Error('The Isai audio engine is not available in this build');
  }
  return native;
}

// ─── Output views (iOS) ──────────────────────────────────────────────────────

declare const globalThis: {
  expo?: { getViewConfig?(moduleName: string, viewName?: string): object | null };
};

/** Only builds made after the view was added have it; older ones fall back gracefully. */
function hasNativeView(name: string): boolean {
  return native != null && globalThis.expo?.getViewConfig?.('IsaiAudio', name) != null;
}

export type VolumeViewProps = ViewProps & { fillColor?: ColorValue; trackColor?: ColorValue };
export type RoutePickerViewProps = ViewProps & { buttonColor?: ColorValue; activeColor?: ColorValue };

/** iOS: the system volume slider (the only way apps may change the iPhone's volume). */
export const VolumeView: ComponentType<VolumeViewProps> | null = hasNativeView('IsaiVolumeView')
  ? requireNativeView<VolumeViewProps>('IsaiAudio', 'IsaiVolumeView')
  : null;

/** iOS: the AirPlay / Bluetooth output picker button. */
export const RoutePickerView: ComponentType<RoutePickerViewProps> | null = hasNativeView('IsaiRoutePickerView')
  ? requireNativeView<RoutePickerViewProps>('IsaiAudio', 'IsaiRoutePickerView')
  : null;
