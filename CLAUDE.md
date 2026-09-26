@AGENTS.md

> **Current phase:** Modules 1–8 + Now Playing redesign done. Player themes: `src/theme/player/` (`palette.ts` colors from artwork, `themes.ts` 8 themes + tokens, contrast-tested at 4.5:1; `PlayerThemeProvider` swaps player colors into a `ThemeScope`; `PlayerBackground` draws layers with a 400 ms crossfade; picker at `/player-theme`). Artwork colors come from native extractors (`getImageColors`, palette with each thumbnail) cached in `artwork_palettes`. Lyrics: `src/features/lyrics/` (LRC parser, synced/plain screen over the Aurora theme; iOS reads `.lrc` next to songs). Scanning: `startLibraryWatcher()` is the only automatic trigger; unchanged files are skipped and screens refresh only when `finishScan` reports a change; bump `TAG_RULES_VERSION` to force one full re-read. Settings: player theme, volume slider (off by default), lock screen player (`config.lockScreenPlayer` in `app.config.ts` extra). Reanimated: use `.get()/.set()` (React Compiler lint). Next: Module 9 (drag-to-reorder, sleep timer, sorting + A–Z), then mini→full player animation and progress styles.

# Isai — Technical & Product Plan

> **Isai** (இசை, "music"): a premium offline music player for iOS and Android.
> The feature depth takes cues from players like Oto Music. Isai uses its own branding, visual identity, assets and code.

---

## 0. Context

**Why this plan exists.** You want to build a local-first music player that feels premium. It needs a deep library, reliable background playback, wide format support, advanced audio, platform-native UI (Liquid Glass on iOS 26+) and good performance with 50k+ songs. It should stay small enough for one developer to maintain.

**Starting point (verified).** `D:\Programming\ios-isai` is an untouched `create-expo-app` blank TypeScript template:

- `expo ~57.0.25`, `react-native 0.86.3`, `react 19.2.3`, TypeScript 6 (strict)
- `App.tsx` and `index.ts` use the classic entry, with no router yet
- `app.json` has name/slug `ios-isai`, `userInterfaceStyle: "light"` (needs to change to `automatic`) and `predictiveBackGestureEnabled: false`
- `AGENTS.md` rules:
  - use Expo Router with routes in `src/app/`
  - use CNG (never hand-edit `ios/` or `android/`; use config plugins)
  - use `npx expo install`
  - run lint and `tsc` before calling anything done
  - check versioned docs, and don't trust memory

**Constraints from you:** you have a Mac, so iOS and Android are built together. The app will be **free on the stores**, so we avoid commercially licensed SDKs and keep LGPL obligations manageable.

**What I checked against current docs/repos (Sept 2026):**

| Fact | Consequence |
|---|---|
| `expo-router/unstable-native-tabs` provides `NativeTabs`, `NativeTabs.BottomAccessory` (iOS), `minimizeBehavior`, and `role: 'search'`. It is still **unstable**. | Use it for the native Liquid Glass tab bar and iOS 26 mini-player accessory. Wrap it behind our own `AppTabs` component so we can switch to JS tabs if the API churns. |
| `expo-glass-effect` provides `GlassView`, `GlassContainer`, `isLiquidGlassAvailable()` and `isGlassEffectAPIAvailable()`. It falls back to a plain `View`. `opacity: 0` breaks the glass. | Use it for custom glass surfaces. Don't fade glass with opacity; use its `animate` props or animate a wrapper. |
| `expo-sqlite` supports FTS5 (`enableFTS`, on by default), sync APIs, `addDatabaseChangeListener`, Drizzle integration and `expo-sqlite/kv-store`. | Use it as the single storage engine. No MMKV or op-sqlite needed. |
| `expo-audio` has `AudioPlaylist`, lock-screen metadata and playback rate, but **no EQ or effects API**. It uses platform decoders (AVPlayer on iOS, so no Ogg). | Not enough for Isai's audio goals. |
| React Native Track Player **v5** (May 2026, `@rntp/player`) is a new-architecture rewrite and **commercially licensed** (free for personal use only). v4 is frozen. | Rejected for the core engine. See §5. |
| SFBAudioEngine is MIT, iOS 15+, built on AVAudioEngine with a customizable processing graph. It decodes everything Core Audio can, plus Ogg Vorbis, Opus, FLAC (libFLAC), WavPack, Monkey's Audio, Musepack, DSD and more. It reads and writes metadata. | The iOS playback and tag backbone. |

---

## 1. Product Overview

Isai is an **offline-first local music player**:

- It indexes music already on the device (Android) or in folders the user grants (iOS).
- It plays that music with a native, background-safe audio engine.
- It wraps it all in a calm, typographic, artwork-led UI.
- There are no accounts, no cloud and no analytics.

Every screen should answer "what do I want to hear now?" quickly, and the Now Playing screen should feel like the heart of the app.

**Product pillars**
1. **Reliability first:** playback never stutters or stops because of UI work, navigation, or JS being suspended.
2. **Library at scale:** 50k songs feel as fast as 500.
3. **Honest capabilities:** unsupported formats and features are labeled, never faked.
4. **Native feel:** Liquid Glass and SF Symbols on iOS; Material 3 tonal surfaces and predictive back on Android.
5. **Private by design:** everything stays on the device.

---

## 2. Feature List — MVP vs Advanced

Legend: **MVP** = v1.0 store release · **v1.x** = fast follow · **Later** = post-1.x · ⚠ = platform-dependent/experimental

| Area | MVP | v1.x | Later |
|---|---|---|---|
| Library | Android MediaStore scan; iOS folder bookmarks + app Documents folder; incremental rescan; songs/albums/artists/genres/folders | Excluded folders, min-duration filter, duplicate detection ("hide duplicates") | iOS Apple Music library (non-DRM only ⚠); Android SAF extra roots |
| Metadata | Title, artist, album, album artist, genre, year, track/disc, duration, embedded art, codec/bitrate/sample rate | Sort tags (TSOT/TSOP), multi-artist splitting, ReplayGain tags, lyrics tags | Tag editor (Android: per-file consent ⚠) |
| Playback | Play/pause/seek/next/prev, shuffle, repeat (off/all/one), gapless (format-dependent), resume position, background, lock screen, notification, Bluetooth/headset buttons, audio focus/interruptions | Playback speed + pitch, sleep timer, fade on pause/resume | Crossfade ⚠, AirPlay picker (iOS), Android Auto, CarPlay (entitlement ⚠) |
| Queue | View, play next, add to queue, remove, drag reorder, clear, save as playlist, persisted across restarts | Queue history ("previously played") | Multiple saved queues |
| Collections | Playlists (CRUD, reorder, add/remove), favorites (songs/albums/artists), recently played, recently added, most played | M3U/M3U8 import/export, custom playlist artwork | Smart playlists (rules) |
| Home | Continue listening, recently played, recently added, favorites, most played, albums, playlists | User reorder/hide sections | Mixes ("forgotten favorites") |
| Search | Global FTS5 prefix search across songs/artists/albums/genres/playlists, recent searches | Substring (trigram) and diacritics-insensitive ranking by play count | Typo tolerance (spellfix) |
| Audio FX | — | 10-band EQ + presets + preamp, bass boost, ReplayGain (track/album) | Loudness analysis (EBU R128), virtualizer ⚠ |
| Lyrics | Embedded plain lyrics | Embedded + sidecar `.lrc` synced lyrics, auto-scroll | Online provider (opt-in) |
| UI | Dark/light/system, OLED black, artwork-tinted Now Playing, mini player, haptics, Liquid Glass on iOS 26+ | Material You dynamic color (Android 12+), layout options (grid/list, grid columns) | Widgets, Live Activity (iOS) |
| Other | Onboarding + permissions, settings, about/licenses | Backup/restore (local JSON file) | Wear OS / watchOS |

**Why this cut:** the MVP is the complete "player + library + queue" loop plus basic collections. Anything needing a DSP pipeline (EQ, ReplayGain, crossfade) waits until the engine is proven stable. The engine is *designed* for those features from day one, so adding them doesn't mean a rewrite.

---

## 3. Audio Format Support (honest matrix)

