import { useMemo } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Icon, Segmented, Slider, Text, makeStyles, useTheme } from '@/design';
import { AlbumArtwork } from '@/features/library/components/AlbumArtwork';
import { useCurrentItem } from '@/features/player/playerStore';
import type { QueueItem } from '@/features/player/queue';
import { useSettings } from '@/features/settings/settingsStore';

import { PlayerBackground } from './PlayerBackground';
import { useResolvedPlayerTheme } from './PlayerThemeProvider';
import {
  PLAYER_THEME_IDS,
  PLAYER_THEMES,
  sanitizeOptions,
  type OptionKey,
  type PlayerThemeId,
  type PlayerThemeOptions,
} from './themes';
import { usePlayerPalette, type PlayerPalette } from './usePlayerPalette';

const COLUMNS = 2;
/** Preview cards are phone-shaped. */
const CARD_ASPECT = 1.55;

/**
 * Pick the Now Playing look. Every card is a live preview drawn with the song that's playing,
 * and changes apply immediately (the player behind this sheet updates as you go).
 */
export function PlayerThemeScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const item = useCurrentItem();
  const palette = usePlayerPalette(item);
  const selected = useSettings((s) => s.playerTheme);
  const storedOptions = useSettings((s) => s.playerThemeOptions);
  const set = useSettings((s) => s.set);
  const options = useMemo(() => sanitizeOptions(storedOptions), [storedOptions]);

  const cardWidth = Math.floor((width - theme.gutter * 2 - theme.spacing.md * (COLUMNS - 1)) / COLUMNS);
  const setOption = <K extends OptionKey>(key: K, value: PlayerThemeOptions[K]) =>
    set('playerThemeOptions', { ...options, [key]: value });
  const available = PLAYER_THEMES[selected].options;

  return (
    // The scroll view must be the sheet's root on iOS (a flex wrapper around it collapses to zero
    // height inside a form sheet); the sliders' gesture root lives inside it instead.
    <ScrollView style={styles.root} contentContainerStyle={styles.contentOuter}>
      <GestureHandlerRootView style={styles.content}>
        <View style={styles.header}>
          <Text variant="title2" accessibilityRole="header">
            Player Theme
          </Text>
          <Text variant="subhead" color="secondary">
            {item ? `Previews use “${item.title}”.` : 'Play a song to preview themes with its artwork.'}
          </Text>
        </View>

        <View style={styles.grid}>
          {PLAYER_THEME_IDS.map((id) => (
            <ThemeCard
              key={id}
              id={id}
              width={cardWidth}
              options={options}
              palette={palette}
              item={item}
              selected={id === selected}
              onPress={() => set('playerTheme', id)}
            />
          ))}
        </View>

        {available.length > 0 ? (
          <View style={styles.options}>
            <Text variant="footnote" color="secondary" style={styles.optionsTitle}>
              {`${PLAYER_THEMES[selected].name} options`.toUpperCase()}
            </Text>
            <View style={styles.optionsCard}>
              {available.includes('blurStrength') ? (
                <OptionRow title="Blur Strength">
                  <Slider
                    value={options.blurStrength}
                    onChange={(v) => setOption('blurStrength', v)}
                    accessibilityLabel="Blur strength"
                  />
                </OptionRow>
              ) : null}
              {available.includes('overlayDarkness') ? (
                <OptionRow title="Overlay Darkness" note="Made darker automatically if text would be hard to read.">
                  <Slider
                    value={options.overlayDarkness}
                    onChange={(v) => setOption('overlayDarkness', v)}
                    accessibilityLabel="Overlay darkness"
                  />
                </OptionRow>
              ) : null}
              {available.includes('gradientStyle') ? (
                <OptionRow title="Gradient Style">
                  <Segmented
                    value={options.gradientStyle}
                    choices={[
                      { value: 'linear', label: 'Linear' },
                      { value: 'radial', label: 'Radial' },
                    ]}
                    onChange={(v) => setOption('gradientStyle', v)}
                  />
                </OptionRow>
              ) : null}
              {available.includes('colorSource') ? (
                <OptionRow title="Accent Color">
                  <Segmented
                    value={options.colorSource}
                    choices={[
                      { value: 'white', label: 'White' },
                      { value: 'theme', label: 'Theme' },
                      { value: 'artwork', label: 'Artwork' },
                    ]}
                    onChange={(v) => setOption('colorSource', v)}
                  />
                </OptionRow>
              ) : null}
            </View>
          </View>
        ) : null}
      </GestureHandlerRootView>
    </ScrollView>
  );
}

