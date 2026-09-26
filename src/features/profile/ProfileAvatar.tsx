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
 * The listener's avatar: a round photo, or their initials on the theme accent, inside a thin ring
 * that suits the theme. Without a name or photo it shows a person glyph.
 *
 * The photo is drawn as its own circle (sized exactly inside the ring, rounded itself) rather than
 * relying on the parent to clip a square image, so it's always a clean round crop, including in
 * the iOS header. `cover` fills the circle without stretching; the photo is centered, and the
 * square crop chosen in the picker keeps the person in the middle.
 */
export function ProfileAvatar({ size, onPress, accessibilityLabel }: Props) {
  const theme = useTheme();
  const name = useSettings((s) => s.profileName);
  const photo = useSettings((s) => s.profilePhotoUri);
  const letters = initials(name);
  const ring = size >= 60 ? 2.5 : 1.5;
  const inner = size - ring * 2;

  const body = (
    <View
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          padding: ring,
          // A soft ring from the theme: dark hairline on light themes, light hairline on dark ones.
          backgroundColor: theme.colors.border,
        },
      ]}
    >
      {photo ? (
        <Image
          source={{ uri: photo }}
          style={{ width: inner, height: inner, borderRadius: inner / 2 }}
          contentFit="cover"
          contentPosition="center"
          transition={150}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={[styles.fill, { width: inner, height: inner, borderRadius: inner / 2, backgroundColor: theme.colors.accent }]}>
          {letters ? (
            <Text
              maxFontSizeMultiplier={1}
              style={{ color: theme.colors.onAccent, fontSize: inner * 0.4, fontWeight: '600', letterSpacing: 0.5 }}
            >
              {letters}
            </Text>
          ) : (
            <Icon name="person" size={Math.round(inner * 0.5)} color={theme.colors.onAccent} />
          )}
        </View>
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
  ring: {
    overflow: 'hidden',
  },
  fill: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