| Format | iOS native (AVFoundation/Core Audio) | Android native (Media3 + platform codecs, API 29+) | JS libraries (RNTP/expo-audio) | Isai plan |
|---|---|---|---|---|
| MP3 | ✅ | ✅ | ✅ both | **Guaranteed** |
| AAC / M4A (LC, HE) | ✅ | ✅ | ✅ both | **Guaranteed** |
| ALAC (.m4a) | ✅ | ⚠ Depends on the device's decoder; no guaranteed platform ALAC decoder | iOS only | iOS **guaranteed**. Android **platform-dependent**; guaranteed only if we later bundle the Media3 FFmpeg decoder extension (v1.x/Later, LGPL) |
| WAV (PCM) | ✅ | ✅ (PCM; some ADPCM variants vary) | ✅ | **Guaranteed** for PCM |
| AIFF | ✅ | ⚠ Depends on the Media3 version and extractor; test in the spike | iOS only | iOS **guaranteed**; Android **verify in Phase 3 spike**, else FFmpeg extension |
| FLAC | ✅ (iOS 11+) | ✅ (Media3 extractor + platform decoder) | ✅ Android / ⚠ iOS via AVPlayer | **Guaranteed** (iOS via SFBAudioEngine libFLAC for robustness) |
| Ogg Vorbis | ❌ | ✅ | Android only | **Guaranteed** (iOS via SFBAudioEngine libvorbis) |
| Opus (.opus/Ogg) | ❌ in Ogg (Core Audio decodes Opus only in CAF) | ✅ | Android only | **Guaranteed** (iOS via SFBAudioEngine libopus) |
| WMA | ❌ | ❌ (rare OEM exceptions) | ❌ | **Unsupported.** Shown in the library with an "Unsupported format" badge. Possible later via FFmpeg (licensing/patent review first) |
| WavPack / APE / DSD | ✅ via SFBAudioEngine | ❌ without FFmpeg | ❌ | Bonus on iOS; **not advertised** until Android has parity |

Rules:
- The scanner records `codec` and `is_playable` per platform capability table (a TS constant plus a native `canDecode()` probe at scan time).
- Unsupported files appear greyed with a reason; they are never silently hidden.
- High-res files (24-bit/96 kHz+) **play**, but the OS mixer resamples them to the output rate. "Bit-perfect" USB DAC output is **not** promised (Android 14+ `setPreferredMixerAttributes` is Later ⚠; iOS has no app-level equivalent).

---