function ThemeCard({
  id,
  width,
  options,
  palette,
  item,
  selected,
  onPress,
}: {
  id: PlayerThemeId;
  width: number;
  options: PlayerThemeOptions;
  palette: PlayerPalette;
  item: QueueItem | null;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const styles = useStyles();
  const resolved = useResolvedPlayerTheme(id, options, palette);
  const { tokens, background, definition } = resolved;
  const height = Math.round(width * CARD_ASPECT);
  const art = Math.round(width * 0.62);
  const bleed = background.kind === 'bleed';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${definition.name}. ${definition.description}`}
      style={({ pressed }) => [{ width }, pressed && styles.pressed]}
    >
      <View
        style={[
          styles.card,
          { height, backgroundColor: tokens.background },
          selected && { borderColor: theme.colors.accent },
        ]}
      >
        <PlayerBackground
          spec={background}
          artworkUri={palette.artworkUri}
          animate={false}
          transitionKey={`${id}|${palette.artworkUri ?? 'none'}`}
        />
        <View style={styles.preview}>
          <View style={[styles.previewArt, { width: art, height: art }]}>
            {item && !bleed ? (
              <AlbumArtwork albumId={item.albumId} artworkKey={item.artworkUri} size={art} radius={8} placeholderIcon="song" />
            ) : null}
          </View>
          <View style={styles.previewText}>
            <Text numberOfLines={1} style={[styles.previewTitle, { color: tokens.foreground }]}>
              {item?.title ?? 'Song title'}
            </Text>
            <Text numberOfLines={1} style={[styles.previewArtist, { color: tokens.secondaryForeground }]}>
              {item?.artist ?? 'Artist'}
            </Text>
          </View>
          <View style={[styles.previewTrack, { backgroundColor: tokens.progressTrack }]}>
            <View style={[styles.previewFill, { backgroundColor: tokens.progressFill }]} />
          </View>
          <View style={[styles.previewPlay, { backgroundColor: tokens.controlBackground }]}>
            <Icon name="play" size={12} color={tokens.controlForeground} />
          </View>
        </View>
        {selected ? (
          <View style={[styles.check, { backgroundColor: theme.colors.accent }]}>
            <Icon name="check" size={12} color={theme.colors.onAccent} />
          </View>
        ) : null}
      </View>
      <Text variant="subhead" numberOfLines={1} style={styles.cardName}>
        {definition.name}
      </Text>
    </Pressable>
  );
}

function OptionRow({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.optionRow}>
      <Text variant="body">{title}</Text>
      {children}
      {note ? (
        <Text variant="caption" color="secondary">
          {note}
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  root: {
    backgroundColor: t.colors.bgElevated,
  },
  contentOuter: {
    flexGrow: 1,
  },
  content: {
    paddingHorizontal: t.gutter,
    paddingTop: t.spacing.xl,
    paddingBottom: t.spacing.max,
    gap: t.spacing.xl,
  },
  header: {
    gap: t.spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.spacing.md,
    rowGap: t.spacing.lg,
  },
  card: {
    borderRadius: t.radius.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  pressed: {
    opacity: t.motion.pressedOpacity,
    transform: [{ scale: t.motion.pressedScale }],
  },
  preview: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    padding: t.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.sm,
  },
  previewArt: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  previewText: {
    alignSelf: 'stretch',
    gap: 1,
  },
  previewTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  previewArtist: {
    fontSize: 10,
  },
  previewTrack: {
    alignSelf: 'stretch',
    height: 3,
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  previewFill: {
    width: '40%',
    height: '100%',
  },
  previewPlay: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    position: 'absolute',
    top: t.spacing.sm,
    right: t.spacing.sm,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardName: {
    marginTop: t.spacing.xs,
    textAlign: 'center',
  },
  options: {
    gap: t.spacing.sm,
  },
  optionsTitle: {
    paddingHorizontal: t.spacing.xs,
  },
  optionsCard: {
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.lg,
    borderCurve: 'continuous',
    padding: t.spacing.lg,
    gap: t.spacing.xl,
  },
  optionRow: {
    gap: t.spacing.sm,
  },
}));
