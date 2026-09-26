import Svg, { Path } from 'react-native-svg';

import { brand } from '../tokens';

/** Glyph bounds from the logo source (viewBox "73 37 54 126"): width / height. */
export const ISAI_GLYPH_ASPECT = 54 / 126;

type PartProps = {
  /** Width in points; the height follows the glyph's proportions. */
  width: number;
  color: string;
};

/**
 * The play-button "dot" of the Isai "i". Drawn in the full glyph coordinate space, so it lines
 * up exactly with `IsaiLogoStem` when both are stacked at the same size.
 */
export function IsaiLogoDot({ width, color }: PartProps) {
  return (
    <Svg width={width} height={width / ISAI_GLYPH_ASPECT} viewBox="73 37 54 126">
      <Path d="M81 45L81 89L119 67Z" fill={color} stroke={color} strokeWidth={8} strokeLinejoin="round" />
    </Svg>
  );
}

/** The stem of the Isai "i". */
export function IsaiLogoStem({ width, color }: PartProps) {
  return (
    <Svg width={width} height={width / ISAI_GLYPH_ASPECT} viewBox="73 37 54 126">
      <Path d="M77 116A15 15 0 0 1 107 116L107 144A15 15 0 0 1 77 144Z" fill={color} />
    </Svg>
  );
}

/**
 * Isai logo glyph: a lowercase "i" whose dot is a play button.
 * `width` sets the size; defaults to the ink color from the brand kit.
 */
export function IsaiLogo({ width = 48, color = brand.ink }: Partial<PartProps>) {
  return (
    <Svg
      width={width}
      height={width / ISAI_GLYPH_ASPECT}
      viewBox="73 37 54 126"
      accessibilityRole="image"
      accessibilityLabel="Isai"
    >
      <Path d="M81 45L81 89L119 67Z" fill={color} stroke={color} strokeWidth={8} strokeLinejoin="round" />
      <Path d="M77 116A15 15 0 0 1 107 116L107 144A15 15 0 0 1 77 144Z" fill={color} />
    </Svg>
  );
}