## 4. Recommended Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Expo SDK 57 / RN 0.86, New Architecture**, CNG, local dev builds (`npx expo run:ios/android`) | Already scaffolded. Config plugins replace hand-edited native projects. The Expo Modules API makes Swift/Kotlin modules low-boilerplate. EAS is optional (no cloud dependency) |
| Language | TypeScript strict everywhere in JS; **Kotlin** (Android) and **Swift** (iOS) for native | Required; modern native languages for the Media3 and AVAudioEngine APIs |
| Navigation | **Expo Router** (file-based, on React Navigation) + `NativeTabs` | Mandated by AGENTS.md. Free deep links. Native tabs give the iOS 26 glass tab bar, search tab and bottom accessory |
| Audio engine | **Custom Expo module `isai-audio`**: Android **Media3 ExoPlayer + MediaLibraryService**; iOS **SFBAudioEngine (AVAudioEngine)** + AVAudioSession + MediaPlayer framework | See §5. Only option that gives format parity, a DSP graph (EQ/ReplayGain), gapless and a license-clean path |
| Library/scanner | **Custom Expo module `isai-library`**: MediaStore (Android), security-scoped bookmarks + FileManager (iOS), tag reading, artwork thumbnails, palette extraction | Native I/O is roughly 10–50× faster than JS parsing, and runs off the JS thread |
| Database | **expo-sqlite** + **Drizzle ORM** (+ drizzle-kit migrations), FTS5 | One storage engine; FTS5 built in; sync reads for boot settings; typed queries; generated migrations |
| Data fetching | **TanStack Query** over repository functions | Caching, pagination (`useInfiniteQuery`), and tag-based invalidation after scans and mutations, without building our own cache layer |
| Client state | **Zustand** | Tiny. Selector-based subscriptions avoid needless renders. Good for the player mirror and UI prefs |
| Lists | **@shopify/flash-list v2** | Recycling and New-Arch-only design, with no size estimates needed. Best choice for 50k rows |
| Animation | **react-native-reanimated 4** (+ react-native-worklets) | UI-thread animations, shared values for player progress and sheet morphing |
| Gestures | **react-native-gesture-handler** | Swipe-to-skip, mini-player drag, scrubbing |
| Sheets | **Native form sheets** via Expo Router (`presentation: 'formSheet'`, detents); Now Playing as a custom Reanimated overlay | Native sheets get Liquid Glass automatically on iOS 26 and are cheaper. The custom overlay is needed for the mini→full morph |
| Reorder | **react-native-reorderable-list** (Reanimated-based, virtualized) | Queue and playlist drag-and-drop. *Verify RN 0.86 / Reanimated 4 compatibility in Phase 1; fallback: in-house FlashList + Gesture Handler drag* |
| Images | **expo-image** | Memory + disk cache, downsampling, recycling-friendly `recyclingKey`, placeholder blurhash/color |
| Glass | **expo-glass-effect** (iOS 26+), **expo-blur** (iOS 17–25 fallback) | Official, maintained by Expo |
| Icons | `Icon` wrapper: **expo-symbols** (SF Symbols) on iOS; Material Symbols on Android (verify expo-symbols Android support in SDK 57, else `@expo/vector-icons` MaterialCommunityIcons) | Platform-native iconography through one API |
| Menus | **@expo/ui** native context menu (or **zeego** if @expo/ui's menu is still beta in 57) | Real UIMenu / Android popup menus; decided by a Phase 1 spike |
| Haptics | **expo-haptics** | Simple, maintained |
| Misc | expo-localization (RTL/locale), expo-sharing (export M3U/backup), expo-system-ui, expo-splash-screen | Official modules |
| Testing | jest-expo + @testing-library/react-native; better-sqlite3 for repository tests; JUnit/Robolectric; XCTest; **Maestro** E2E | See §20 |
| Not used | Firebase, analytics SDKs, Redux, Realm (deprecated), WatermelonDB (sync features unused), MMKV (redundant) | Offline-first; avoid overlapping tools |

---

## 5. Dependency Evaluation (key decisions)

### 5.1 Audio engine — the most important decision
| Option | iOS | Android | Formats | EQ/DSP | License/maintenance | MVP? |
|---|---|---|---|---|---|---|
| **Custom `isai-audio` (Media3 + SFBAudioEngine)** | ✅ | ✅ | Full matrix (§3) | Android: Media3 `AudioProcessor`; iOS: `AVAudioUnitEQ` in graph | Media3 (Google, Apache-2.0), SFBAudioEngine (MIT, active). We own the glue (~3–5k lines native) | **Yes** |
| RNTP v5 (`@rntp/player`) | ✅ | ✅ Media3 | iOS limited to AVPlayer formats (no Ogg/Opus) | None exposed | **Commercial license** for store apps | No |
| RNTP v4 | ✅ | ✅ ExoPlayer | Same limits | None | Frozen, no updates | No |
| expo-audio | ✅ | ✅ | Platform decoders | None | Expo-maintained | No (fine for sound effects, not a music engine) |
| react-native-audio-api (Web Audio) | ✅ | ✅ | Its own decoders | Full graph | Active (Software Mansion) | No as the primary player (no media-session or background integration design). Revisit only for visualizers |

**Why custom:** constraint #25 (don't rewrite the engine later) and constraint #5 (honest formats) both point here. The hardest part, the media session, background, focus and Bluetooth plumbing, is already solved by Media3 on Android and by SFBAudioEngine plus MPRemoteCommandCenter on iOS. Our code is mostly a queue manager and a bridge.

### 5.2 Tag reading
- **iOS:** SFBAudioEngine's `AudioFile`/`AudioMetadata` (covers ID3v2, Vorbis comments, MP4 atoms, APE, and includes lyrics, ReplayGain and artwork). No extra dependency.
- **Android:** MediaStore columns for the fast pass (title, artist, album, album_artist (API 30), genre (API 30), year, track, disc (API 30), duration). A deep pass (ReplayGain, lyrics, sort tags, accurate multi-artist) uses Media3 `MetadataRetriever` for ID3/Vorbis/MP4 frames. If coverage gaps appear (e.g. APE tags, USLT variants), add **TagLib via JNI** (LGPL-2.1/MPL-1.1 dual license; shipping under MPL is store-friendly). Decided in the v1.x spike; not needed for MVP.

### 5.3 Database: expo-sqlite vs op-sqlite vs WatermelonDB
expo-sqlite wins on maintenance (Expo), built-in FTS5, Drizzle support, change listeners, a sync API and zero extra native setup. op-sqlite is faster at the extreme, but our hot paths are indexed paginated reads (sub-ms either way) and batched scan inserts (seconds, one-off). **Switch trigger:** bulk scan insert of 50k rows takes more than 15 s on a mid-range Android device.

### 5.4 Remaining libraries
Each is used in the MVP unless noted, and each gets a compatibility check against RN 0.86 in the Phase 1 "dependency smoke test" build:
- FlashList v2 · Reanimated 4 · Gesture Handler · expo-image · expo-haptics · expo-glass-effect · expo-blur · Zustand · TanStack Query · Drizzle
- reorderable-list and @expo/ui/zeego are the two with fallback plans.

---

## 6. What runs where

| Concern | Where | Why |
|---|---|---|
| Decoding, output, gapless, DSP, audio session/focus, interruptions, route changes | **Native** (Kotlin/Swift) | Timing-critical; must run without JS |
| **Queue (canonical)**, shuffle order, repeat, track advance, position persistence | **Native** | The Android service can outlive the JS runtime. Bluetooth "play" after reboot (media resumption) has no JS at all |
| Lock screen / Control Center / notification / headset / Bluetooth commands | **Native** (Media3 `MediaSession`; `MPRemoteCommandCenter` + `MPNowPlayingInfoCenter`) | OS integration APIs are native-only |
| Media scanning, tag parsing, artwork thumbnails, palette extraction, file bookmarks | **Native** (`isai-library`) on background threads | I/O and CPU heavy |
| Writing library rows, search index, playlists, favorites, stats | **TypeScript** (single DB writer) | One writer means no locking issues. Business logic stays in one testable language |
| Play-count and history events | Native emits → TS writes; native **buffers to a file when JS isn't alive**, and TS drains the buffer on start | History stays correct in headless Android playback |
| UI, navigation, theming, animations | **React Native** (Reanimated on the UI thread) | Shared across platforms |
| Platform visuals | iOS: glass, SF Symbols, native tab bar/menus/sheets. Android: Material 3 tonal surfaces, dynamic color, predictive back | Platform-native feel |

---

## 7. Folder Structure

```
ios-isai/
├─ app.json → app.config.ts          # typed config, plugins, permissions
├─ AGENTS.md / CLAUDE.md
├─ modules/                          # local Expo modules (autolinked)
│  ├─ isai-audio/
│  │  ├─ src/                        # TS API: IsaiAudio.ts, types.ts, events.ts
│  │  ├─ android/src/main/java/app/isai/audio/
│  │  │  ├─ IsaiAudioModule.kt       # Expo module: commands/events bridge
│  │  │  ├─ PlaybackService.kt       # MediaLibraryService + MediaSession
│  │  │  ├─ PlaybackEngine.kt        # owns ExoPlayer, window feeding, state
│  │  │  ├─ QueueManager.kt          # canonical queue, shuffle, repeat
│  │  │  ├─ QueueStore.kt            # persisted queue snapshot (file)
│  │  │  ├─ dsp/EqualizerProcessor.kt, ReplayGainProcessor.kt   (Phase 6)
│  │  │  └─ PendingEventsStore.kt
│  │  ├─ ios/
│  │  │  ├─ IsaiAudioModule.swift
│  │  │  ├─ PlaybackEngine.swift     # SFBAudioEngine AudioPlayer, graph
│  │  │  ├─ QueueManager.swift       # same semantics as Kotlin (shared test vectors)
│  │  │  ├─ AudioSessionController.swift   # category, interruptions, routes
│  │  │  ├─ NowPlayingController.swift     # MPRemoteCommandCenter / NowPlayingInfo
│  │  │  └─ QueueStore.swift, PendingEventsStore.swift
│  │  └─ plugin/                     # config plugin: UIBackgroundModes, FGS perms
│  └─ isai-library/
│     ├─ src/                        # scan(), readTags(), artwork(), bookmarks
│     ├─ android/…  MediaStoreScanner.kt, TagReader.kt, ArtworkCache.kt, Palette.kt
│     └─ ios/…      FolderAccess.swift (bookmarks), FolderScanner.swift, TagReader.swift, ArtworkCache.swift
├─ src/
│  ├─ app/                           # ROUTES ONLY (Expo Router)
│  │  ├─ _layout.tsx                 # providers, root Stack, PlayerOverlay host
│  │  ├─ onboarding.tsx
│  │  ├─ (tabs)/_layout.tsx          # <AppTabs> (NativeTabs wrapper)
│  │  ├─ (tabs)/(home,library,playlists,search)/   # shared detail routes per stack
│  │  │  ├─ _layout.tsx              # Stack
│  │  │  ├─ album/[id].tsx  artist/[id].tsx  genre/[id].tsx
│  │  │  ├─ folder/[...path].tsx  playlist/[id].tsx
│  │  ├─ (tabs)/(home)/index.tsx
│  │  ├─ (tabs)/(library)/index.tsx  # segmented: Songs/Albums/Artists/Genres/Folders
│  │  ├─ (tabs)/(playlists)/index.tsx
│  │  ├─ (tabs)/(search)/index.tsx
│  │  ├─ player.tsx                  # deep-link shim → opens overlay
│  │  ├─ queue.tsx                   # formSheet
│  │  ├─ sheets/song-actions.tsx, add-to-playlist.tsx, sort.tsx   # formSheets
│  │  └─ settings/…                  # index, playback, appearance, library, audio, interface, about
│  ├─ features/
│  │  ├─ player/     components (MiniPlayer, NowPlaying, Scrubber, Controls), hooks, playerStore.ts, playerBridge.ts
│  │  ├─ queue/      QueueList, useQueue
│  │  ├─ library/    scanner orchestrator (scanService.ts), SongRow, AlbumTile, repos usage
│  │  ├─ home/       sections registry, section components
│  │  ├─ search/     searchService.ts, useSearch
│  │  ├─ playlists/  playlistService.ts, M3U import/export
│  │  ├─ favorites/  history/  lyrics/ (LyricsProvider interface + providers)
│  │  └─ settings/   settingsStore.ts, schema.ts
│  ├─ db/
│  │  ├─ client.ts (open, PRAGMAs), schema.ts (Drizzle), migrations/ (generated)
│  │  ├─ repos/ songs.ts albums.ts artists.ts genres.ts folders.ts playlists.ts stats.ts search.ts
│  │  └─ queryKeys.ts                # TanStack keys + invalidation tags
│  ├─ design/
│  │  ├─ tokens.ts (color palettes, spacing, radii, type, motion, sizes)
│  │  ├─ theme.tsx (ThemeProvider, useTheme, makeStyles)
│  │  └─ components/ Text, Icon, Surface (glass/tonal), Button, IconButton, ListRow, Artwork, SectionHeader, EmptyState, Skeleton, FastScroller
│  ├─ lib/           format.ts (durations), normalize.ts (sort keys), haptics.ts, platform.ts, i18n.ts
│  └─ types/
├─ e2e/ (Maestro flows)   test-fixtures/ (audio generator script)
```
**Why:** routes stay thin (AGENTS.md). Features own their UI and logic. Native code sits in two cohesive modules instead of many. `db/repos` is the only place SQL lives. That's a simple, flat, feature-based structure one developer can hold in their head.

---

## 8. Database Schema (SQLite via Drizzle)

PRAGMAs at open: `journal_mode=WAL`, `synchronous=NORMAL`, `foreign_keys=ON`, `temp_store=MEMORY`, `cache_size=-16000`.

**Library tables** (rebuilt from disk; upserted rather than dropped, so ids stay stable)
```sql
folders(id PK, parent_id → folders, path TEXT UNIQUE, name, song_count)
artists(id PK, name, name_sort, name_norm UNIQUE, artwork_key, song_count, album_count)
albums(id PK, title, title_sort, title_norm, album_artist_id → artists NULL,
       year, artwork_key, color_primary, color_secondary, color_on,   -- palette precomputed natively
       song_count, total_duration_ms, is_compilation,
       UNIQUE(title_norm, album_artist_id, group_hint))              -- group_hint = folder for "Various/unknown" cases
genres(id PK, name, name_norm UNIQUE, song_count)
songs(id PK,
  source TEXT CHECK(source IN ('mediastore','bookmark','documents','ipod')),
  source_id TEXT,              -- MediaStore _ID or root-relative path
  root_id → library_roots NULL, uri TEXT, folder_id → folders,
  file_name, file_size, mime, codec, bitrate, sample_rate, bit_depth, channels,
  date_added, date_modified, content_sig TEXT,  -- size+duration+head/tail hash for rename/dup detection
  title, title_sort, artist_display, album_id → albums, album_artist_display,
  year, track_no, disc_no, duration_ms,
  has_art INT, artwork_key, has_lyrics INT,
  rg_track_gain, rg_track_peak, rg_album_gain, rg_album_peak,
  is_playable INT, unplayable_reason, is_available INT DEFAULT 1, missing_since,
  tags_scanned_at, scan_generation, last_error,
  UNIQUE(source, source_id))
song_artists(song_id, artist_id, role CHECK(role IN('artist','album_artist','composer')), position, PK(song_id,artist_id,role))
song_genres(song_id, genre_id, PK(song_id, genre_id))
library_roots(id PK, platform, display_name, bookmark BLOB, uri, added_at, is_enabled)   -- iOS bookmarks / Android SAF trees
excluded_paths(id PK, path_prefix UNIQUE)
scan_state(key PK, value)      -- mediastore_version, last_generation, last_full_scan_at
```

**User data tables** (must survive rescans and migrations; never dropped)
```sql
playlists(id PK, name, created_at, updated_at, artwork_uri, kind DEFAULT 'manual', rules_json NULL)
playlist_songs(id PK, playlist_id → playlists ON DELETE CASCADE, song_id → songs,
               position REAL,          -- fractional index: O(1) reorder
               song_fingerprint TEXT)  -- title|artist|album|duration bucket, for re-linking
favorites(entity_type CHECK(IN('song','album','artist','playlist')), entity_id, created_at, PK(entity_type, entity_id))
play_events(id PK, song_id, started_at, ms_played, completed INT, context TEXT)   -- 'album:12', 'playlist:3'
song_stats(song_id PK, play_count, skip_count, last_played_at, first_played_at)  -- denormalized, updated per event
recent_searches(query PK, used_at)
settings(key PK, value_json)
lyrics_cache(song_id PK, source, is_synced, content, updated_at)
```

**Search index**
```sql
CREATE VIRTUAL TABLE search_fts USING fts5(
  entity_type UNINDEXED, entity_id UNINDEXED, primary_text, secondary_text,
  tokenize='unicode61 remove_diacritics 2', prefix='2 3');
-- v1.x: search_trigram USING fts5(..., tokenize='trigram') for mid-word substring matches
```
Rebuilt for touched entities after each scan batch, and updated by playlist mutations. Queries run `MATCH 'lov* ton*'`, ranked by `bm25()` with a boost from `song_stats.play_count` and a fixed entity-type order.

**Indexes:** `songs(album_id, disc_no, track_no)`, `songs(title_sort)`, `songs(date_added DESC)`, `songs(folder_id)`, `songs(is_available)`, partial `songs(content_sig)`, `song_artists(artist_id, role)`, `song_genres(genre_id)`, `albums(title_sort)`, `albums(album_artist_id)`, `artists(name_sort)`, `playlist_songs(playlist_id, position)`, `play_events(started_at DESC)`, `song_stats(play_count DESC)`, `song_stats(last_played_at DESC)`.

**Queue state** is intentionally **not** in SQLite. The native engine persists it (`QueueStore`, a compact binary/JSON file of song ids + URIs + shuffle order + index + position). It must be restorable with no JS runtime (Android media resumption).

**Relationship integrity**
- **Song identity is stable:** rescans upsert on `(source, source_id)`. If a file disappears and a new row appears with the same `content_sig`, it's treated as a rename or move: the old row is updated in place, which preserves favorites, stats and playlists.
- **Missing files** are soft-deleted (`is_available=0`, `missing_since`) and purged after 30 days. Playlist entries keep a `song_fingerprint`, so they re-link after reinstall or MediaStore id changes (e.g. SD card remount).

**Migrations:** drizzle-kit generates SQL migrations. They're bundled and applied at startup inside a transaction, with version tracking (Drizzle's `useMigrations`).
- If a library-table migration fails, the fallback is to drop and trigger a full rescan (safe, since the data is derived).
- User-data migrations get handwritten tests against snapshot DBs from each released version.
- A pre-migration DB backup copy is kept for one launch.

