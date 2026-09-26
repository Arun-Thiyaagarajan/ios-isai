import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';

import {
  Icon,
  IconTile,
  ListRow,
  SettingsGroup,
  Text,
  darkThemeOrder,
  lightThemeOrder,
  makeStyles,
  themes,
  useTheme,
  type ThemeMode,
  type ThemeName,
} from '@/design';
import { showToast } from '@/features/shell/toast';
import { selectionHaptic } from '@/lib/haptics';
import { PLAYER_THEMES } from '@/theme/player/themes';

import { useSettings } from './settingsStore';

const MODES: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

/**
 * Light, Dark or System, plus which light and which dark theme to use. Each theme is a small
 * mock of Now Playing in its own colors. Changes apply instantly.
 */
export function AppearanceScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const mode = useSettings((s) => s.themeMode);
  const lightTheme = useSettings((s) => s.lightTheme);
  const darkTheme = useSettings((s) => s.darkTheme);
  const playerTheme = useSettings((s) => s.playerTheme);
  const set = useSettings((s) => s.set);

  const cardWidth = Math.floor((width - theme.gutter * 2 - theme.spacing.md * 2) / 3);

  const choose = (name: ThemeName) => {
    selectionHaptic();
    if (themes[name].scheme === 'light') {
      set('lightTheme', name as typeof lightTheme);
      // Picking a light theme while in Dark mode means "show me this": switch to Light.
      if (mode === 'dark') set('themeMode', 'light');
    } else {
      set('darkTheme', name as typeof darkTheme);
      if (mode === 'light') set('themeMode', 'dark');
    }
    showToast({ icon: 'appearance', message: `Theme: ${themes[name].label}` });
  };

  const modeNote =
    mode === 'system'
      ? `Follows your phone: ${themes[lightTheme].label} by day, ${themes[darkTheme].label} at night.`
      : mode === 'light'
        ? `Always ${themes[lightTheme].label}.`
        : `Always ${themes[darkTheme].label}.`;

  return (
    // The scroll view is the sheet's root (a flex wrapper would collapse inside an iOS form sheet).
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="title2" accessibilityRole="header" style={styles.title}>
        Appearance
      </Text>

      <View style={styles.segmented} accessibilityRole="radiogroup">
        {MODES.map((option) => {
          const active = option.value === mode;
          return (
            <Pressable
              key={option.value}
              onPress={() => {
                selectionHaptic();
                set('themeMode', option.value);
                if (option.value !== mode) {
                  showToast({ icon: 'appearance', message: `Appearance: ${option.label}` });
                }
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              style={[styles.segment, active && styles.segmentActive]}
            >
              <Text variant="subhead" color={active ? 'onAccent' : 'primary'} style={styles.segmentLabel}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text variant="footnote" color="secondary" style={styles.note}>
        {modeNote}
      </Text>

      <ThemeRow
        title="Light themes"
        names={lightThemeOrder}
        selected={lightTheme}
        dimmed={mode === 'dark'}
        width={cardWidth}
        onSelect={choose}
      />
      <ThemeRow
        title="Dark themes"
        names={darkThemeOrder}
        selected={darkTheme}
        dimmed={mode === 'light'}
        width={cardWidth}
        onSelect={choose}
      />

      <SettingsGroup title="Now Playing">
        <ListRow
          title="Player Theme"
          subtitle={PLAYER_THEMES[playerTheme].name}
          onPress={() => router.push('/player-theme')}
          leading={<IconTile name="appearance" />}
          trailing={<Icon name="chevronRight" size={theme.sizes.icon.sm} color={theme.colors.textTertiary} />}
        />
      </SettingsGroup>
    </ScrollView>
  );
}

function ThemeRow({
  title,
  names,
  selected,
  dimmed,
  width,
  onSelect,
}: {
  title: string;
  names: ThemeName[];
  selected: ThemeName;
  /** Not in use in the current mode (still selectable). */
  dimmed: boolean;
  width: number;
  onSelect: (name: ThemeName) => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <Text variant="footnote" color="secondary" accessibilityRole="header" style={styles.rowTitle}>
        {title.toUpperCase()}
      </Text>
      <View style={[styles.cards, dimmed && styles.dimmed]}>
        {names.map((name) => (
          <ThemeCard key={name} name={name} width={width} selected={name === selected} onPress={() => onSelect(name)} />
        ))}
      </View>
    </View>
  );
}

/** A miniature Now Playing drawn in one theme's colors: artwork, two lines of text, progress. */
function ThemeCard({
  name,
  width,
  selected,
  onPress,
}: {
  name: ThemeName;
  width: number;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const styles = useStyles();
  const c = themes[name].colors;
  const art = Math.round(width * 0.62);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${themes[name].label}. ${themes[name].description}`}
      style={({ pressed }) => [{ width }, pressed && styles.pressed]}
    >
      <View
        style={[
          styles.card,
          { height: Math.round(width * 1.45), backgroundColor: c.bg },
          selected ? { borderColor: theme.colors.accent } : { borderColor: c.border },
        ]}
      >
        <LinearGradient
          colors={c.accentGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.art, { width: art, height: art }]}
        />
        <View style={styles.lines}>
          <View style={[styles.line, { width: '78%', backgroundColor: c.textPrimary }]} />
          <View style={[styles.line, styles.lineThin, { width: '52%', backgroundColor: c.textSecondary }]} />
        </View>
        <View style={[styles.track, { backgroundColor: c.progressTrack }]}>
          <View style={[styles.fill, { backgroundColor: c.progressFill }]} />
        </View>
        {selected ? (
          <View style={[styles.check, { backgroundColor: theme.colors.accent }]}>
            <Icon name="check" size={11} color={theme.colors.onAccent} />
          </View>
        ) : null}
      </View>
      <Text variant="footnote" numberOfLines={1} align="center" style={styles.cardName}>
        {themes[name].label}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  screen: {
    backgroundColor: t.colors.bgElevated,
  },
  content: {
    paddingTop: t.spacing.xl,
    paddingBottom: t.spacing.max,
  },
  title: {
    paddingHorizontal: t.gutter,
    paddingBottom: t.spacing.lg,
  },
  segmented: {
    flexDirection: 'row',
    marginHorizontal: t.gutter,
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.md,
    borderCurve: 'continuous',
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: t.radius.sm,
    borderCurve: 'continuous',
  },
  segmentActive: {
    backgroundColor: t.colors.accent,
  },
  segmentLabel: {
    fontWeight: '600',
  },
  note: {
    paddingHorizontal: t.gutter,
    paddingTop: t.spacing.sm,
  },
  row: {
    paddingTop: t.spacing.xxl,
    gap: t.spacing.sm,
  },
  rowTitle: {
    paddingHorizontal: t.gutter,
    letterSpacing: 0.4,
  },
  cards: {
    flexDirection: 'row',
    paddingHorizontal: t.gutter,
    gap: t.spacing.md,
  },
  dimmed: {
    opacity: 0.55,
  },
  pressed: {
    opacity: t.motion.pressedOpacity,
    transform: [{ scale: t.motion.pressedScale }],
  },
  card: {
    borderRadius: t.radius.lg,
    borderCurve: 'continuous',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.sm,
    paddingHorizontal: t.spacing.sm,
  },
  art: {
    borderRadius: t.radius.sm,
  },
  lines: {
    alignSelf: 'stretch',
    gap: 4,
  },
  line: {
    height: 5,
    borderRadius: 2.5,
  },
  lineThin: {
    height: 4,
  },
  track: {
    alignSelf: 'stretch',
    height: 3,
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  fill: {
    width: '40%',
    height: '100%',
  },
  check: {
    position: 'absolute',
    top: t.spacing.xs,
    right: t.spacing.xs,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardName: {
    marginTop: t.spacing.xs,
  },
}));
