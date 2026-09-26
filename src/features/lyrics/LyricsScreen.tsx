import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { db } from '@/db/client';
import { getLyrics } from '@/db/repos/lyrics';
import { EmptyState, IconButton, Text, makeStyles, useReducedMotion, useTheme } from '@/design';
import { PlayPauseButton } from '@/features/player/nowPlaying/PlayPauseButton';
import { seekTo, skipToNext, skipToPrevious } from '@/features/player/playerService';
import { useCurrentItem, useIsPlaying } from '@/features/player/playerStore';
import { ProgressBar } from '@/features/player/ProgressBar';
import { useProgress } from '@/features/player/useProgress';
import { tapHaptic } from '@/lib/haptics';
import { PlayerBackground } from '@/theme/player/PlayerBackground';
import { PlayerStatusBar, PlayerThemeProvider, usePlayerTheme } from '@/theme/player/PlayerThemeProvider';

import { activeLineIndex, parseLyrics, type SyncedLine } from './lrc';

/** After scrolling by hand, auto-scroll picks up again after this long without touching. */
const RESUME_AUTO_SCROLL_MS = 3000;
/** The active line sits about here in the visible area (from the top). */
const ACTIVE_LINE_POSITION = 1 / 3;
/** Highlight a line a moment early, so it lights up as it's sung rather than just after. */
const LOOKAHEAD_MS = 200;

/**
 * Lyrics for the song that's playing, over slowly shifting, darkened artwork colors.
 * Synced (LRC) lyrics highlight and follow the current line; tap a line to jump there.
 */
export function LyricsScreen() {
  const item = useCurrentItem();
  return (
    <GestureHandlerRootView style={styles.root}>
      {/* Aurora: blurred, darkened artwork colors that drift while the music plays. */}
      <PlayerThemeProvider item={item} themeId="aurora">
        <PlayerStatusBar />
        <Lyrics />
      </PlayerThemeProvider>
    </GestureHandlerRootView>
  );
}

