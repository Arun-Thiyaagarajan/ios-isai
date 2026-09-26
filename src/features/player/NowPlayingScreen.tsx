import { useState } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState, ThemeScope, makeStyles, useTheme } from '@/design';

import { PlayerArtwork } from './nowPlaying/PlayerArtwork';
import { PlayerBottomBar } from './nowPlaying/PlayerBottomBar';
import { PlayerControls } from './nowPlaying/PlayerControls';
import { PlayerHeader } from './nowPlaying/PlayerHeader';
import { PLAYER_BACKGROUND } from './nowPlaying/playerColors';
import { TrackInfo } from './nowPlaying/TrackInfo';
import { VolumeSlider } from './nowPlaying/VolumeSlider';
import { useCurrentItem, useIsPlaying } from './playerStore';
import { ProgressBar } from './ProgressBar';

/** Side margins of the artwork and everything below it. */
const PLAYER_MARGIN = 24;

/** Now Playing: header, large artwork, song details, seek bar, controls, volume and bottom bar. */
export function NowPlayingScreen() {
  return (
    // The player is a native modal (its own view hierarchy), so gestures need their own root.
    <GestureHandlerRootView style={rootStyles.root}>
      <ThemeScope themeName="pureBlack">
        <NowPlaying />
      </ThemeScope>
    </GestureHandlerRootView>
  );
}

function NowPlaying() {
  const theme = useTheme();
  const local = useStyles();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  // The artwork gets whatever height is left after everything else, so small phones fit too.
  const [artworkArea, setArtworkArea] = useState(0);

  const item = useCurrentItem();
  const isPlaying = useIsPlaying();

  if (!item) {
    return (
      <View style={[local.screen, { paddingTop: insets.top }]}>
        <EmptyState icon="song" title="Nothing playing" message="Choose a song from your library to start listening." />
      </View>
    );
  }

  // iOS shows the player as a sheet that already starts below the status bar; Android is full screen.
  const topInset = Platform.OS === 'ios' ? 0 : insets.top;
  const maxArtwork = width - PLAYER_MARGIN * 2;
  // Before the first layout pass, estimate so the cover doesn't jump in from nothing.
  const artworkSize = Math.floor(Math.min(maxArtwork, artworkArea > 0 ? artworkArea : height * 0.4));

  return (
    <View style={local.screen}>
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
          <PlayerArtwork item={item} size={artworkSize} isPlaying={isPlaying} />
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

const rootStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PLAYER_BACKGROUND,
  },
});

const useStyles = makeStyles((t) => ({
  screen: {
    flex: 1,
    backgroundColor: PLAYER_BACKGROUND,
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
