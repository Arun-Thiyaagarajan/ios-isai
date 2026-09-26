import { BlurView } from 'expo-blur';
import { usePathname } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type EntryExitAnimationFunction,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FullWindowOverlay } from 'react-native-screens';
import { scheduleOnRN } from 'react-native-worklets';
import { create } from 'zustand';

import { Icon, Text, makeStyles, useReducedMotion, useReduceTransparency, useTheme, type IconName } from '@/design';
import { usePlayerStore } from '@/features/player/playerStore';
import { tapHaptic, warningHaptic } from '@/lib/haptics';

export type ToastOptions = {
  message: string;
  /** Defaults to a check mark (or a warning sign for errors). */
  icon?: IconName;
  /** `error`: warning icon in the danger color, a warning haptic, shown a little longer. */
  tone?: 'default' | 'error';
  /** Shows an Undo button and keeps the toast up longer. */
  undo?: () => void;
};

type Toast = ToastOptions & { id: number };

const useToastStore = create<{ toast: Toast | null; lastId: number }>()(() => ({ toast: null, lastId: 0 }));

/** How long a toast stays: short for confirmations, longer to read errors or reach Undo. */
const DURATION = { default: 1800, error: 3000, undo: 4000 } as const;

/**
 * A short confirmation near the bottom of the screen, like Apple Music's "Added to Library":
 * `showToast('Saved')` or `showToast({ icon: 'playNext', message: 'Playing Next', undo })`.
 * A new toast replaces the one showing.
 */
export function showToast(input: string | ToastOptions) {
  const options = typeof input === 'string' ? { message: input } : input;
  useToastStore.setState((s) => ({ toast: { ...options, id: s.lastId + 1 }, lastId: s.lastId + 1 }));
}

/** Shortcut for failures: warning icon and haptic. */
export function showErrorToast(message: string) {
  showToast({ message, tone: 'error' });
}

export function hideToast() {
  useToastStore.setState({ toast: null });
}

function hideIfCurrent(id: number) {
  if (useToastStore.getState().toast?.id === id) {
    hideToast();
  }
}

function durationFor(toast: Toast): number {
  const base = toast.undo ? DURATION.undo : toast.tone === 'error' ? DURATION.error : DURATION.default;
  // Longer messages (e.g. a restore summary) get time to be read.
  return Math.min(5000, base + Math.max(0, toast.message.length - 32) * 35);
}

// ─── Placement ──────────────────────────────────────────────────────────────

/** iOS 26+: the mini player sits in the tab bar accessory (same test as TabStackFrame; not imported, to avoid an import cycle). */
const usesTabBarAccessory = Platform.OS === 'ios' && Number.parseInt(String(Platform.Version), 10) >= 26;
/** Tab bar height above the safe area, per platform (the system draws it, so it can't be measured here). */
const TAB_BAR = Platform.OS === 'android' ? 80 : usesTabBarAccessory ? 50 : 49;
/** Mini player height plus its gap: the iOS 26 accessory, or Isai's floating bar elsewhere. */
const MINI_PLAYER = usesTabBarAccessory ? 56 : 66;
/** Full-screen players have no tab bar: sit just above their bottom row of buttons. */
const PLAYER_BOTTOM_BAR = 72;
const GAP = 10;

function useBottomOffset(): number {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const hasMiniPlayer = usePlayerStore((s) => s.queue.items.length > 0);
  if (pathname.startsWith('/player') || pathname.startsWith('/lyrics')) {
    return insets.bottom + PLAYER_BOTTOM_BAR + GAP;
  }
  return insets.bottom + TAB_BAR + (hasMiniPlayer ? MINI_PLAYER : 0) + GAP;
}

// ─── Motion ─────────────────────────────────────────────────────────────────

const entering: EntryExitAnimationFunction = () => {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ scale: 0.88 }] },
    animations: {
      opacity: withTiming(1, { duration: 200 }),
      transform: [{ scale: withSpring(1, { damping: 18, stiffness: 260, mass: 0.9 }) }],
    },
  };
};

const exiting: EntryExitAnimationFunction = () => {
  'worklet';
  return {
    initialValues: { opacity: 1, transform: [{ scale: 1 }] },
    animations: {
      opacity: withTiming(0, { duration: 180 }),
      transform: [{ scale: withTiming(0.94, { duration: 180 }) }],
    },
  };
};

// ─── Host ───────────────────────────────────────────────────────────────────

/**
 * Renders the current toast. Mounted once at the root. On iOS it draws in a window-level overlay,
 * so it also shows above Now Playing and sheets.
 */
