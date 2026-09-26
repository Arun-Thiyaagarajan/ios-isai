import { useEffect, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { Text, makeStyles, useReducedMotion } from '@/design';

type ToastState = { message: string | null; id: number };

const useToastStore = create<ToastState>()(() => ({ message: null, id: 0 }));

const VISIBLE_MS = 2600;

/** Shows a short message at the top of the screen, e.g. "Saved" or "Couldn’t play …". */
export function showToast(message: string) {
  useToastStore.setState((s) => ({ message, id: s.id + 1 }));
}

/** Renders the current toast. Mounted once at the root, above every screen. */
export function ToastHost() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { message, id } = useToastStore();
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!message) return;
    const duration = reducedMotion ? 0 : 180;
    Animated.timing(opacity, { toValue: 1, duration, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration, useNativeDriver: true }).start(() => {
        // Only clear if no newer toast replaced this one meanwhile.
        if (useToastStore.getState().id === id) {
          useToastStore.setState({ message: null });
        }
      });
    }, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [message, id, opacity, reducedMotion]);

  if (!message) return null;

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[styles.wrap, { top: insets.top + 8, opacity }]}
    >
      <Animated.View style={styles.toast}>
        <Text variant="subhead" align="center" numberOfLines={2}>
          {message}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: t.gutter,
  },
  toast: {
    maxWidth: 480,
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.md,
    borderRadius: t.radius.xl,
    backgroundColor: t.colors.surfaceHigh,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    ...t.shadows.artwork,
  },
}));
