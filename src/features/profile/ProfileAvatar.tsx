import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, Text, useTheme } from '@/design';
import { useSettings } from '@/features/settings/settingsStore';

import { initials } from './randomNames';

type Props = {
  size: number;
  onPress?: () => void;
  accessibilityLabel?: string;
};

/**
 * The listener's avatar: their photo, or their initials on the theme accent, with a subtle ring.
 * Without a name or photo it shows a person glyph.
 */
export function ProfileAvatar({ size, onPress, accessibilityLabel }: Props) {
  const theme = useTheme();
  const name = useSettings((s) => s.profileName);
  const photo = useSettings((s) => s.profilePhotoUri);
  const letters = initials(name);
  const ring = Math.max(1.5, Math.round(size / 24));

  const body = (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.colors.accent,
          borderWidth: ring,
          borderColor: theme.colors.border,
        },
      ]}
    >
      {photo ? (
        <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      ) : letters ? (
        <Text
          maxFontSizeMultiplier={1}
          style={{ color: theme.colors.onAccent, fontSize: size * 0.4, fontWeight: '600', letterSpacing: 0.5 }}
        >
          {letters}
        </Text>
      ) : (
        <Icon name="person" size={Math.round(size * 0.5)} color={theme.colors.onAccent} />
      )}
    </View>
  );

  if (!onPress) {
    return body;
  }
  return (
    <Pressable
      onPress={onPress}
      hitSlop={Math.max(0, (theme.sizes.touchTarget - size) / 2)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (name ? `Profile, ${name}` : 'Profile and settings')}
      style={({ pressed }) => pressed && { opacity: theme.motion.pressedOpacity }}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