**Library scanning strategy**: see §11.

---

## 9. Audio Engine Architecture

```
 TS (features/player)                       Native (isai-audio)
 ┌──────────────────────┐  commands   ┌──────────────────────────────────────────┐
 │ playerBridge.ts      │ ──────────► │ IsaiAudioModule (Expo Module)            │
 │  play(queueSpec)     │             │        │                                 │
 │  pause/seek/next…    │ ◄────────── │ PlaybackEngine ── QueueManager ── Store  │
 │ playerStore (Zustand)│   events    │   │  backend: ExoPlayer | SFB AudioPlayer│
 │ progress SharedValue │             │   │  DSP chain: EQ → ReplayGain → preamp │
 └──────────────────────┘             │ MediaSession / NowPlaying / AudioSession │
                                      └──────────────────────────────────────────┘
```

**TS API (identical on both platforms)**
```ts
setQueue(items: QueueItem[] /* {songId, uri, title, artist, album, artworkUri, durationMs} */,
         opts: { startIndex, startPositionMs?, shuffle?, context? }): Promise<void>
play() / pause() / togglePlayPause() / stop()
seekTo(ms) / skipToNext() / skipToPrevious() / skipToIndex(i)
playNext(items) / addToQueue(items) / removeAt(indices) / move(from, to) / clearUpcoming()
setShuffle(on) / setRepeat('off'|'all'|'one') / setRate(rate, pitch?)
getState(): PlayerSnapshot    // sync JSI getter: track, index, status, position, duration, shuffle, repeat, queueVersion
getQueueWindow(offset, limit): QueueItem[]   // paginated; queue can hold 50k items
configure(cfg: { gapless, replayGainMode, preampDb, eq: {...}, fadeMs, resumeOnHeadset, … })
drainPendingEvents(): PlayEvent[]
events: 'state' | 'trackChanged' | 'progress'(1 Hz + on seek) | 'queueChanged'(version only)
        | 'playEvent' | 'error'(songId, code, recoverable) | 'remoteAction'
```

**Key design choices and why**
1. **Native-owned canonical queue.** `QueueManager` keeps the ordered song list, the shuffle permutation (keeping the original order, so turning shuffle off returns to it), the index and the repeat mode. Kotlin and Swift implement identical semantics and are checked against a **shared JSON test-vector file** (e.g. "shuffle on, play next ×2, move 5→1, shuffle off → expected order").
2. **Windowed feeding to the backend.** The player backend only ever sees *current + next (+ previous)*: ExoPlayer gets a 3-item playlist; SFBAudioEngine gets `enqueue(next)` for gapless. A 50k-item "play all shuffled" costs a list of ints, not 50k MediaItems. *Trade-off:* the Android system queue UI (Android Auto) sees a window. Later, Android Auto browsing goes through `MediaLibraryService` browse callbacks instead.
3. **Progress without chatter.** Native emits `{positionMs, timestamp, rate, isPlaying}` at 1 Hz and on discontinuities. A Reanimated worklet interpolates to 60/120 fps on the UI thread, so there are no React renders for progress.
4. **Errors are local.** A corrupt or unsupported file emits `error(recoverable)`, auto-skips to the next item (with a cap of 5 consecutive failures, then pause) and marks `songs.last_error`.
5. **DSP chain as an extension point.** Android uses Media3 `AudioProcessor`s (custom biquad EQ, a gain stage for ReplayGain/preamp, a soft limiter). iOS uses `AVAudioUnitEQ` plus a gain node inserted into the SFBAudioEngine graph. EQ is added in Phase 6 without touching queue or session code.
6. **Crossfade (later ⚠)** needs two concurrent decoders: two ExoPlayer instances on Android, and a second player node or a second AudioPlayer mixed into the engine on iOS. That's why the `PlaybackEngine` backend interface is "track slot" based from the start, even though v1 uses one slot.

---

