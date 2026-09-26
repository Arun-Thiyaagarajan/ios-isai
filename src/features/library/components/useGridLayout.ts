import { useWindowDimensions } from 'react-native';

import { useTheme } from '@/design';

/**
 * Column count and tile width for album grids: as many columns as fit at the minimum tile
 * width (2 on phones, more on tablets and in landscape), filling the width exactly.
 */
export function useGridLayout() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const gap = theme.spacing.lg;
  const available = width - theme.gutter * 2;
  const columns = Math.max(2, Math.floor((available + gap) / (theme.sizes.artworkGridMin + gap)));
  const tileWidth = Math.floor((available - gap * (columns - 1)) / columns);
  return { columns, tileWidth, gap };
}
