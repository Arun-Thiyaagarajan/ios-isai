import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { Animated, Easing, StyleSheet, View, useColorScheme } from 'react-native';

import { brand, IsaiLogoDot, IsaiLogoStem, ISAI_GLYPH_ASPECT, useReducedMotion } from '@/design';

/**
 * Must match the native splash in app.config.ts (image width and background colors), so the
 * hand-off from the native splash to this animated copy is invisible.
 */
const GLYPH_WIDTH = 72;
const GLYPH_HEIGHT = GLYPH_WIDTH / ISAI_GLYPH_ASPECT;
const NATIVE_SPLASH = {
  // Must stay identical to the native splash colors in app.config.ts (native code reads those).
  light: { background: '#FFFFFF', glyph: brand.ink },
  dark: { background: brand.ink, glyph: '#FFFFFF' }, // glyph: the white splash-glyph-light.png
};

/** Center of the play-button dot within the glyph, as fractions (from the logo's viewBox). */
const DOT_CENTER = { x: (95 - 73) / 54, y: (67 - 37) / 126 };
const RING_SIZE = 60;
/**
 * Scale the dot around its own center. Given as exact point values: React Native can't parse
 * long decimal percentages in `transformOrigin` strings.
 */
export const DOT_TRANSFORM_ORIGIN: [number, number, number] = [
  Math.round(DOT_CENTER.x * GLYPH_WIDTH * 100) / 100,
  Math.round(DOT_CENTER.y * GLYPH_HEIGHT * 100) / 100,
  0,
];

// Keep the native splash up until the intro is ready to take over.
SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden (e.g. fast refresh); nothing to do.
});

/** Hides the native splash immediately (used when the app can't start normally). */
export function hideSplashNow() {
  SplashScreen.hideAsync().catch(() => undefined);
}

let played = false;

/**
 * The launch animation, shown once per cold start over the first screen:
 * the play-button dot "plays" with a soft ripple, then the logo lifts and fades into the app.
 */
export function SplashIntro() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = NATIVE_SPLASH[scheme];
  const reducedMotion = useReducedMotion();
  const [visible, setVisible] = useState(() => !played);
  const [anim] = useState(() => ({
    dot: new Animated.Value(1),
    ring: new Animated.Value(0),
    lift: new Animated.Value(0),
    fade: new Animated.Value(1),
  }));

  if (!visible) {
    return null;
  }

  const start = () => {
    played = true;
    SplashScreen.hideAsync()
      .catch(() => undefined)
      .finally(() => {
        const finish = () => setVisible(false);
        if (reducedMotion) {
          Animated.timing(anim.fade, { toValue: 0, duration: 200, delay: 100, useNativeDriver: true }).start(finish);
          return;
        }
        Animated.parallel([
          // 1. The dot "plays": a quick press and release.
          Animated.sequence([
            Animated.timing(anim.dot, {
              toValue: 1.14,
              duration: 160,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.spring(anim.dot, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 6 }),
          ]),
          // 2. A soft ring ripples out from the dot.
          Animated.timing(anim.ring, {
            toValue: 1,
            duration: 700,
            delay: 80,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          // 3. The logo lifts slightly while everything fades into the app.
          Animated.sequence([
            Animated.delay(540),
            Animated.parallel([
              Animated.timing(anim.lift, {
                toValue: 1,
                duration: 320,
                easing: Easing.in(Easing.quad),
                useNativeDriver: true,
              }),
              Animated.timing(anim.fade, {
                toValue: 0,
                duration: 320,
                easing: Easing.in(Easing.quad),
                useNativeDriver: true,
              }),
            ]),
          ]),
        ]).start(finish);
      });
  };

  const logoScale = anim.lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const ringScale = anim.ring.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.4] });
  const ringOpacity = anim.ring.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.35, 0] });

  return (
    <Animated.View
      testID="splash-intro"
      pointerEvents="none"
      onLayout={start}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: colors.background, opacity: anim.fade }]}
    >
      <Animated.View style={[styles.glyph, { transform: [{ scale: logoScale }] }]}>
        <View
          style={[
            styles.ring,
            {
              left: DOT_CENTER.x * GLYPH_WIDTH - RING_SIZE / 2,
              top: DOT_CENTER.y * GLYPH_HEIGHT - RING_SIZE / 2,
              borderColor: colors.glyph,
            },
          ]}
        >
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              styles.ringInner,
              { borderColor: colors.glyph, opacity: ringOpacity, transform: [{ scale: ringScale }] },
            ]}
          />
        </View>
        <View style={StyleSheet.absoluteFill}>
          <IsaiLogoStem width={GLYPH_WIDTH} color={colors.glyph} />
        </View>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              transformOrigin: DOT_TRANSFORM_ORIGIN,
              transform: [{ scale: anim.dot }],
            },
          ]}
        >
          <IsaiLogoDot width={GLYPH_WIDTH} color={colors.glyph} />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    elevation: 1000,
  },
  glyph: {
    width: GLYPH_WIDTH,
    height: GLYPH_HEIGHT,
  },
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderWidth: 0,
  },
  ringInner: {
    borderRadius: RING_SIZE / 2,
    borderWidth: 2,
  },
});