## 10. Android Implementation Strategy
- **minSdk 29 (Android 10)**, target the latest SDK. *Why:* scoped storage semantics are stable from 29, `RELATIVE_PATH` and `ContentResolver.loadThumbnail` exist, and API 29+ covers the vast majority of active devices in 2026. That removes a testing tier.
- **Service:** `PlaybackService : MediaLibraryService` holds the `MediaLibrarySession` and a `PlaybackEngine` singleton. The Expo module connects through a `MediaController` (which starts and binds the service) and then talks to the in-process engine directly for Isai-specific operations.
- **Manifest (via config plugin):**
  - `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, service `foregroundServiceType="mediaPlayback"`, `WAKE_LOCK`
  - `READ_MEDIA_AUDIO` (33+), `READ_EXTERNAL_STORAGE maxSdkVersion=32`, `POST_NOTIFICATIONS` (requested softly; media-session notifications are exempt, but sleep-timer and scan notices use it)
- **Media3 handles:** the notification (MediaStyle with artwork), lock screen, Bluetooth/headset buttons, audio focus (`setAudioAttributes(…, handleAudioFocus=true)`), and becoming-noisy pause (`setHandleAudioBecomingNoisy(true)`).
- **Media resumption (Android 11+):** implement `onPlaybackResumption` from `QueueStore`, so the Bluetooth play button or the system "resume" card works after a reboot without opening the app.
- **Dynamic color:** read the Material You palette natively (Android 12+) and expose it through `isai-library`'s `getSystemColors()`.
- **Predictive back:** enable `predictiveBackGestureEnabled` once the Now Playing overlay handles back.
- **OEM battery killers (Xiaomi, Samsung, etc.):** a correct FGS type is the main defense. Settings adds a help row linking to the battery-optimization exemption page (no automatic prompting).

## 11. Library Scanning & File Access

### Android (MediaStore)
1. **Permission:** request `READ_MEDIA_AUDIO` (or `READ_EXTERNAL_STORAGE` on ≤12) after an onboarding explainer. If denied, show an empty state with a "Grant access" button that deep-links to app settings after two denials.
2. **Fast pass:** query `MediaStore.Audio.Media` with `IS_MUSIC=1` (setting: "include non-music audio"), `DURATION >= minDuration`, and path excludes (via `RELATIVE_PATH`).
   - Stream cursor batches of 500 rows to TS through module events. TS upserts inside transactions and updates progress UI.
   - Mark-and-sweep via `scan_generation` detects deletions.
3. **Incremental:** store `MediaStore.getVersion()` and the max `GENERATION_MODIFIED` (API 30+; `DATE_MODIFIED` on 29). On app foreground plus a debounced `ContentObserver` (while the app is alive), query only changed rows. A version mismatch triggers a full pass.
4. **Deep pass (background, resumable):** for songs whose `tags_scanned_at` is older than `date_modified`, read extra tags (album artist fallback, ReplayGain, lyrics flag, sort tags) and embedded-art presence. Runs at low priority on a native thread pool, paused while scrolling or playing heavy UI.
5. **Artwork:** generate lazily. `loadThumbnail` or the embedded picture is decoded, downsampled to 3 sizes (96, 300, 800 px, WebP) into `cacheDir/art/<artwork_key>`, and a palette is extracted at the same time (AndroidX Palette) and written back to `albums.color_*`. Albums share one `artwork_key` to deduplicate.
6. **Folders:** derived from `RELATIVE_PATH` (plus the volume name) into the `folders` tree.
7. **Delete:** `MediaStore.createDeleteRequest` shows one system consent dialog for a batch. Tag writing later uses `createWriteRequest`.
8. **Limits:** on 13+ the app **cannot read non-media files** (`.lrc`, `.m3u` on disk) with `READ_MEDIA_AUDIO`. Sidecar lyrics and on-disk playlist import require the user to grant a folder through SAF (`ACTION_OPEN_DOCUMENT_TREE`), stored in `library_roots`. SAF is also the path for folders that are `.nomedia`-hidden from MediaStore.

### iOS (sandbox reality)
There's **no filesystem-wide scan** on iOS. Isai supports three sources:
1. **"Add Folder" (primary):** `UIDocumentPickerViewController(forOpeningContentTypes: [.folder])`. Store a **security-scoped bookmark** in `library_roots`. On each scan, resolve the bookmark (and refresh it if stale), call `startAccessingSecurityScopedResource`, enumerate with `FileManager.enumerator` (skip hidden and packages), filter by UTType/extension, then stop access.
   - Works for On My iPhone, iCloud Drive, external USB drives and third-party providers.
   - **iCloud placeholders:** files not yet downloaded are listed as "Not downloaded". Tapping triggers `startDownloadingUbiquitousItem`, and reads are coordinated with `NSFileCoordinator`.
2. **Isai's own Documents folder:** `UIFileSharingEnabled` + `LSSupportsOpeningDocumentsInPlace` let users drop music in through the Files app or Finder/USB. It's always scanned. "Open in Isai" / share-sheet imports copy files here (this is a user-initiated copy into the app's file container, not into the DB).
3. **Apple Music library (Later ⚠):** `MPMediaQuery` items with a non-nil `assetURL` (non-DRM, downloaded) can be played. DRM, cloud-only and Apple Music subscription tracks **cannot**. The feature is clearly labeled.

- **Incremental:** compare `(path, size, mtime)` against the DB on app foreground. Only changed files get tag reads. There's no background file watching (iOS doesn't allow it), so there's a manual "Rescan" and pull-to-refresh.
- **Bookmark failure** (folder deleted, drive unplugged): the root shows "Unavailable – Reconnect". Its songs are marked unavailable, not deleted.
- **Delete** is only allowed inside granted roots or Documents, with confirmation.

### Shared scan pipeline (TS `scanService.ts`)
`native batch → normalize (sort keys: case-fold, diacritics fold, optional leading "The/A" strip, sort tags win) → resolve/insert artists/albums/genres (in-memory maps per scan, not per row queries) → upsert songs → update search_fts for touched ids → recompute counts → invalidate query tags`.
- It's interruptible (resumes from the last committed batch) and never runs two scans at once.

---

## 12. Background Playback Strategy

| Concern | Android | iOS |
|---|---|---|
| Keep alive | `MediaLibraryService` as a foreground service while playing (Media3 manages start/stop) | `UIBackgroundModes: audio` + `AVAudioSession(.playback, mode .default, policy .longFormAudio)` |
| System controls | MediaSession → notification, lock screen, quick settings media, Bluetooth AVRCP | `MPRemoteCommandCenter` (play, pause, toggle, next, prev, `changePlaybackPosition`, like) + `MPNowPlayingInfoCenter` (title, artist, album, artwork, elapsed, rate, duration) |
| Headphones unplugged | Becoming-noisy pause | `routeChangeNotification` with `.oldDeviceUnavailable` → pause |
| Calls / other apps | Audio focus: pause on loss, duck on transient-can-duck, resume after transient loss if we were playing | `interruptionNotification`: pause on begin; on end, resume if `.shouldResume` |
| Bluetooth reconnect auto-play | Setting "Resume on connect" (off by default) | Not controllable by apps; system decides |
| JS not running | Engine and queue fully native; events buffered | Same design (JS usually alive under the audio background mode, but not relied on) |

## 13. Navigation Architecture
- **Tabs (4):** **Home · Library · Playlists · Search** (Search uses `role:'search'`, so on iOS 26 it becomes the separated trailing search button). **Settings** is reached from a gear in the Home header.
  - *Why 4 and not 5:* Settings is visited rarely. Apple's HIG and Material both favor 3–5 destinations, and fewer tabs keep the iOS 26 glass bar compact.
- **Per-tab stacks** share detail routes through Expo Router's group-array syntax `(home,library,playlists,search)`. So Album → Artist → Album chains stay within the current tab, like native music apps.
- **Library tab:** a segmented top control (Songs / Albums / Artists / Genres / Folders) with lazily mounted pages. The segment order is configurable later.
- **Now Playing:** a **root-level overlay** (not a route), owned by `PlayerOverlay` in `src/app/_layout.tsx`, driven by one Reanimated shared value `expand` (0 = mini, 1 = full). *Why:* a native modal can't morph from the mini player; an overlay can, and it keeps the player mounted (so artwork and state are instant). `src/app/player.tsx` is a deep-link shim (`isai://player`) that sets `expand=1` and pops itself. Back and predictive back collapse the overlay.
- **Mini player placement:**
  - **iOS 26+:** `NativeTabs.BottomAccessory`, which gets the native glass accessory with inline minimization on scroll. Tapping expands the overlay.
  - **iOS <26 / Android:** a custom `MiniPlayer` floating above the tab bar, positioned from safe-area insets plus the tab bar height (a measured, not hardcoded, constant exposed by `AppTabs`).
  - *Phase 1 spike* confirms accessory interaction and that overlay z-order sits above the native tab bar. If the overlay can't cover the native tab bar, Now Playing becomes a `fullScreenModal` route with a crossfade/slide transition (the fallback).
- **Sheets (native formSheet):** queue (detents 50%/100%), song actions, add to playlist, sort/filter, sleep timer.
- **Modals:** onboarding, playlist create/rename, EQ.
- **Deep links:** `isai://album/12`, `isai://artist/3`, `isai://playlist/7`, `isai://player`, `isai://search?q=`. They're free from Expo Router and used by notifications and future widgets.

