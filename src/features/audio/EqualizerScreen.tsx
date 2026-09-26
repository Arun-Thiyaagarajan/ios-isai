import { memo, useEffect, useMemo } from 'react';
import { Pressable, ScrollView, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { SettingsGroup, Slider, Text, Toggle, makeStyles, useTheme } from '@/design';
import { readLevellingTags } from '@/features/library/scanService';
import { useSettings } from '@/features/settings/settingsStore';
import { selectionHaptic } from '@/lib/haptics';

import {
  DEFAULT_EQUALIZER,
  EQ_BAND_LABELS,
  EQ_MAX_DB,
  EQ_PRESETS,
  sanitizeEqualizer,
  type EqualizerSettings,
  type ReplayGainMode,
} from './equalizer';

const BAND_HEIGHT = 170;
const PREAMP_MIN = -12;
const PREAMP_MAX = 6;

const LEVELLING: { value: ReplayGainMode; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'track', label: 'Track' },
  { value: 'album', label: 'Album' },
];

/**
 * Equalizer: presets, 10 bands, bass boost and overall gain, plus volume levelling. Changes are
 * heard straight away on the song that's playing.
 */
export function EqualizerScreen() {
  const styles = useStyles();
  const eq = sanitizeEqualizer(useSettings((s) => s.equalizer));
  const replayGain = useSettings((s) => s.replayGain);
  const set = useSettings((s) => s.set);

  const update = (changes: Partial<EqualizerSettings>) => set('equalizer', { ...eq, ...changes });
  const setBand = (index: number, db: number) => {
    const bands = eq.bands.map((value, i) => (i === index ? db : value));
    update({ bands, preset: 'custom', enabled: true });
  };

  return (
    // The scroll view is the sheet's root (a flex wrapper would collapse inside an iOS form sheet).
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <GestureHandlerRootView>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text variant="title2" accessibilityRole="header">
              Equalizer
            </Text>
            <Text variant="subhead" color="secondary">
              {eq.enabled ? EQ_PRESETS.find((p) => p.id === eq.preset)?.name ?? 'Custom' : 'Off'}
            </Text>
          </View>
          <Toggle
            value={eq.enabled}
            onValueChange={(enabled) => update({ enabled })}
            accessibilityLabel="Equalizer"
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presets}>
          {EQ_PRESETS.map((preset) => {
            const active = eq.enabled && eq.preset === preset.id;
            return (
              <Pressable
                key={preset.id}
                onPress={() => {
                  selectionHaptic();
                  update({ preset: preset.id, bands: preset.bands, enabled: true });
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text variant="subhead" color={active ? 'onAccent' : 'primary'} style={styles.chipLabel}>
                  {preset.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={[styles.bands, !eq.enabled && styles.dimmed]}>
          {eq.bands.map((db, index) => (
            <BandSlider key={index} label={EQ_BAND_LABELS[index]} value={db} onChange={(v) => setBand(index, v)} />
          ))}
        </View>

        <SettingsGroup title="Boost and Gain" withIcons={false}>
          <View style={styles.sliderRow}>
            <View style={styles.sliderLabel}>
              <Text variant="body">Bass Boost</Text>
              <Text variant="footnote" color="secondary" tabular>
                {eq.bassBoost === 0 ? 'Off' : `+${(eq.bassBoost * 9).toFixed(1)} dB`}
              </Text>
            </View>
            <Slider
              value={eq.bassBoost}
              onChange={(bassBoost) => update({ bassBoost, enabled: true })}
              accessibilityLabel="Bass boost"
            />
          </View>
          <View style={styles.sliderRow}>
            <View style={styles.sliderLabel}>
              <Text variant="body">Overall Gain</Text>
              <Text variant="footnote" color="secondary" tabular>
                {eq.preampDb > 0 ? '+' : ''}
                {eq.preampDb.toFixed(1)} dB
              </Text>
            </View>
            <Slider
              value={(eq.preampDb - PREAMP_MIN) / (PREAMP_MAX - PREAMP_MIN)}
              onChange={(v) => update({ preampDb: Math.round((PREAMP_MIN + v * (PREAMP_MAX - PREAMP_MIN)) * 2) / 2, enabled: true })}
              accessibilityLabel="Overall gain"
            />
          </View>
        </SettingsGroup>

        <SettingsGroup
          title="Volume Levelling"
          withIcons={false}
          footer="Plays loud and quiet songs at a similar volume using the ReplayGain tags in your files. Album keeps the loudness differences between songs of the same album. Songs without tags play unchanged."
        >
          <View style={styles.segmentedWrap}>
            <View style={styles.segmented} accessibilityRole="radiogroup">
              {LEVELLING.map((option) => {
                const active = option.value === replayGain;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      selectionHaptic();
                      set('replayGain', option.value);
                      // Android reads the tags in the background the first time levelling is on.
                      if (option.value !== 'off') readLevellingTags();
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    style={[styles.segment, active && styles.segmentActive]}
                  >
                    <Text variant="subhead" color={active ? 'onAccent' : 'primary'} style={styles.chipLabel}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </SettingsGroup>

        <Pressable
          onPress={() => set('equalizer', { ...DEFAULT_EQUALIZER, enabled: eq.enabled })}
          accessibilityRole="button"
          style={({ pressed }) => [styles.reset, pressed && styles.dimmed]}
        >
          <Text variant="body" color="accent" style={styles.chipLabel}>
            Reset to Flat
          </Text>
        </Pressable>
        <Text variant="footnote" color="secondary" style={styles.note}>
          Boosts automatically lower the overall volume a little, so loud songs never distort.
        </Text>
      </GestureHandlerRootView>
    </ScrollView>
  );
}

/** One vertical band: drag up or down (±12 dB, half-dB steps); a line marks 0 dB. */
const BandSlider = memo(function BandSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (db: number) => void;
}) {
  const theme = useTheme();
  const styles = useStyles();
  const height = useSharedValue(BAND_HEIGHT);
  const position = useSharedValue(value);
  const dragging = useSharedValue(false);
  const lastReported = useSharedValue(value);

  // Follow outside changes (presets, reset), but never fight the finger.
  useEffect(() => {
    if (!dragging.get()) {
      position.set(value);
      lastReported.set(value);
    }
  }, [value, dragging, position, lastReported]);

  const gesture = useMemo(() => {
    const update = (y: number) => {
      'worklet';
      const fraction = 1 - Math.min(1, Math.max(0, y / height.get()));
      const db = Math.round((fraction * 2 - 1) * EQ_MAX_DB * 2) / 2;
      position.set(db);
      if (db !== lastReported.get()) {
        lastReported.set(db);
        scheduleOnRN(onChange, db);
      }
    };
    return Gesture.Pan()
      .minDistance(0)
      .shouldCancelWhenOutside(false)
      .onBegin((e) => {
        dragging.set(true);
        update(e.y);
      })
      .onUpdate((e) => update(e.y))
      .onFinalize(() => {
        dragging.set(false);
      });
  }, [height, position, dragging, lastReported, onChange]);

  const fillStyle = useAnimatedStyle(() => {
    const db = position.get();
    const half = height.get() / 2;
    const size = (Math.abs(db) / EQ_MAX_DB) * half;
    return db >= 0 ? { top: half - size, height: size } : { top: half, height: size };
  });
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - (position.get() / EQ_MAX_DB + 1) / 2) * height.get() - 7 }],
  }));

  return (
    <View style={styles.band}>
      <Text variant="caption" color="secondary" tabular maxFontSizeMultiplier={1.1}>
        {value > 0 ? '+' : ''}
        {value.toFixed(value % 1 === 0 ? 0 : 1)}
      </Text>
      <GestureDetector gesture={gesture}>
        <View
          style={styles.bandTrackArea}
          onLayout={(e: LayoutChangeEvent) => {
            height.set(e.nativeEvent.layout.height);
          }}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={`${label} hertz`}
          accessibilityValue={{ text: `${value} decibels` }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => {
            const step = e.nativeEvent.actionName === 'increment' ? 1 : -1;
            onChange(Math.min(EQ_MAX_DB, Math.max(-EQ_MAX_DB, value + step)));
          }}
        >
          <View style={styles.bandTrack} />
          <View style={styles.zeroLine} />
          <Animated.View style={[styles.bandFill, { backgroundColor: theme.colors.accent }, fillStyle]} />
          <Animated.View style={[styles.bandThumb, thumbStyle]} pointerEvents="none" />
        </View>
      </GestureDetector>
      <Text variant="caption" color="secondary" maxFontSizeMultiplier={1.1}>
        {label}
      </Text>
    </View>
  );
});

const useStyles = makeStyles((t) => ({
  screen: {
    backgroundColor: t.colors.bgElevated,
  },
  content: {
    paddingTop: t.spacing.xl,
    paddingBottom: t.spacing.max,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    paddingHorizontal: t.gutter,
  },
  headerText: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  presets: {
    paddingHorizontal: t.gutter,
    paddingVertical: t.spacing.lg,
    gap: t.spacing.sm,
  },
  chip: {
    paddingHorizontal: t.spacing.lg,
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: t.colors.surface,
  },
  chipActive: {
    backgroundColor: t.colors.accent,
  },
  chipLabel: {
    fontWeight: '600',
  },
  bands: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: t.gutter,
    paddingBottom: t.spacing.md,
  },
  dimmed: {
    opacity: 0.45,
  },
  band: {
    alignItems: 'center',
    gap: t.spacing.xs,
    width: 30,
  },
  bandTrackArea: {
    width: 30,
    height: BAND_HEIGHT,
    alignItems: 'center',
  },
  bandTrack: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 4,
    borderRadius: 2,
    backgroundColor: t.colors.progressTrack,
  },
  zeroLine: {
    position: 'absolute',
    top: BAND_HEIGHT / 2 - 0.5,
    width: 14,
    height: 1,
    backgroundColor: t.colors.textTertiary,
  },
  bandFill: {
    position: 'absolute',
    width: 4,
    borderRadius: 2,
  },
  bandThumb: {
    position: 'absolute',
    top: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: t.colors.accent,
  },
  sliderRow: {
    paddingHorizontal: t.gutter,
    paddingVertical: t.spacing.md,
    gap: t.spacing.xs,
  },
  sliderLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  segmentedWrap: {
    padding: t.spacing.md,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.md,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: t.radius.sm,
  },
  segmentActive: {
    backgroundColor: t.colors.accent,
  },
  reset: {
    alignSelf: 'center',
    paddingVertical: t.spacing.md,
    paddingHorizontal: t.spacing.xl,
    marginTop: t.spacing.lg,
  },
  note: {
    textAlign: 'center',
    paddingHorizontal: t.gutter * 2,
  },
}));
