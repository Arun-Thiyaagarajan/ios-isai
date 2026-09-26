import { ScrollView, StyleSheet, View } from 'react-native';

import {
  Artwork,
  Button,
  EmptyState,
  Icon,
  IconButton,
  ListRow,
  SectionHeader,
  Skeleton,
  Surface,
  Text,
  makeStyles,
  useTheme,
  type IconName,
} from '@/design';
import { icons } from '@/design/icons';
import { typography, type TypeRoleName } from '@/design/tokens';

/** Development-only page for checking every component in the current theme and font size. */
export default function DesignGallery() {
  const theme = useTheme();
  const styles = useStyles();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: theme.colors.bg }}
      contentContainerStyle={styles.bottom}
    >
      <SectionHeader title="Typography" />
      <View style={styles.block}>
        {(Object.keys(typography) as TypeRoleName[]).map((variant) => (
          <Text key={variant} variant={variant} numberOfLines={1}>
            {variant} · Isai இசை
          </Text>
        ))}
        <Text variant="subhead" color="secondary">
          Secondary text
        </Text>
        <Text variant="subhead" color="tertiary">
          Tertiary text
        </Text>
        <Text variant="subhead" color="accent">
          Accent text
        </Text>
        <Text variant="footnote" color="secondary" tabular>
          1:07 / 12:34 (tabular digits)
        </Text>
      </View>

      <SectionHeader title="Colors" />
      <View style={[styles.block, styles.wrap]}>
        {Object.entries(theme.colors).map(([name, value]) => (
          <View key={name} style={styles.swatchItem}>
            <View style={[styles.swatch, { backgroundColor: value }]} />
            <Text variant="caption" color="secondary" numberOfLines={1}>
              {name}
            </Text>
          </View>
        ))}
      </View>

      <SectionHeader title="Icons" />
      <View style={[styles.block, styles.wrap]}>
        {(Object.keys(icons) as IconName[]).map((name) => (
          <View key={name} style={styles.iconItem}>
            <Icon name={name} />
            <Text variant="caption" color="secondary" numberOfLines={1}>
              {name}
            </Text>
          </View>
        ))}
      </View>

      <SectionHeader title="Buttons" />
      <View style={styles.block}>
        <View style={styles.row}>
          <Button label="Play" icon="play" fill />
          <Button label="Shuffle" icon="shuffle" variant="secondary" fill />
        </View>
        <View style={[styles.row, styles.center]}>
          <IconButton icon="shuffle" label="Shuffle" />
          <IconButton icon="previous" label="Previous" iconSize={theme.sizes.icon.xl} />
          <IconButton
            icon="play"
            label="Play"
            variant="filled"
            size={theme.sizes.playButton}
            iconSize={theme.sizes.icon.xl + 4}
          />
          <IconButton icon="next" label="Next" iconSize={theme.sizes.icon.xl} />
          <IconButton icon="repeat" label="Repeat" selected />
        </View>
        <View style={[styles.row, styles.center]}>
          <IconButton icon="favoriteFilled" label="Favorite" variant="tonal" selected />
          <IconButton icon="queue" label="Queue" variant="tonal" />
          <IconButton icon="more" label="More" variant="tonal" />
          <IconButton icon="delete" label="Delete" disabled />
        </View>
      </View>

      <SectionHeader title="Surfaces" />
      <View style={styles.block}>
        <View style={styles.surfaceStage}>
          <Artwork size={120} placeholderColor={theme.colors.accent} placeholderIcon="album" />
          <Surface variant="glass" interactive style={styles.floating}>
            <Text variant="headline">Glass</Text>
          </Surface>
        </View>
        <Surface variant="tonal" style={styles.card}>
          <Text variant="headline">Tonal</Text>
          <Text variant="footnote" color="secondary">
            Android chrome, cards, filled controls
          </Text>
        </Surface>
      </View>

      <SectionHeader title="Artwork" />
      <View style={[styles.block, styles.row]}>
        <Artwork size={theme.sizes.artworkRow} />
        <Artwork size={96} placeholderIcon="album" />
        <Artwork size={96} shape="circle" placeholderIcon="artist" />
      </View>

      <SectionHeader title="List rows" actionLabel="See All" onAction={() => {}} />
      <ListRow
        title="A very long song title that keeps going and going past the edge"
        subtitle="Artist Name · Album Name That Is Also Quite Long"
        leading={<Artwork size={theme.sizes.artworkRow} />}
        trailing={<IconButton icon="more" label="More actions" />}
      />
      <ListRow
        title="Now playing row"
        subtitle="Highlighted with the accent color"
        active
        leading={<Artwork size={theme.sizes.artworkRow} />}
        trailing={
          <Text variant="footnote" color="secondary" tabular>
            3:12
          </Text>
        }
      />

      <SectionHeader title="Loading" />
      <View style={[styles.block, styles.row]}>
        <Skeleton width={theme.sizes.artworkRow} height={theme.sizes.artworkRow} />
        <View style={styles.flex}>
          <Skeleton width="80%" height={14} />
          <Skeleton width="50%" height={12} />
        </View>
      </View>

      <SectionHeader title="Empty state" />
      <EmptyState
        icon="folder"
        title="No music found"
        message="Add a folder to start building your library."
        actionLabel="Add Folder"
        onAction={() => {}}
      />
    </ScrollView>
  );
}

const useStyles = makeStyles((t) => ({
  bottom: {
    paddingBottom: t.spacing.max,
  },
  block: {
    paddingHorizontal: t.gutter,
    gap: t.spacing.md,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
  },
  center: {
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
    gap: t.spacing.sm,
  },
  swatchItem: {
    width: 72,
    gap: t.spacing.xs,
  },
  swatch: {
    height: 40,
    borderRadius: t.radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.separator,
  },
  iconItem: {
    width: 72,
    alignItems: 'center',
    gap: t.spacing.xs,
  },
  surfaceStage: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floating: {
    position: 'absolute',
    bottom: t.spacing.md,
    paddingHorizontal: t.spacing.xxl,
    paddingVertical: t.spacing.md,
    borderRadius: t.radius.full,
  },
  card: {
    padding: t.spacing.lg,
    borderRadius: t.radius.lg,
    gap: t.spacing.xs,
  },
}));
