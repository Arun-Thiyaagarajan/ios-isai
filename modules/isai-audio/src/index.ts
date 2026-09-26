import { requireOptionalNativeModule } from 'expo';

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
  getState(): Promise<(PlaybackStateEvent & { keys: string[] }) | null>;
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
