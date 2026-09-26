import { Pressable, View } from 'react-native';

import { Icon, Text, makeStyles, useTheme } from '@/design';
import { selectionHaptic } from '@/lib/haptics';

import { SORT_LABELS, type GridColumns, type LibraryLayout, type SortKey } from '../viewOptions';

type Props<S extends SortKey> = {
  /** Omit for lists that have only one layout (e.g. Songs). */
  layout?: LibraryLayout;
  onLayoutChange?: (layout: LibraryLayout) => void;
  columns?: GridColumns;
  onColumnsChange?: (columns: GridColumns) => void;
  sorts: readonly S[];
  sort: S;
  descending: boolean;
  onSortChange: (sort: S) => void;
  onDescendingChange: (descending: boolean) => void;
};

/**
 * View and sort choices for a library list: List/Grid (with 2–4 columns), a sort order with a
 * check mark, and Ascending/Descending. Reusable for Albums, Songs, Artists and Playlists.
 */
export function LibraryViewOptions<S extends SortKey>({
  layout,
  onLayoutChange,
  columns,
  onColumnsChange,
  sorts,
  sort,
  descending,
  onSortChange,
  onDescendingChange,
}: Props<S>) {
  const theme = useTheme();
  const styles = useStyles();

  return (
    <View style={styles.container}>
      {layout && onLayoutChange ? (
        <View style={styles.section}>
          <SectionTitle>View</SectionTitle>
          <Segmented
            value={layout}
            choices={[
              { value: 'list', label: 'List', icon: 'list' },
              { value: 'grid', label: 'Grid', icon: 'grid' },
            ]}
            onChange={onLayoutChange}
          />
          {layout === 'grid' && columns && onColumnsChange ? (
            <View style={styles.columns}>
              <Text variant="subhead" color="secondary">
                Columns
              </Text>
              <View style={styles.columnsControl}>
                <Segmented
                  value={String(columns)}
                  choices={[
                    { value: '2', label: '2' },
                    { value: '3', label: '3' },
                    { value: '4', label: '4' },
                  ]}
                  onChange={(v) => onColumnsChange(Number(v) as GridColumns)}
                />
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionTitle>Sort by</SectionTitle>
        <View style={styles.card}>
          {sorts.map((option, index) => {
            const selected = option === sort;
            return (
              <Pressable
                key={option}
                onPress={() => {
                  selectionHaptic();
                  onSortChange(option);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={({ pressed }) => [
                  styles.sortRow,
                  index > 0 && styles.sortDivider,
                  pressed && { backgroundColor: theme.colors.surfaceHigh },
                ]}
              >
                <Text variant="body" style={styles.flex}>
                  {SORT_LABELS[option]}
                </Text>
                {selected ? <Icon name="check" size={theme.sizes.icon.md} color={theme.colors.accentText} /> : null}
              </Pressable>
            );
          })}
        </View>
        <Segmented
          value={descending ? 'desc' : 'asc'}
          choices={[
            { value: 'asc', label: 'Ascending', icon: 'sortAscending' },
            { value: 'desc', label: 'Descending', icon: 'sortDescending' },
          ]}
          onChange={(v) => onDescendingChange(v === 'desc')}
        />
      </View>
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  const styles = useStyles();
  return (
    <Text variant="footnote" color="secondary" accessibilityRole="header" style={styles.sectionTitle}>
      {children.toUpperCase()}
    </Text>
  );
}

function Segmented<T extends string>({
  value,
  choices,
  onChange,
}: {
  value: T;
  choices: { value: T; label: string; icon?: 'list' | 'grid' | 'sortAscending' | 'sortDescending' }[];
  onChange: (value: T) => void;
}) {
  const theme = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.segmented} accessibilityRole="radiogroup">
      {choices.map((choice) => {
        const active = choice.value === value;
        return (
          <Pressable
            key={choice.value}
            onPress={() => {
              if (!active) {
                selectionHaptic();
                onChange(choice.value);
              }
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={choice.label}
            style={[styles.segment, active && styles.segmentActive]}
          >
            {choice.icon ? (
              <Icon
                name={choice.icon}
                size={theme.sizes.icon.sm}
                color={active ? theme.colors.onAccent : theme.colors.textPrimary}
              />
            ) : null}
            <Text variant="subhead" color={active ? 'onAccent' : 'primary'} style={styles.segmentLabel}>
              {choice.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  container: {
    gap: t.spacing.xl,
  },
  section: {
    gap: t.spacing.sm,
  },
  sectionTitle: {
    paddingHorizontal: t.spacing.xs,
    letterSpacing: 0.4,
  },
  columns: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.spacing.md,
    paddingTop: t.spacing.xs,
  },
  columnsControl: {
    flex: 1,
    maxWidth: 200,
  },
  card: {
    backgroundColor: t.colors.card,
    borderRadius: t.radius.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: t.spacing.lg,
  },
  sortDivider: {
    borderTopWidth: t.sizes.hairline,
    borderTopColor: t.colors.separator,
  },
  flex: {
    flex: 1,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.md,
    borderCurve: 'continuous',
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.xs,
    borderRadius: t.radius.sm,
    borderCurve: 'continuous',
  },
  segmentActive: {
    backgroundColor: t.colors.accent,
  },
  segmentLabel: {
    fontWeight: '600',
  },
}));
