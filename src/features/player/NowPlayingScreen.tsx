import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState, makeStyles, useTheme } from '@/design';
import { PlayerBackground } from '@/theme/player/PlayerBackground';
import { PlayerStatusBar, PlayerThemeProvider, usePlayerTheme } from '@/theme/player/PlayerThemeProvider';

import { PlayerArtwork } from './nowPlaying/PlayerArtwork';
import { PlayerBottomBar } from './nowPlaying/PlayerBottomBar';
import { PlayerControls } from './nowPlaying/PlayerControls';
import { PlayerHeader } from './nowPlaying/PlayerHeader';
import { TrackInfo } from './nowPlaying/TrackInfo';
import { VolumeSlider } from './nowPlaying/VolumeSlider';
import { useCurrentItem, useIsPlaying } from './playerStore';
import { ProgressBar } from './ProgressBar';

/** Side margins of the artwork and everything below it. */
const PLAYER_MARGIN = 24;

/** Now Playing: header, large artwork, song details, seek bar, controls, volume and bottom bar. */
export function NowPlayingScreen() {
  const item = useCurrentItem();
  return (
    // The player is a native modal (its own view hierarchy), so gestures need their own root.
    <GestureHandlerRootView style={styles.root}>
      <PlayerThemeProvider item={item}>
        <PlayerStatusBar />
        <NowPlaying />
      </PlayerThemeProvider>
    </GestureHandlerRootView>
  );
}

function NowPlaying() {
  const theme = useTheme();
  const local = useStyles();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const player = usePlayerTheme();
  // The artwork gets whatever height is left after everything else, so small phones fit too.
  const [artworkArea, setArtworkArea] = useState(0);

  const item = useCurrentItem();
  const isPlaying = useIsPlaying();

  if (!item) {
    return (
      <View style={[local.screen, { paddingTop: insets.top, backgroundColor: player.tokens.background }]}>
        <EmptyState icon="song" title="Nothing playing" message="Choose a song from your library to start listening." />
      </View>
    );
  }

  // Full screen on both platforms (like Apple Music), so clear the status bar ourselves.
  const topInset = insets.top;
  const maxArtwork = width - PLAYER_MARGIN * 2;
  // Before the first layout pass, estimate so the cover doesn't jump in from nothing.
  const artworkSize = Math.floor(Math.min(maxArtwork, artworkArea > 0 ? artworkArea : height * 0.4));
  // Artwork Bleed draws the cover as part of the background, edge to edge.
  const bleed = player.background.kind === 'bleed';

  return (
    <View style={[local.screen, { backgroundColor: player.tokens.background }]}>
      <PlayerBackground
        spec={player.background}
        artworkUri={player.palette.artworkUri}
        animate={isPlaying}
        transitionKey={`${player.definition.id}|${player.palette.artworkUri ?? 'none'}`}
      />
      <View
        style={[
          local.content,
          { paddingTop: topInset + theme.spacing.sm, paddingBottom: insets.bottom + theme.spacing.md },
        ]}
      >
        <View style={local.header}>
          <PlayerHeader item={item} />
        </View>

        <View
          style={local.artworkArea}
          onLayout={(e: LayoutChangeEvent) => setArtworkArea(e.nativeEvent.layout.height)}
        >
          <PlayerArtwork item={item} size={artworkSize} isPlaying={isPlaying} hidden={bleed} />
        </View>

        <TrackInfo item={item} />
        <ProgressBar />
        <PlayerControls isPlaying={isPlaying} />
        <VolumeSlider />
        <PlayerBottomBar />
      </View>
    </View>
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
  content: {
    flex: 1,
    paddingHorizontal: PLAYER_MARGIN,
    gap: t.spacing.md,
  },
  header: {
    // Icon buttons have their own padding; pull them out so the glyphs line up with the margins.
    marginHorizontal: -t.spacing.sm,
  },
  artworkArea: {
    // Takes the leftover height; the square cover is centered inside it.
    flex: 1,
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
