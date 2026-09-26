import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icon, Text, makeStyles, themeOrder, themes, useTheme, type ThemeName } from '@/design';

const CARD_WIDTH = 128;
const CARD_HEIGHT = 196;

/** A miniature of the app drawn in one theme's colors: header, now-playing card, rows, tab bar. */
function ThemePreview({ name }: { name: ThemeName }) {
  const c = themes[name].colors;
  const t = useTheme();

  const line = (width: number | `${number}%`, color: string, height = 5) => (
    <View style={{ width, height, borderRadius: height / 2, backgroundColor: color }} />
  );

  return (
    <View style={[styles.preview, { backgroundColor: c.bg, borderColor: c.border }]}>
      <View style={styles.previewHeader}>{line('45%', c.textPrimary, 7)}</View>

      <View style={[styles.previewCard, { backgroundColor: c.card, borderRadius: t.radius.sm }]}>
        <LinearGradient
          colors={c.accentGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.previewArt, { borderRadius: t.radius.xs }]}
        />
        <View style={styles.previewLines}>
          {line('90%', c.textPrimary)}
          {line('60%', c.textSecondary)}
          <View style={[styles.previewTrack, { backgroundColor: c.progressTrack }]}>
            <View style={[styles.previewFill, { backgroundColor: c.progressFill }]} />
          </View>
        </View>
      </View>

      {[0, 1, 2].map((row) => (
        <View key={row} style={styles.previewRow}>
          <View style={[styles.previewThumb, { backgroundColor: c.placeholder }]} />
          <View style={styles.previewLines}>
            {line(row === 1 ? '70%' : '85%', c.textPrimary)}
            {line('50%', c.textTertiary)}
          </View>
        </View>
      ))}

      <View style={[styles.previewNav, { backgroundColor: c.navBg, borderTopColor: c.separator }]}>
        {[0, 1, 2, 3].map((dot) => (
          <View
            key={dot}
            style={[styles.previewDot, { backgroundColor: dot === 0 ? c.accent : c.iconSecondary }]}
          />
        ))}
      </View>
    </View>
  );
}

type Props = {
  selected: ThemeName;
  onSelect: (name: ThemeName) => void;
};

/** Horizontal row of theme previews; tapping one switches the app immediately. */
export function ThemePicker({ selected, onSelect }: Props) {
  const theme = useTheme();
  const local = useStyles();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={local.row}
      accessibilityRole="radiogroup"
    >
      {themeOrder.map((name) => {
        const isSelected = name === selected;
        return (
          <Pressable
            key={name}
            onPress={() => onSelect(name)}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected }}
            accessibilityLabel={`${themes[name].label} theme. ${themes[name].description}`}
            style={({ pressed }) => [local.item, pressed && local.pressed]}
          >
            <View
              style={[
                local.ring,
                { borderColor: isSelected ? theme.colors.accent : 'transparent' },
              ]}
            >
              <ThemePreview name={name} />
            </View>
            <View style={local.label}>
              {isSelected ? <Icon name="check" size={theme.sizes.icon.sm} color={theme.colors.accentText} /> : null}
              <Text variant="subhead" color={isSelected ? 'accent' : 'primary'} numberOfLines={1}>
                {themes[name].label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const useStyles = makeStyles((t) => ({
  row: {
    paddingHorizontal: t.gutter,
    gap: t.spacing.md,
    paddingVertical: t.spacing.xs,
  },
  item: {
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  ring: {
    padding: 3,
    borderWidth: 2,
    borderRadius: t.radius.lg + 5,
  },
  label: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
  },
  pressed: {
    opacity: t.motion.pressedOpacity,
  },
}));

// Fixed miniature geometry: these are drawing coordinates for the preview, not layout spacing.
const styles = StyleSheet.create({
  preview: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    padding: 10,
    gap: 8,
  },
  previewHeader: {
    paddingTop: 6,
    paddingBottom: 2,
  },
  previewCard: {
    flexDirection: 'row',
    padding: 6,
    gap: 6,
  },
  previewArt: {
    width: 32,
    height: 32,
  },
  previewLines: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  previewTrack: {
    height: 3,
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  previewFill: {
    width: '45%',
    height: 3,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  previewThumb: {
    width: 18,
    height: 18,
    borderRadius: 3,
  },
  previewNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  previewDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
