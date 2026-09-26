import { Children, Fragment, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { makeStyles, useTheme } from '../theme';
import { ICON_TILE_SIZE } from './IconTile';
import { Text } from './Text';

type Props = {
  /** Small label above the group, e.g. "Library". */
  title?: string;
  /** Short explanation under the group. */
  footer?: string;
  /** Rows have a leading icon: dividers then start where the text starts. */
  withIcons?: boolean;
  children: ReactNode;
};

/**
 * iOS-style inset grouped section for settings: a quiet label, rows on one rounded surface
 * with hairline dividers, and an optional footer. Rows keep their own padding, so trailing
 * controls (switches, chevrons, values) share one right edge across every group.
 */
export function SettingsGroup({ title, footer, withIcons = true, children }: Props) {
  const theme = useTheme();
  const styles = useStyles();
  const rows = Children.toArray(children).filter(Boolean);
  // Row padding + icon tile + gap, so dividers line up with the titles.
  const dividerInset = withIcons ? theme.gutter + ICON_TILE_SIZE + theme.spacing.md : theme.gutter;

  return (
    <View style={styles.section}>
      {title ? (
        <Text variant="footnote" color="secondary" accessibilityRole="header" style={styles.title}>
          {title.toUpperCase()}
        </Text>
      ) : null}
      {/* Light themes lift the card with a soft shadow; the inner view clips the rounded corners. */}
      <View style={[styles.cardShadow, theme.scheme === 'light' && theme.shadows.card]}>
        <View style={styles.card}>
          {rows.map((row, index) => (
            <Fragment key={index}>
              {index > 0 ? (
                <View style={[styles.divider, { marginLeft: dividerInset, backgroundColor: theme.colors.separator }]} />
              ) : null}
              {row}
            </Fragment>
          ))}
        </View>
      </View>
      {footer ? (
        <Text variant="footnote" color="secondary" style={styles.footer}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  section: {
    paddingTop: t.spacing.xxl,
  },
  title: {
    paddingHorizontal: t.gutter * 2,
    paddingBottom: t.spacing.sm,
    letterSpacing: 0.4,
  },
  cardShadow: {
    marginHorizontal: t.gutter,
    borderRadius: t.radius.md,
  },
  card: {
    borderRadius: t.radius.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: t.colors.card,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  footer: {
    paddingHorizontal: t.gutter * 2,
    paddingTop: t.spacing.sm,
  },
}));