## 14. State Management
| State | Owner | Access pattern |
|---|---|---|
| Playback truth (queue, index, status, position) | Native engine | `playerStore` (Zustand) mirrors a snapshot from events. Components subscribe with narrow selectors (`usePlayer(s => s.status)`) |
| Playback progress | Reanimated `SharedValue` fed by `progress` events | Only the scrubber and time labels read it (time text via `useDerivedValue` + `AnimatedText` style patterns, or a 1 Hz state) |
| Library data (DB) | SQLite | TanStack Query hooks per repo (`useAlbum(id)`, `useSongsPage(sort)`). Mutations invalidate tags (`['songs']`, `['playlist', id]`) |
| Settings | SQLite `settings` table | `settingsStore` (Zustand), hydrated **synchronously** at boot via `getFirstSync` so the theme is right on the first frame. Writes through to the DB and pushes `configure()` to native |
| Ephemeral UI (selection mode, search text) | Component state or a feature-local Zustand store | — |
**Why this split:** each kind of state has exactly one source of truth. React never holds 50k songs, and playback correctness never depends on React.

## 15. Large List Strategy (50k+)
- **Sparse paging:** `SELECT COUNT(*)` gives the list length. FlashList renders `count` rows; rows read from a page cache keyed by `floor(index/200)`. Missing pages are fetched on `onViewableItemsChanged` (keyset ordering by `(sort_key, id)`), with skeleton rows until loaded. Memory stays at a few pages.
- **Fast scroller** (A–Z rail, plus year/decade for date sorts): section offsets come from one `GROUP BY substr(sort_key,1,1)` query. The rail haptic-ticks per letter.
- **Row components** are `memo`, take primitive props, use fixed heights (`ListRow` token), and include `expo-image` with `recyclingKey`.
- **Search:** 150 ms debounce, `LIMIT 50` per entity type, and cancellation of stale queries.
- **Home sections:** each is an independent `LIMIT 20` query.
- **Budgets (mid-range Android, e.g. Snapdragon 6-series):** cold start to interactive under 1.5 s with 50k songs, scroll at 60 fps with no blank frames under normal fling, search results under 100 ms, initial 50k MediaStore scan under 60 s (deep pass continues in background).

---

## 16. UI/UX Design System

**Tokens (`src/design/tokens.ts`, the only place raw values live)**
- **Spacing (4-pt grid):** `0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64`. Screen gutter 16 (20 on ≥414 pt width).
- **Radius:** `xs 4, sm 8, md 12, lg 16, xl 24, full`. Artwork uses `md` in lists and `lg` in Now Playing (iOS uses continuous corners via `borderCurve: 'continuous'`).
- **Typography:** platform fonts (SF Pro / Roboto Flex), with scaled sizes that respect Dynamic Type / font scale up to 1.6× (clamped per component).
  - Roles: `display 34/41 bold`, `title1 28`, `title2 22`, `headline 17 semibold`, `body 17`, `callout 16`, `subhead 15`, `footnote 13`, `caption 12`, and `mono-digits` for times (tabular numerals).
- **Color:** semantic roles only: `bg`, `bgElevated`, `surface`, `surfaceGlassTint`, `textPrimary/Secondary/Tertiary`, `separator`, `accent`, `onAccent`, `danger`, `scrim`.
  - Palettes: Light, Dark (`#0E0E11` base, not pure black, to avoid OLED smearing on scroll), **OLED** (`#000` bg, `#0B0B0B` surfaces).
  - Brand accent: a warm saffron/amber (final hue picked during Phase 1 visual exploration). Android 12+ optionally uses the system dynamic accent. The Now Playing screen uses album palette colors, with a **contrast guard** that nudges text/bg until ≥4.5:1.
- **Elevation:** Android uses tonal elevation (M3 surface containers). iOS uses glass/blur for chrome, and hairline separators plus subtle shadows only on floating controls.
- **Sizes:** min touch target 44 pt (iOS) / 48 dp (Android); list row 64; artwork thumbs 48 (rows) and 160 (grid min width, columns computed from width); mini player 64; icon sizes 16/20/24/28; main play button 72.
- **Motion:** durations `fast 150`, `base 250`, `slow 350` ms; springs `snappy {damping 20, stiffness 300}` and `gentle {damping 26, stiffness 180}`. Every animation checks `useReducedMotion()`.

**Theme plumbing:** `ThemeProvider` → `useTheme()` → `makeStyles(theme => StyleSheet.create(...))` memoized per theme. Theme changes are rare, so re-rendering is acceptable, and it keeps us free of an extra styling dependency.

**Core components:** `Text` (role prop only, no raw font sizes), `Icon`, `Surface` (variants `plain | tonal | glass`), `IconButton` (enforces hit slop), `ListRow`, `Artwork` (placeholder = palette color + note glyph), `SectionHeader`, `EmptyState`, `Skeleton`, `FastScroller`, `SegmentedControl` (native on iOS via @expo/ui if available).

## 17. iOS Liquid Glass Strategy
- **Glass goes on the navigation/control layer only:** tab bar (native, automatic), mini player (native bottom accessory), formSheets (native, automatic), context menus (native), Now Playing floating control cluster and top bar buttons (`GlassView`, `isInteractive`), and the scroll-edge header over artwork on Album/Artist detail.
- **Never glass on content:** song lists, album grids, lyrics text, settings rows. Content stays opaque for legibility and performance.
- **Gating:** `isLiquidGlassAvailable() && isGlassEffectAPIAvailable()` → `GlassView`. On iOS 17–25 → `expo-blur` material (`systemChromeMaterial`). On Android → `Surface tonal`. All of this sits behind `<Surface variant="glass">`, so screens never branch on platform.
- **Accessibility:** on `isReduceTransparencyEnabled`, `Surface glass` renders solid `bgElevated` (native components adapt automatically). Increase Contrast adds borders.
- **Motion caveat:** don't animate `opacity` on `GlassView` (verified doc caveat). Use its `glassEffectStyle.animate`, or animate a parent's transform instead.

## 18. Screen-by-Screen UX Specification

- **Onboarding (3 steps):** welcome → source setup (Android: permission explainer then system prompt; iOS: "Add a folder" / "Use Isai folder", with a short Files-app hint) → first scan with a progress ring and live counts. You can skip into an empty-state app.

- **Home:** large-title header "Isai" with a settings gear.
  - Sections: Continue listening (last queue as a wide card with resume), Recently played (horizontal artwork carousel), Recently added, Favorites, Most played (compact 4-row list with play counts), Albums, Playlists.
  - Sections come from a registry `{id, title, query, component}`; order and visibility live in settings (reorder UI in v1.x). Empty sections hide themselves.
- **Library:** segmented control plus a sort/filter button (formSheet). Selection mode (long-press) shows a bottom action bar: Play, Add to queue, Add to playlist, Favorite, Delete.
  - *Songs:* virtualized list, fast scroller, sorts: title, artist, album, date added, recently played, most played, duration (asc/desc).
  - *Albums:* adaptive grid (columns = floor(width / 160)) or list. Tile shows artwork, title (1 line), artist · year (1 line).
  - *Artists:* list with circular avatar (first album art fallback), album/song counts.
  - *Genres:* list with 2×2 artwork mosaic.
  - *Folders:* breadcrumb header, folders first then songs, "Play folder" (recursive).
- **Album detail:** hero artwork (max 70% width, centered), title/artist (tap → artist)/year · N songs · total time, then Play and Shuffle buttons (equal width), and a "…" menu (add to playlist, play next, add to queue, favorite). Track list grouped by disc, with track numbers in tabular digits. A glass scroll-edge header appears after the hero scrolls away.
- **Artist detail:** header (artwork or palette gradient), Play/Shuffle, Top songs (by play count, 5), Albums (horizontal, by year), Appears on, All songs.
- **Playlists:** "New playlist" row, Favorites pinned, then user playlists (mosaic artwork).
  - Detail: rename, custom artwork, drag handles in Edit mode, swipe-to-remove, add songs (search picker sheet), export M3U (v1.x).
- **Search:** field auto-focused on tab open, recent searches when empty. Results are grouped: Top result, Songs, Artists, Albums, Playlists, Genres, each with "See all". Matched text is highlighted. Empty results suggest checking library sources.
- **Now Playing:**
  - Top bar: collapse chevron, context ("Playing from Album · Name"), "…".
  - Artwork: square, width = min(screenW − 2·gutter, availableH × 0.48), swipe left/right to skip (a pager of prev/current/next art), slight scale-down when paused.
  - Below: title (marquee only if it overflows, never for reduced motion) and artist · album (tappable), favorite heart. Scrubber with elapsed/remaining. Controls row: shuffle · prev · play/pause (72) · next · repeat.
  - Bottom row: lyrics, AirPlay/output (iOS route picker; Android output switcher intent), queue.
  - Background: blurred scaled artwork plus palette scrim on iOS; palette gradient on Android (cheaper than blur). Drag down anywhere to collapse.
  - Landscape (tablets/large phones): artwork left, controls right.
