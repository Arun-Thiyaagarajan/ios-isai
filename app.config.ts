import type { ExpoConfig } from 'expo/config';

// Reverse-domain identifier shared by iOS and Android. Change before the first store upload.
const APP_ID = 'app.isai.player';

const config: ExpoConfig = {
  name: 'Isai',
  slug: 'isai',
  scheme: 'isai',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
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
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    // Enabled once the Now Playing overlay handles back gestures (Phase 5).
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
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
};

export default config;
