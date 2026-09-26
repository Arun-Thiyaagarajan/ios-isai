/**
 * Equalizer and volume levelling (ReplayGain): the settings model, presets, and the numbers sent
 * to the native audio engines. Pure, so it's fully unit-tested; the native side only runs the
 * filters (same design on iOS and Android: gain → bass shelf → 10 peaking bands).
 */

/** Band centre frequencies (Hz), one per octave, like most 10-band equalizers. */
export const EQ_BANDS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;
export const EQ_BAND_LABELS = ['31', '62', '125', '250', '500', '1K', '2K', '4K', '8K', '16K'] as const;
/** Each band goes from -12 dB to +12 dB. */
export const EQ_MAX_DB = 12;
/** Bass boost at full strength (a low shelf around 100 Hz). */
export const BASS_BOOST_MAX_DB = 9;

export type EqualizerPresetId =
  | 'flat'
  | 'tamilFilm'
  | 'carnatic'
  | 'vocal'
  | 'bassBoost'
  | 'devotional'
  | 'acoustic'
  | 'electronic'
  | 'lateNight'
  | 'treble';

export type EqualizerPreset = { id: EqualizerPresetId; name: string; bands: number[] };

/** Tuned for common listening; bands are 31 Hz … 16 kHz in dB. */
export const EQ_PRESETS: EqualizerPreset[] = [
  { id: 'flat', name: 'Flat', bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  // Film songs: punchy low end, a little scoop in the mud, bright percussion and strings.
  { id: 'tamilFilm', name: 'Tamil Film', bands: [4, 3.5, 2, 0, -1, 0, 1.5, 2.5, 3, 2.5] },
  // Carnatic: warm mridangam, forward voice and violin, gentle air, no boom.
  { id: 'carnatic', name: 'Carnatic', bands: [0, 1, 2, 1.5, 0.5, 1.5, 3, 2.5, 1.5, 1] },
  // Voices in front: less low end, lift where speech and singing live.
  { id: 'vocal', name: 'Vocal', bands: [-2, -1.5, -1, 0.5, 2, 3.5, 3.5, 2.5, 1, 0] },
  { id: 'bassBoost', name: 'Bass Boost', bands: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0] },
  // Devotional and talks: clear words, softer highs for long listening.
  { id: 'devotional', name: 'Devotional', bands: [-1, 0, 1, 1.5, 2, 3, 2.5, 1, -0.5, -1.5] },
  { id: 'acoustic', name: 'Acoustic', bands: [2, 2, 1.5, 0.5, 0.5, 1, 2, 2.5, 2, 1] },
  { id: 'electronic', name: 'Electronic', bands: [5, 4, 1.5, 0, -1.5, 1, 0.5, 1.5, 4, 4.5] },
  // Late night: fuller at low volume, softened highs.
  { id: 'lateNight', name: 'Late Night', bands: [3, 2.5, 1.5, 0.5, 0, 0, -0.5, -1.5, -2.5, -3] },
  { id: 'treble', name: 'Treble Boost', bands: [0, 0, 0, 0, 0, 1, 2.5, 4, 5, 5.5] },
];

export type ReplayGainMode = 'off' | 'track' | 'album';

export type EqualizerSettings = {
  enabled: boolean;
  /** The chosen preset, or 'custom' once bands were moved by hand. */
  preset: EqualizerPresetId | 'custom';
  /** dB per band, EQ_BANDS order. */
  bands: number[];
  /** 0…1 */
  bassBoost: number;
  /** Overall gain in dB, -12…+6. */
  preampDb: number;
};

export const DEFAULT_EQUALIZER: EqualizerSettings = {
  enabled: false,
  preset: 'flat',
  bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  bassBoost: 0,
  preampDb: 0,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function sanitizeEqualizer(value: unknown): EqualizerSettings {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<Record<keyof EqualizerSettings, unknown>>;
  const bands =
    Array.isArray(v.bands) && v.bands.length === EQ_BANDS.length && v.bands.every(isNumber)
      ? (v.bands as number[]).map((b) => clamp(b, -EQ_MAX_DB, EQ_MAX_DB))
      : DEFAULT_EQUALIZER.bands;
  const preset =
    v.preset === 'custom' || EQ_PRESETS.some((p) => p.id === v.preset)
      ? (v.preset as EqualizerSettings['preset'])
      : DEFAULT_EQUALIZER.preset;
  return {
    enabled: v.enabled === true,
    preset,
    bands,
    bassBoost: isNumber(v.bassBoost) ? clamp(v.bassBoost, 0, 1) : 0,
    preampDb: isNumber(v.preampDb) ? clamp(v.preampDb, -12, 6) : 0,
  };
}

export function isReplayGainMode(value: unknown): value is ReplayGainMode {
  return value === 'off' || value === 'track' || value === 'album';
}

/** What the native engines apply. */
export type NativeAudioEffects = {
  enabled: boolean;
  /** 10 values, dB. */
  bandsDb: number[];
  bassDb: number;
  /** Overall gain, dB, already lowered to leave headroom for boosts. */
  preampDb: number;
  replayGain: ReplayGainMode;
};

/**
 * Boosting bands adds energy that would clip on loud songs, so the overall gain is lowered by the
 * largest boost (what "prevent clipping" does in most players). Cuts need no headroom.
 */
export function effectsForNative(eq: EqualizerSettings, replayGain: ReplayGainMode): NativeAudioEffects {
  if (!eq.enabled) {
    return { enabled: false, bandsDb: DEFAULT_EQUALIZER.bands, bassDb: 0, preampDb: 0, replayGain };
  }
  const bassDb = eq.bassBoost * BASS_BOOST_MAX_DB;
  // The bass shelf stacks on the lowest bands, so count them together.
  const loudestBoost = Math.max(0, ...eq.bands.map((db, i) => db + (i < 3 ? bassDb : 0)));
  return {
    enabled: true,
    bandsDb: eq.bands,
    bassDb,
    preampDb: round(eq.preampDb - loudestBoost),
    replayGain,
  };
}

// ─── ReplayGain ─────────────────────────────────────────────────────────────

export type ReplayGainTags = {
  trackGain: number | null;
  trackPeak: number | null;
  albumGain: number | null;
  albumPeak: number | null;
};

/** Levelling gains for one song, ready for both modes; 0 when the file has no tags. */
export type ItemGains = { trackGainDb: number; albumGainDb: number };

/** Never boost a song so much that its loudest sample would clip. */
function limitByPeak(gainDb: number, peak: number | null): number {
  if (peak === null || peak <= 0) return gainDb;
  const maxGain = -20 * Math.log10(peak);
  return Math.min(gainDb, maxGain);
}

export function replayGainForItem(tags: ReplayGainTags): ItemGains {
  const track = tags.trackGain !== null ? limitByPeak(tags.trackGain, tags.trackPeak) : 0;
  // Album mode falls back to the track value when a file has no album tag.
  const album =
    tags.albumGain !== null ? limitByPeak(tags.albumGain, tags.albumPeak ?? tags.trackPeak) : track;
  return { trackGainDb: round(track), albumGainDb: round(album) };
}

/** "-6.54 dB", "+1.2 dB", "-6.54" → number; null when unreadable. */
export function parseReplayGainValue(text: string | null | undefined): number | null {
  if (!text) return null;
  const match = text.trim().match(/^([+-]?\d+(?:\.\d+)?)/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && Math.abs(value) < 60 ? value : null;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
