import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import type { IconName } from '../icons';
import { useTheme } from '../theme';
import { Icon } from './Icon';

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
};

export function Artwork({
  uri,
  size,
  shape = 'rounded',
  placeholderColor,
  placeholderIcon = 'song',
  recyclingKey,
}: ArtworkProps) {
  const theme = useTheme();
  const borderRadius =
    shape === 'circle' ? size / 2 : size >= 200 ? theme.radius.lg : size >= 96 ? theme.radius.md : theme.radius.sm;

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
        />
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
