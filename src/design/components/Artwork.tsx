import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import type { IconName } from '../icons';
import { useTheme } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';

export type ArtworkProps = {
  /** Local file URI of a cached thumbnail; null shows the placeholder. */
  uri?: string | null;
  size: number;
  /** Rounded square for albums/songs, circle for artists. */
  shape?: 'rounded' | 'circle';
  /** Precomputed palette color shown while the image loads. */
  placeholderColor?: string;
  placeholderIcon?: IconName;
  /** Pass the entity id so recycled list rows never flash the previous image. */
  recyclingKey?: string;
  /** Called when the image file can't be loaded (e.g. the OS cleared the cache). */
  onError?: () => void;
  /** Corner radius; by default it follows the size. */
  radius?: number;
  /** Without artwork, show this letter on a theme-tinted gradient instead of the icon. */
  placeholderLetter?: string;
};

export function Artwork({
  uri,
  size,
  shape = 'rounded',
  placeholderColor,
  placeholderIcon = 'song',
  recyclingKey,
  onError,
  radius,
  placeholderLetter,
}: ArtworkProps) {
  const theme = useTheme();
  const borderRadius =
    radius ??
    (shape === 'circle' ? size / 2 : size >= 200 ? theme.radius.lg : size >= 96 ? theme.radius.md : theme.radius.sm);

  return (
    <View
      style={[
        styles.frame,
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor: placeholderColor ?? theme.colors.placeholder,
        },
      ]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          recyclingKey={recyclingKey}
          transition={theme.motion.duration.fast}
          cachePolicy="memory-disk"
          onError={onError}
        />
      ) : placeholderLetter ? (
        <>
          <LinearGradient
            colors={[theme.colors.surfaceHigh, theme.colors.surface]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Text
            maxFontSizeMultiplier={1}
            style={{
              color: theme.colors.textSecondary,
              fontSize: Math.round(size * 0.38),
              fontWeight: '600',
              textAlign: 'center',
              // Centers the glyph itself on Android (no extra font padding above it).
              includeFontPadding: false,
              textAlignVertical: 'center',
            }}
          >
            {placeholderLetter}
          </Text>
        </>
      ) : (
        <Icon name={placeholderIcon} size={Math.round(size * 0.4)} color={theme.colors.textTertiary} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
  },
});
