import { View } from 'react-native';

import type { IconName } from '../icons';
import { makeStyles, useTheme } from '../theme';
import { Icon } from './Icon';

/** Width of the tile; `SettingsGroup` insets its dividers by this much so they line up with titles. */
export const ICON_TILE_SIZE = 30;

/** A settings-row icon in a small tinted rounded square. */
export function IconTile({ name }: { name: IconName }) {
  const theme = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.tile}>
      <Icon name={name} size={theme.sizes.icon.sm} color={theme.colors.accentText} />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  tile: {
    width: ICON_TILE_SIZE,
    height: ICON_TILE_SIZE,
    borderRadius: t.radius.sm,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.surface,
  },
}));
