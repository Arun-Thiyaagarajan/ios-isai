import { BlurMask, Canvas, Circle, Rect } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useId, useState } from 'react';
import { AppState, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  cancelAnimation,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect as SvgRect, Stop } from 'react-native-svg';

import { useReducedMotion } from '@/design';

import type { BackgroundSpec, GradientStyle } from './themes';

/** Background crossfade when the song (or theme) changes. */
const FADE_MS = 400;

type Props = {
  spec: BackgroundSpec;
  /** Artwork image for blur and bleed backgrounds. */
  artworkUri: string | null;
  /** Aurora drifts only while music plays. */
  animate?: boolean;
  /** Changes when the song or theme changes (not when an option is being adjusted). */
  transitionKey: string;
};

type Layer = { key: string; spec: BackgroundSpec; artworkUri: string | null };

/**
 * The active player theme's background, full size behind the player. When the song changes the
 * new background fades in over the old one (instantly with Reduce Motion).
 */
export function PlayerBackground({ spec, artworkUri, animate = true, transitionKey }: Props) {
  const reducedMotion = useReducedMotion();
  const [layers, setLayers] = useState<Layer[]>(() => [{ key: transitionKey, spec, artworkUri }]);

  // A new song or theme: stack the new background on top of the old one (at most two).
  if (layers[layers.length - 1].key !== transitionKey) {
    const next = { key: transitionKey, spec, artworkUri };
    setLayers(reducedMotion ? [next] : [layers[layers.length - 1], next]);
  }

  // Once the new background has faded in, drop the one underneath.
  useEffect(() => {
    if (layers.length < 2) {
      return;
    }
    const timer = setTimeout(() => setLayers((current) => current.slice(-1)), FADE_MS + 50);
    return () => clearTimeout(timer);
  }, [layers]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {layers.map((layer, index) => {
        const top = index === layers.length - 1;
        // The top layer always shows the live spec, so option changes (sliders) apply instantly.
        const layerSpec = top ? spec : layer.spec;
        const layerArtwork = top ? artworkUri : layer.artworkUri;
        return (
          <Animated.View
            key={layer.key}
            style={StyleSheet.absoluteFill}
            entering={top && layers.length > 1 && !reducedMotion ? FadeIn.duration(FADE_MS) : undefined}
          >
            <BackgroundLayer spec={layerSpec} artworkUri={layerArtwork} animate={animate && top} />
          </Animated.View>
        );
      })}
    </View>
  );
}

function BackgroundLayer({
  spec,
  artworkUri,
  animate,
}: {
  spec: BackgroundSpec;
  artworkUri: string | null;
  animate: boolean;
}) {
  switch (spec.kind) {
    case 'solid':
      return <View style={[StyleSheet.absoluteFill, { backgroundColor: spec.color }]} />;
    case 'gradient':
      return <Gradient colors={spec.colors} style={spec.style} />;
    case 'blur':
      return (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: spec.base }]}>
          {artworkUri ? (
            <Image
              source={{ uri: artworkUri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              blurRadius={spec.blurRadius}
              cachePolicy="memory-disk"
              transition={0}
            />
          ) : null}
          {spec.gradient ? (
            <View style={[StyleSheet.absoluteFill, { opacity: spec.gradient.opacity }]}>
              <Gradient colors={spec.gradient.colors} style={spec.gradient.style} />
            </View>
          ) : null}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: spec.overlay }]} />
        </View>
      );
    case 'bleed':
      return <Bleed color={spec.color} artworkUri={artworkUri} />;
    case 'aurora':
      return <Aurora base={spec.base} blobs={spec.blobs} animate={animate} />;
  }
}

function Gradient({ colors, style }: { colors: string[]; style: GradientStyle }) {
  const id = useId().replace(/:/g, '');
  if (style === 'linear') {
    return (
      <LinearGradient
        colors={colors as [string, string, ...string[]]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
      />
    );
  }
  // Radial: the first color glows from the upper middle, fading out through the others.
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="28%" rx="85%" ry="75%" fx="50%" fy="28%">
          {colors.map((color, index) => (
            <Stop key={index} offset={index / Math.max(1, colors.length - 1)} stopColor={color} />
          ))}
        </RadialGradient>
      </Defs>
      <SvgRect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

/** The cover fills the top edge to edge, then melts into `color` where the controls sit. */
function Bleed({ color, artworkUri }: { color: string; artworkUri: string | null }) {
  const [width, setWidth] = useState(0);
  return (
    <View
      style={[StyleSheet.absoluteFill, { backgroundColor: color }]}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
    >
      {artworkUri && width > 0 ? (
        <View style={{ width, height: width }}>
          <Image source={{ uri: artworkUri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
          <LinearGradient
            colors={[`${color}00`, `${color}00`, `${color}CC`, color]}
            locations={[0, 0.45, 0.8, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>
      ) : null}
    </View>
  );
}

/** How long one full drift cycle takes. */
const AURORA_CYCLE_MS = 24_000;

/**
 * Soft blobs of the cover's colors drifting over a dark base, blurred into each other.
 * Pauses while the music is paused or the app is in the background.
 */
function Aurora({ base, blobs, animate }: { base: string; blobs: string[]; animate: boolean }) {
  const reducedMotion = useReducedMotion();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const phase = useSharedValue(0);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);

  const running = animate && foreground && !reducedMotion;
  useEffect(() => {
    if (!running) {
      cancelAnimation(phase);
      return;
    }
    // Drift from wherever it paused; the motion is periodic, so each repeat continues seamlessly.
    const from = phase.get();
    phase.set(withRepeat(withTiming(from + 1, { duration: AURORA_CYCLE_MS, easing: Easing.linear }), -1));
    return () => cancelAnimation(phase);
  }, [running, phase]);

  const { width, height } = size;
  const radius = Math.max(width, height) * 0.42;

  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(e: LayoutChangeEvent) =>
        setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })
      }
    >
      {width > 0 ? (
        <Canvas style={StyleSheet.absoluteFill}>
          <Rect x={0} y={0} width={width} height={height} color={base} />
          {blobs.map((color, index) => (
            <Blob
              key={index}
              index={index}
              color={color}
              phase={phase}
              width={width}
              height={height}
              radius={radius}
            />
          ))}
        </Canvas>
      ) : null}
    </View>
  );
}

/** Each blob circles its own anchor point at its own pace. */
const BLOB_PATHS = [
  { x: 0.25, y: 0.2, dx: 0.18, dy: 0.1, speed: 1 },
  { x: 0.8, y: 0.35, dx: 0.12, dy: 0.16, speed: 2 },
  { x: 0.3, y: 0.7, dx: 0.16, dy: 0.12, speed: -1 },
  { x: 0.75, y: 0.85, dx: 0.14, dy: 0.1, speed: -2 },
];

function Blob({
  index,
  color,
  phase,
  width,
  height,
  radius,
}: {
  index: number;
  color: string;
  phase: SharedValue<number>;
  width: number;
  height: number;
  radius: number;
}) {
  const path = BLOB_PATHS[index % BLOB_PATHS.length];
  const cx = useDerivedValue(
    () => (path.x + path.dx * Math.cos(phase.get() * Math.PI * 2 * path.speed + index)) * width,
  );
  const cy = useDerivedValue(
    () => (path.y + path.dy * Math.sin(phase.get() * Math.PI * 2 * path.speed + index)) * height,
  );
  return (
    <Circle cx={cx} cy={cy} r={radius} color={color} opacity={0.55}>
      <BlurMask blur={radius * 0.6} style="normal" />
    </Circle>
  );
}
