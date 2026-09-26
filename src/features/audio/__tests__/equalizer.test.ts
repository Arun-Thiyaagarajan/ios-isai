import {
  DEFAULT_EQUALIZER,
  EQ_BANDS,
  EQ_PRESETS,
  effectsForNative,
  parseReplayGainValue,
  replayGainForItem,
  sanitizeEqualizer,
} from '../equalizer';

describe('equalizer presets', () => {
  it('every preset has one value per band, within ±12 dB', () => {
    for (const preset of EQ_PRESETS) {
      expect(preset.bands).toHaveLength(EQ_BANDS.length);
      for (const db of preset.bands) expect(Math.abs(db)).toBeLessThanOrEqual(12);
    }
  });

  it('includes the Tamil film, Carnatic and vocal presets', () => {
    expect(EQ_PRESETS.map((p) => p.id)).toEqual(expect.arrayContaining(['tamilFilm', 'carnatic', 'vocal']));
  });
});

describe('sanitizeEqualizer', () => {
  it('defaults broken or missing values', () => {
    expect(sanitizeEqualizer(null)).toEqual(DEFAULT_EQUALIZER);
    expect(sanitizeEqualizer({ bands: [1, 2], preset: 'nope', bassBoost: 5, preampDb: -99 })).toEqual({
      ...DEFAULT_EQUALIZER,
      bassBoost: 1,
      preampDb: -12,
    });
  });

  it('clamps bands to ±12 dB', () => {
    const eq = sanitizeEqualizer({ enabled: true, preset: 'custom', bands: [20, -20, 0, 0, 0, 0, 0, 0, 0, 0] });
    expect(eq.bands.slice(0, 2)).toEqual([12, -12]);
  });
});

describe('effectsForNative', () => {
  it('sends a flat, bypassed chain when off', () => {
    const effects = effectsForNative({ ...DEFAULT_EQUALIZER, bands: [6, 0, 0, 0, 0, 0, 0, 0, 0, 0] }, 'track');
    expect(effects).toMatchObject({ enabled: false, bassDb: 0, preampDb: 0, replayGain: 'track' });
    expect(effects.bandsDb.every((b) => b === 0)).toBe(true);
  });

  it('lowers the overall gain by the biggest boost so loud songs don’t clip', () => {
    const effects = effectsForNative(
      { enabled: true, preset: 'custom', bands: [0, 0, 0, 0, 0, 0, 4, 0, 0, 0], bassBoost: 0, preampDb: 0 },
      'off',
    );
    expect(effects.preampDb).toBe(-4);
  });

  it('counts bass boost on top of the low bands', () => {
    const effects = effectsForNative(
      { enabled: true, preset: 'custom', bands: [3, 0, 0, 0, 0, 0, 0, 0, 0, 0], bassBoost: 1, preampDb: 0 },
      'off',
    );
    expect(effects.bassDb).toBe(9);
    expect(effects.preampDb).toBe(-12);
  });

  it('needs no headroom for cuts', () => {
    const effects = effectsForNative(
      { enabled: true, preset: 'custom', bands: [-3, -3, 0, 0, 0, 0, 0, 0, 0, 0], bassBoost: 0, preampDb: 2 },
      'off',
    );
    expect(effects.preampDb).toBe(2);
  });
});

describe('ReplayGain', () => {
  it('reads tag values in their usual forms', () => {
    expect(parseReplayGainValue('-6.54 dB')).toBe(-6.54);
    expect(parseReplayGainValue('+1.20 dB')).toBe(1.2);
    expect(parseReplayGainValue(' -8 ')).toBe(-8);
    expect(parseReplayGainValue('loud')).toBeNull();
    expect(parseReplayGainValue(null)).toBeNull();
  });

  it('uses the track and album gains, never boosting past the peak', () => {
    // Peak 0.5 allows at most +6.02 dB.
    expect(replayGainForItem({ trackGain: 9, trackPeak: 0.5, albumGain: -3, albumPeak: 0.9 })).toEqual({
      trackGainDb: 6.02,
      albumGainDb: -3,
    });
  });

  it('falls back to the track gain without an album tag, and to 0 without tags', () => {
    expect(replayGainForItem({ trackGain: -7, trackPeak: null, albumGain: null, albumPeak: null })).toEqual({
      trackGainDb: -7,
      albumGainDb: -7,
    });
    expect(replayGainForItem({ trackGain: null, trackPeak: null, albumGain: null, albumPeak: null })).toEqual({
      trackGainDb: 0,
      albumGainDb: 0,
    });
  });
});