export function ToastHost() {
  const toast = useToastStore((s) => s.toast);

  useEffect(() => {
    if (!toast) return;
    if (toast.tone === 'error') warningHaptic();
    else tapHaptic();
    AccessibilityInfo.announceForAccessibility(toast.undo ? `${toast.message}. Undo available.` : toast.message);
    const timer = setTimeout(() => hideIfCurrent(toast.id), durationFor(toast));
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <Overlay>
      <GestureHandlerRootView style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {/* Keyed by id: a new toast fades in while the old one fades out, never stacking. */}
        {toast ? <ToastCard key={toast.id} toast={toast} /> : null}
      </GestureHandlerRootView>
    </Overlay>
  );
}

function Overlay({ children }: { children: ReactNode }) {
  if (Platform.OS === 'ios') {
    return <FullWindowOverlay>{children}</FullWindowOverlay>;
  }
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {children}
    </View>
  );
}

function ToastCard({ toast }: { toast: Toast }) {
  const theme = useTheme();
  const styles = useStyles();
  const bottom = useBottomOffset();
  const reducedMotion = useReducedMotion();
  const solid = useReduceTransparency() || Platform.OS === 'android';
  const dragY = useSharedValue(0);
  const error = toast.tone === 'error';

  const dismiss = () => hideIfCurrent(toast.id);

  // Swipe down to dismiss early; a short drag springs back.
  const swipe = Gesture.Pan()
    .activeOffsetY(8)
    .onUpdate((e) => {
      dragY.set(Math.max(0, e.translationY));
    })
    .onEnd((e) => {
      if (e.translationY > 28 || e.velocityY > 600) {
        scheduleOnRN(hideIfCurrent, toast.id);
      } else {
        dragY.set(withSpring(0, { damping: 20, stiffness: 300 }));
      }
    });
  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateY: dragY.get() }] }));

  return (
    <Animated.View
      style={[styles.position, { bottom }]}
      pointerEvents="box-none"
      entering={reducedMotion ? undefined : entering}
      exiting={reducedMotion ? undefined : exiting}
    >
      <GestureDetector gesture={swipe}>
        <Animated.View style={[styles.shadow, dragStyle]}>
          <Pressable
            onPress={dismiss}
            accessibilityRole="alert"
            accessibilityLabel={toast.message}
            accessibilityHint="Tap to dismiss"
            style={styles.card}
          >
            {solid ? (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.bgElevated }]} />
            ) : (
              <>
                <BlurView
                  intensity={80}
                  tint={theme.scheme === 'dark' ? 'systemThickMaterialDark' : 'systemThickMaterialLight'}
                  style={StyleSheet.absoluteFill}
                />
                {/* A light wash of the theme surface keeps text readable over busy artwork. */}
                <View style={[StyleSheet.absoluteFill, styles.wash]} />
              </>
            )}
            <Icon
              name={toast.icon ?? (error ? 'warning' : 'check')}
              size={26}
              color={error ? theme.colors.danger : theme.colors.accentText}
            />
            <Text variant="subhead" numberOfLines={2} style={styles.message}>
              {toast.message}
            </Text>
            {toast.undo ? (
              <Pressable
                onPress={() => {
                  toast.undo?.();
                  dismiss();
                }}
                accessibilityRole="button"
                accessibilityLabel="Undo"
                hitSlop={10}
                style={({ pressed }) => [styles.undo, pressed && styles.pressed]}
              >
                <Text variant="subhead" color="accent" style={styles.undoLabel}>
                  Undo
                </Text>
              </Pressable>
            ) : null}
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const useStyles = makeStyles((t) => ({
  position: {
    position: 'absolute',
    left: t.gutter,
    right: t.gutter,
    alignItems: 'center',
  },
  shadow: {
    maxWidth: 380,
    borderRadius: t.radius.lg,
    shadowColor: '#000000',
    shadowOpacity: t.scheme === 'dark' ? 0.4 : 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    minHeight: 52,
    paddingLeft: t.spacing.lg,
    paddingRight: t.spacing.xl,
    paddingVertical: t.spacing.md,
    borderRadius: t.radius.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  },
  wash: {
    backgroundColor: t.colors.bgElevated,
    opacity: 0.55,
  },
  message: {
    flexShrink: 1,
    fontWeight: '500',
  },
  undo: {
    marginLeft: t.spacing.xs,
    marginRight: -t.spacing.xs,
    paddingHorizontal: t.spacing.xs,
    minHeight: t.sizes.touchTarget,
    justifyContent: 'center',
  },
  undoLabel: {
    fontWeight: '600',
  },
  pressed: {
    opacity: t.motion.pressedOpacity,
  },
}));
