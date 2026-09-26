import type { ExpoConfig } from 'expo/config';

// Reverse-domain identifier shared by iOS and Android. Change before the first store upload.
const APP_ID = 'app.isai.player';

const config: ExpoConfig = {
  name: 'Isai',
  slug: 'isai',
  scheme: 'isai',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/isai-icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: APP_ID,
    supportsTablet: true,
    deploymentTarget: '17.0',
    infoPlist: {
      // Show Isai's Documents folder in the Files app ("On My iPhone › Isai") so users can add music.
      UIFileSharingEnabled: true,
      LSSupportsOpeningDocumentsInPlace: true,
      // Keep playing music with the screen locked or another app open.
      UIBackgroundModes: ['audio'],
    },
  },
  android: {
    package: APP_ID,
    // Read access to audio files indexed by MediaStore (READ_MEDIA_AUDIO on Android 13+).
    permissions: ['android.permission.READ_MEDIA_AUDIO', 'android.permission.READ_EXTERNAL_STORAGE'],
    blockedPermissions: ['android.permission.WRITE_EXTERNAL_STORAGE'],
    adaptiveIcon: {
      backgroundColor: '#FFFFFF',
      foregroundImage: './assets/isai-foreground.png',
      // Android 13+ themed icons tint this layer to match the wallpaper.
      monochromeImage: './assets/isai-foreground.png',
    },
    // Enabled once the Now Playing overlay handles back gestures (Phase 5).
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/isai-icon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        // The Isai glyph, centered; the animated intro (SplashIntro) continues from this exact frame.
        image: './assets/splash-glyph-dark.png',
        backgroundColor: '#FFFFFF',
        imageWidth: 72,
        resizeMode: 'contain',
        dark: {
          image: './assets/splash-glyph-light.png',
          backgroundColor: '#0B1020',
        },
      },
    ],
    [
      'expo-image-picker',
      {
        // Only used to choose a song cover in Edit Song Info. No camera or microphone access.
        photosPermission: 'Isai uses your photos only when you choose a cover image for a song.',
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
    [
      'expo-build-properties',
      {
        android: { minSdkVersion: 29 },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    // Build-level feature switches (read in src/config.ts).
    // false removes the lock screen / notification player and its setting from the app.
    lockScreenPlayer: true,
  },
};

export default config;
