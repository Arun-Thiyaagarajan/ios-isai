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

/** Outer padding and the gap between tiles in the 2–4 column library grids. */
export const GRID_OUTER = 16;
export const GRID_GAP = 12;

/**
 * Tile width and per-cell padding for a grid with a chosen number of columns: exact (fractional)
 * widths and equal gutters, so the row is filled perfectly on every screen size.
 * The list's content container should have `paddingHorizontal: GRID_OUTER`.
 */
export function useFixedGrid(columns: number) {
  const { width } = useWindowDimensions();
  const tileWidth = (width - GRID_OUTER * 2 - GRID_GAP * (columns - 1)) / columns;
  const cellStyle = (index: number) => {
    const column = index % columns;
    return {
      // Each cell carries its share of the gaps, so every tile ends up the same width.
      paddingLeft: (GRID_GAP * column) / columns,
      paddingRight: (GRID_GAP * (columns - 1 - column)) / columns,
      paddingBottom: GRID_GAP + 4,
    };
  };
  /**
   * For lists without horizontal padding (e.g. when full-width header rows share the list): each
   * cell is width/columns wide, so the outer margins are folded into the cells' padding too.
   */
  const edgeCellStyle = (index: number) => {
    const column = index % columns;
    const left = GRID_OUTER + column * (tileWidth + GRID_GAP) - (column * width) / columns;
    return { paddingLeft: left, paddingRight: width / columns - tileWidth - left, paddingBottom: GRID_GAP + 4 };
  };
  return { tileWidth, cellStyle, edgeCellStyle };
}