- **Mini player:** 64 pt, with artwork 44, title/artist (1 line each), play/pause, next, and a 2 px progress line. Swipe horizontally to skip, swipe up or tap to expand, long-press for the queue.
- **Queue (formSheet):** "Now playing" pinned row, then "Up next" (drag handles, swipe to remove) with a header menu: Shuffle, Clear upcoming, Save as playlist. Virtualized for huge queues; auto-scrolls to current.
- **Lyrics:** a Now Playing sub-page. Synced lyrics show the active line highlighted, auto-scroll, and tap-line-to-seek. Plain lyrics scroll freely. With no lyrics, it says "No lyrics found" plus the sidecar `.lrc` naming tip.
- **Settings:** grouped lists matching §22 of your brief (Playback, Appearance, Library, Audio, Interface, Privacy, About). Unsupported items are hidden per platform, and experimental ones carry a "Beta" tag.

## 19. Animation Strategy
Every animation must serve continuity, feedback or orientation. All of them run on the UI thread (Reanimated) and respect reduced motion (they fall back to crossfades).

| Interaction | Technique |
|---|---|
| Mini → full player | One `expand` shared value drives artwork frame interpolation (mini thumb rect → hero rect, measured via `measure()` on the UI thread), background opacity, control fade/translate, and gesture-driven collapse with velocity-aware spring |
| Album tile → detail | Crossfade + artwork scale (not true shared-element; Reanimated's shared transitions are not relied upon for native stacks) |
| Artwork on track change | Pager slide when triggered by swipe; 200 ms crossfade when triggered by button or remote |
| Play/pause | Icon morph (scale 0.9 → 1 spring) + `impactLight` haptic |
| Scrubbing | Thumb grows 1.0 → 1.4, time labels switch to "scrub time", `selection` haptic at 0 and end |
| Queue drag | Lifted row scale 1.03 + shadow; neighbors spring; haptic on pick-up and drop |
| Scan progress | Determinate ring + counters; skeleton rows while pages load |
| Tabs/sheets | Native (free, platform-correct) |
**Mid-range Android guard:** no blur on Android, no animated shadows, and animations only on transform/opacity. Profile with the Perf Monitor and systrace in Phase 5.

## 20. Testing Strategy
- **Unit (Jest):** sort-key normalization, fractional reorder, search query builder, M3U parse/serialize, contrast guard, section registry, scan diff logic.
- **Repository tests:** Drizzle schema against **better-sqlite3** in Node (same SQL, FTS5 included). Includes migration tests from snapshot DBs.
- **Native queue parity:** a shared `queue-vectors.json` run by JUnit (Kotlin `QueueManager`) and XCTest (Swift `QueueManager`).
- **Component tests:** RN Testing Library for rows, mini player states and empty states.
- **E2E (Maestro):** onboarding → scan fixture library → play album → background (home button) → lock-screen controls (manual checklist) → queue reorder → playlist create → search.
- **Fixture library:** `test-fixtures/generate.sh` (ffmpeg) produces every format in §3, plus these edge cases:
  - missing tags, 300-char titles, CJK/Arabic/emoji names, no art, huge art (6000 px)
  - multi-disc, compilation, duplicate files, zero-byte and truncated (corrupt) files, 10-hour file, .lrc sidecars
- **Scale data:** a script that seeds 50k synthetic songs for UI performance testing.
- **Manual device matrix:**
  - Android: a Pixel (latest), a Samsung mid-range, a Xiaomi (battery killer), an Android 10 device
  - iOS: iPhone SE-class (small), a Pro Max, iOS 17 and iOS 26
  - Scenarios: Bluetooth car/headset, wired headset, phone call, Siri/Assistant interruption, other app playing, airplane mode

## 21. Accessibility Strategy
- Every icon button gets `accessibilityLabel` and `accessibilityRole="button"`. The play button's label reflects state ("Pause").
- Rows read as "Song title, Artist, 3 minutes 12 seconds". Custom `accessibilityActions` (play next, add to queue, favorite) are available without long-press.
- The scrubber is an `adjustable` with increment/decrement of ±10 s, and announces time.
- Font scaling up to AX sizes: layouts wrap (controls row stays; title/artist go multi-line on Now Playing). Min touch targets are enforced by `IconButton`.
- Contrast ≥4.5:1 text, ≥3:1 UI glyphs, checked by the contrast guard for artwork-derived colors.
- Reduced Motion disables the marquee, artwork parallax and morphs (they become crossfades). Reduce Transparency makes glass solid.
- RTL: `start/end` styles only, mirrored skip gestures and icons where semantically appropriate (not play/next glyph direction per platform guidance), and I18nManager testing with Arabic fixtures. Strings are centralized (`lib/i18n.ts`) from day one, even though the app is English-only at launch.

## 22. Security & Privacy
- **Network:** v1 needs no network permission use. Android release builds exclude `INTERNET`, making "no network" verifiable; note that dev builds need it for Metro, so it's removed through a config plugin for release. iOS has no entitlement for this, but the app makes no requests.
- **No analytics, no crash SDK.** Crashes are monitored via Play Console vitals and Xcode Organizer (OS-level, opt-in by the user at the OS level).
- **Permissions:**
  - Required: Android `READ_MEDIA_AUDIO`/`READ_EXTERNAL_STORAGE`, FGS media playback. iOS: none at the OS level (folder access is per-user-grant).
  - Optional: notifications (Android), SAF folder grants (lyrics/playlists), Apple Music library (Later).
- **Stored locally:** library index, artwork cache, playlists, favorites, history, settings, queue snapshot. The backup file is only created on user request.
- **Future network features** (online lyrics, artist images) are off by default, per-feature toggles in Settings → Privacy, disclosed in store privacy labels at that time. They use a `LyricsProvider`/`ArtworkProvider` interface, so the core never imports network code.
- **Store privacy labels:** "Data not collected" (both stores).
- **Licenses screen:** auto-generated OSS acknowledgements (JS via a license-checker script; native via Gradle license plugin + an SPM/CocoaPods acknowledgements list), including the SFBAudioEngine codec libs (BSD/MIT) and TagLib (MPL) if adopted.

## 23. Technical Risks (and mitigations)
| Risk | Impact | Mitigation |
|---|---|---|
| `NativeTabs` is **unstable**; BottomAccessory or overlay interplay changes | Nav rework | `AppTabs` wrapper; JS-tab fallback kept compiling; Phase 1 spike |
| SFBAudioEngine integration into an Expo module (its SPM/CocoaPods packaging vs the Expo pod) | iOS engine blocked | **Phase 0 spike first week**: minimal Swift module playing FLAC + Opus in background. Fallback: vendor the XCFrameworks via podspec `vendored_frameworks` in a config-plugin-managed pod |
| Custom engine scope creep | Schedule | Strict v1 engine surface (§9), no DSP until Phase 6, shared queue test vectors |
| Media3 windowed playlist edge cases (repeat-one, seek to previous at 0–3 s) | Playback bugs | Engine-level unit tests + Maestro flows |
| OEM background killing | Playback stops | Correct FGS type, media session, help screen, device testing on Xiaomi/Samsung |
| iOS users expect "scan my phone" | Confusion, bad reviews | Onboarding explains the Files model; the Isai Documents folder works via Finder/Files; clear copy |
| Large-library scan time and memory | Poor first-run | Batched streaming, deep pass deferred, progress UI, profiling budget in §15 |
| Dependency drift (Expo SDK breaking changes every release) | Upgrade pain | Pin SDK per release; upgrade once per SDK with `expo-doctor`; fetch versioned docs (AGENTS.md rule) |
| Licensing (FFmpeg/TagLib) | Store/legal issues | No FFmpeg in v1. TagLib only under MPL. Licenses screen |
| react-native-reorderable-list / zeego compatibility | UX gaps | Fallbacks noted in §4 |

## 24. Difficult or Impossible Due to Platform Restrictions
**iOS**
- No whole-device file scan. Only user-granted folders, the app's own Documents folder and (Later) non-DRM Music-library items.
- Can't play Apple Music DRM or subscription tracks, or cloud-only items. Can't be a system-wide EQ. Can't set itself as the default player.
- No background folder watching. Auto-resume on Bluetooth connect is OS-controlled.
- No virtualizer control (spatial audio is system/AirPods-managed). No bit-perfect output.
- CarPlay needs an Apple audio entitlement application (Later).

**Android**
- Can't read non-media sidecar files (`.lrc`, `.m3u`) without SAF grants on 13+.
- Delete and tag edit need system consent dialogs. Platform `audiofx` effects vary by OEM, which is why EQ uses our own DSP.
- ALAC/AIFF/WMA/APE/DSD aren't guaranteed without an FFmpeg extension (licensing cost). Aggressive OEM task killers exist.

**Both**
- WMA unsupported in v1.
- True crossfade plus gapless together is complex (Later ⚠).
- Loudness normalization without ReplayGain tags needs an analysis pass (Later).
- Online lyrics need a provider with a usable license (Later, opt-in).

---

## 25. Development Phases & Step-by-Step Roadmap
Each step ends in a **runnable milestone** you can demo on both platforms.

### Phase 0 — De-risking spikes (≈1 week)
1. **Engine spike:** a throwaway local Expo module that plays a bundled FLAC and Ogg Opus through SFBAudioEngine on iOS, and through Media3 ExoPlayer in a `MediaSessionService` on Android. It continues on lock and shows lock-screen controls. *Milestone:* audio survives backgrounding with working system controls on both platforms.
2. **Nav spike:** `NativeTabs` with 4 tabs + `BottomAccessory` + a root overlay above the tabs. *Milestone:* the go/no-go decision on the overlay approach is recorded in `docs/decisions.md`.

### Phase 1 — Foundation (≈2 weeks)
3. Project hygiene:
   - `app.json` → `app.config.ts` (name "Isai", bundle ids `app.isai.player` or your chosen reverse-domain, `userInterfaceStyle: automatic`, minSdk 29, iOS deploymentTarget 17)
   - install Expo Router, set up `src/app/`, delete `App.tsx`/`index.ts` (entry → `expo-router/entry`)
   - ESLint via `npx expo lint`, Prettier, `tsc --noEmit` script, jest-expo
   - *Milestone:* the app boots into 4 empty tabs; lint, typecheck and tests are green.
4. Design system: tokens, ThemeProvider (light/dark/OLED/system), `Text`, `Icon`, `Surface`, `IconButton`, `ListRow`, `Artwork`, `EmptyState`, `Skeleton`. *Milestone:* a hidden `/dev/gallery` route shows all components in every theme and font scale.
5. DB layer: expo-sqlite + Drizzle schema (§8), migrations, repos skeleton, settings table with sync hydration, TanStack Query provider. *Milestone:* the settings theme toggle persists across restarts; repo tests pass in Node.

### Phase 2 — Music Library (≈3 weeks)
6. `isai-library` Android: permission flow + MediaStore fast pass streamed to `scanService`. *Milestone:* a real device library appears in the Songs list (paged, 50k-capable).
7. `isai-library` iOS: folder picker + bookmarks + Documents folder + FolderScanner + SFB tag reading. *Milestone:* the user adds an iCloud or On My iPhone folder and sees songs.
8. Albums, artists, genres, folders derivation + detail screens + fast scroller + sort sheet. *Milestone:* full library browsing.
9. Artwork pipeline (thumbnails + palette) + incremental rescan + soft-delete/rename handling + onboarding. *Milestone:* adding, deleting or renaming files is reflected after a foreground or rescan, with smooth artwork scrolling.

### Phase 3 — Audio Engine (≈4 weeks)
10. `isai-audio` core on both platforms: `setQueue`, transport, windowed feeding, `QueueManager` + shared vectors, events, `QueueStore` restore. *Milestone:* tap a song → it plays, with next/prev across an album, gapless on the fixture album, and restore after an app kill.
11. Background + system integration: session/focus/interruptions/noisy, notification, lock screen, Control Center, Bluetooth/headset, Android media resumption. *Milestone:* the manual background checklist passes on the device matrix.
12. playerStore + progress SharedValue + **MiniPlayer** + **Now Playing** (static layout first) + queue sheet with reorder/remove/play next/add to queue. *Milestone:* the end-to-end listening loop works. **This is the first dogfoodable build.**
13. Play events → history/stats (with pending-event drain), resume position setting, error auto-skip, unsupported-format badges. *Milestone:* Recently/Most played data is correct even with background-only listening.

### Phase 4 — Library Features (≈2–3 weeks)
14. Search (FTS5 index maintenance, grouped results, recent searches). *Milestone:* results in under 100 ms on 50k seeded songs.
15. Favorites, playlists (CRUD, fractional reorder, add-to-playlist sheet, save queue as playlist), multi-select actions, delete (platform flows). *Milestone:* the full collection feature set.
16. Home sections registry + Continue listening + sleep timer. *Milestone:* **MVP feature-complete.**

### Phase 5 — Premium UX (≈2–3 weeks)
17. Mini→full morph, artwork pager swipe, scrubber polish, haptics map, artwork-derived backgrounds with contrast guard. *Milestone:* 60 fps morph on a mid-range Android device (profiled).
18. Liquid Glass pass (Surface glass variant, Now Playing glass controls, scroll-edge headers, reduce-transparency fallbacks) + Android Material You dynamic color + predictive back. *Milestone:* platform-polish review against the HIG/Material checklists.

### Phase 6 — Advanced Audio & Lyrics (≈3–4 weeks, v1.x)
19. Deep tag pass on Android (Media3 MetadataRetriever; TagLib JNI if gaps), then ReplayGain (track/album/off + preamp + limiter). *Milestone:* level-matched playback across the fixture set.
20. EQ: native DSP on Android (`AudioProcessor`) and `AVAudioUnitEQ` on iOS, 10 bands + presets + bass boost; playback speed/pitch; fade on pause. *Milestone:* the EQ screen with real-time response and no glitches when changing bands.
21. Lyrics: `LyricsProvider` interface; embedded (plain + SYLT where present), sidecar `.lrc` (iOS in roots; Android via SAF grant), LRC parser, synced view. *Milestone:* synced lyrics with tap-to-seek.
22. *(Experimental, behind a Beta flag)* crossfade via the dual track slot.

### Phase 7 — Production (≈3 weeks)
23. Performance pass (budgets in §15), memory profiling with 50k songs, image cache limits, startup trace.
24. Accessibility audit (VoiceOver/TalkBack full flows, AX font sizes, RTL), error-state sweep (every §21 edge case from your brief has a UX).
25. Backup/restore + M3U import/export, licenses screen, privacy page, store assets (original branding), App Store/Play listing with honest format claims, privacy labels, release builds (local Xcode archive / Gradle bundle, EAS optional), internal testing tracks (TestFlight / Play internal). *Milestone:* **v1.0 submitted.**

**Recommended order rationale:** de-risk the two unknowns (native audio packaging and native tabs plus overlay) before building on them. Build the library before the engine so the engine has real data to play. Collections and search come after the playback loop is dogfoodable. Polish and DSP come last because they're additive layers on a stable core.

---

## 26. Verification (how each milestone is proven)
- **Every step:** `npx expo lint`, `npx tsc --noEmit`, `npx jest`, `npx expo-doctor` all pass. Dev builds via `npx expo run:android` and `npx expo run:ios` (Mac) on physical devices.
- **Engine:** the native queue test vectors pass on JUnit and XCTest. Playing the §3 fixture set confirms every "Guaranteed" format plays and every "Unsupported" one shows a badge. A manual background checklist (lock screen, Control Center/notification, BT headset buttons, incoming call, unplug headphones, another app starting audio, app swiped away on Android, reboot + BT play on Android 11+).
- **Library:** fixture scan counts match expected (songs, albums, artists, compilations, multi-disc). Rename/delete/re-add keeps favorites and playlists linked.
- **Scale:** a seeded 50k DB meets the §15 budgets on a mid-range Android device and an older iPhone.
- **E2E:** Maestro flows in `e2e/` run green on both platforms before each release.

## 27. First implementation steps after approval
0. **Write this full plan into `D:\Programming\ios-isai\CLAUDE.md`** below the existing `@AGENTS.md` line (keep that import). Add a short "Current phase: Phase 0" status line at the top so future sessions know where we are. Nothing else is touched in this step.
1. Phase 0 spikes (engine + nav) in throwaway branches, with decisions recorded.
2. Step 3 project hygiene in the existing `ios-isai` repo (rename to Isai in config; the folder name can stay).
3. Continue down the roadmap one milestone at a time, with each step verified as above before moving on.

## Isai design rules
- Brand colors: ink #15171B, white #FFFFFF. Everything else comes from the current album art.
- Gradients and blur are allowed ONLY in player backgrounds. Buttons, sliders and icons stay flat.
- Always show track metadata through src/utils/cleanMetadata.ts.
- Player backgrounds are driven by the player theme system in src/theme/player/ (never hardcode a background in a screen).
- Text and icon colors on the player must be computed from the background for at least 4.5:1 contrast.
- Animations: react-native-reanimated. Gestures: react-native-gesture-handler. Respect reduce motion.
- Ask before adding any new dependency, and explain why.
- Do not change playback logic when doing UI work.