function Lyrics() {
  const theme = useTheme();
  const local = useStyles();
  const insets = useSafeAreaInsets();
  const player = usePlayerTheme();
  const item = useCurrentItem();
  const isPlaying = useIsPlaying();

  const saved = useQuery({
    queryKey: ['lyrics', item?.songId],
    queryFn: () => (item ? getLyrics(db, item.songId) : null),
    enabled: item != null,
  });
  const lyrics = useMemo(() => parseLyrics(saved.data?.content), [saved.data?.content]);

  return (
    <View style={[local.screen, { backgroundColor: player.tokens.background }]}>
      <PlayerBackground
        spec={player.background}
        artworkUri={player.palette.artworkUri}
        animate={isPlaying}
        transitionKey={`lyrics|${player.palette.artworkUri ?? 'none'}`}
      />

      <View style={[local.header, { paddingTop: insets.top + theme.spacing.xs }]}>
        <IconButton icon="chevronDown" label="Close lyrics" onPress={() => router.back()} />
        <View style={local.headerText}>
          <Text variant="headline" numberOfLines={1}>
            {item?.title ?? 'Nothing playing'}
          </Text>
          {item ? (
            <Text variant="subhead" color="secondary" numberOfLines={1}>
              {item.artist}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={local.body}>
        {!item ? null : lyrics?.kind === 'synced' ? (
          <SyncedLyrics key={item.key} lines={lyrics.lines} />
        ) : lyrics?.kind === 'plain' ? (
          <PlainLyrics lines={lyrics.lines} />
        ) : saved.isFetched ? (
          <EmptyState
            icon="lyrics"
            title="No lyrics for this song"
            message="Add them with Edit Info, or put a .lrc file with the same name next to the song."
            actionLabel="Edit Info"
            onAction={() => router.replace({ pathname: '/edit-song', params: { songId: String(item.songId) } })}
          />
        ) : null}
      </View>

      {item ? (
        <View style={[local.footer, { paddingBottom: insets.bottom + theme.spacing.md }]}>
          <ProgressBar compact />
          <View style={local.controls}>
            <IconButton
              icon="previous"
              label="Previous"
              iconSize={theme.sizes.icon.xl}
              onPress={() => {
                tapHaptic();
                skipToPrevious();
              }}
            />
            <PlayPauseButton
              isPlaying={isPlaying}
              size={56}
              background={player.tokens.controlBackground}
              foreground={player.tokens.controlForeground}
            />
            <IconButton
              icon="next"
              label="Next"
              iconSize={theme.sizes.icon.xl}
              onPress={() => {
                tapHaptic();
                skipToNext();
              }}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function SyncedLyrics({ lines }: { lines: SyncedLine[] }) {
  const local = useStyles();
  const reducedMotion = useReducedMotion();
  const { positionMs } = useProgress(200);
  const active = activeLineIndex(lines, positionMs + LOOKAHEAD_MS);
  const activeShared = useSharedValue(active);
  const scrollRef = useRef<ScrollView>(null);
  const lineTops = useRef<number[]>([]);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [viewport, setViewport] = useState(0);
  const [following, setFollowing] = useState(true);

  useEffect(() => {
    activeShared.set(active);
  }, [active, activeShared]);

  // Keep the active line about a third of the way down, unless the listener is scrolling.
  useEffect(() => {
    if (!following || viewport === 0) {
      return;
    }
    const top = lineTops.current[Math.max(0, active)];
    if (top === undefined) {
      return;
    }
    scrollRef.current?.scrollTo({ y: Math.max(0, top - viewport * ACTIVE_LINE_POSITION), animated: !reducedMotion });
  }, [active, following, viewport, reducedMotion]);

  useEffect(
    () => () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    },
    [],
  );

  const pauseFollowing = () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    setFollowing(false);
  };
  const resumeFollowingSoon = () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setFollowing(true), RESUME_AUTO_SCROLL_MS);
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={local.scroll}
      contentContainerStyle={[
        local.syncedContent,
        // Room above and below, so the first and last lines can reach the reading position.
        { paddingTop: viewport * ACTIVE_LINE_POSITION, paddingBottom: viewport * 0.6 },
      ]}
      onLayout={(e: LayoutChangeEvent) => setViewport(e.nativeEvent.layout.height)}
      onScrollBeginDrag={pauseFollowing}
      onScrollEndDrag={resumeFollowingSoon}
      onMomentumScrollEnd={resumeFollowingSoon}
      showsVerticalScrollIndicator={false}
    >
      {lines.map((line, index) => (
        <LyricLine
          key={`${line.timeMs}-${index}`}
          line={line}
          index={index}
          active={activeShared}
          onLayout={(y) => {
            lineTops.current[index] = y;
          }}
          onPress={() => {
            seekTo(line.timeMs);
            if (resumeTimer.current) clearTimeout(resumeTimer.current);
            setFollowing(true);
          }}
        />
      ))}
    </ScrollView>
  );
}

function LyricLine({
  line,
  index,
  active,
  onLayout,
  onPress,
}: {
  line: SyncedLine;
  index: number;
  active: SharedValue<number>;
  onLayout: (y: number) => void;
  onPress: () => void;
}) {
  const local = useStyles();
  const reducedMotion = useReducedMotion();
  const duration = reducedMotion ? 0 : 280;

  const animated = useAnimatedStyle(() => {
    const distance = Math.abs(index - active.get());
    // Current line: full strength. Neighbours dimmed; distant lines fade further.
    const opacity = distance === 0 ? 1 : distance <= 2 ? 0.4 : 0.22;
    return {
      opacity: withTiming(opacity, { duration }),
      transform: [{ scale: withTiming(distance === 0 ? 1 : 0.96, { duration }) }],
    };
  });

  return (
    <Pressable
      onPress={onPress}
      onLayout={(e: LayoutChangeEvent) => onLayout(e.nativeEvent.layout.y)}
      accessibilityRole="button"
      accessibilityLabel={line.text || 'Instrumental'}
      accessibilityHint="Plays from this line"
    >
      <Animated.View style={[local.lineWrap, animated]}>
        <Text style={local.line} maxFontSizeMultiplier={1.3}>
          {line.text || '• • •'}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function PlainLyrics({ lines }: { lines: string[] }) {
  const local = useStyles();
  return (
    <ScrollView style={local.scroll} contentContainerStyle={local.plainContent} showsVerticalScrollIndicator={false}>
      {lines.map((line, index) =>
        line.trim() === '' ? (
          <View key={index} style={local.verseGap} />
        ) : (
          <Text key={index} style={local.plainLine} maxFontSizeMultiplier={1.4}>
            {line}
          </Text>
        ),
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

const useStyles = makeStyles((t) => ({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    paddingHorizontal: t.spacing.sm,
    paddingBottom: t.spacing.sm,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  body: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  syncedContent: {
    paddingHorizontal: t.spacing.xxl,
  },
  lineWrap: {
    // Scale from the left edge, so lines stay aligned as they grow and shrink.
    transformOrigin: 'left',
    paddingVertical: t.spacing.sm,
  },
  line: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: t.colors.textPrimary,
  },
  plainContent: {
    paddingHorizontal: t.spacing.xxl,
    paddingTop: t.spacing.lg,
    paddingBottom: t.spacing.max,
    gap: t.spacing.xs,
  },
  plainLine: {
    fontSize: 22,
    lineHeight: 32,
    fontWeight: '600',
    color: t.colors.textPrimary,
  },
  verseGap: {
    height: t.spacing.lg,
  },
  footer: {
    paddingHorizontal: t.spacing.xxl,
    paddingTop: t.spacing.sm,
    gap: t.spacing.xs,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.xxxl,
  },
}));
