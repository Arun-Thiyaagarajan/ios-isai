/**
 * Every icon the app uses, by meaning rather than by glyph name.
 *
 * iOS: SF Symbols (Apple's system icon set; free for apps on Apple platforms, matches SF Pro,
 * scales with Dynamic Type). Android: Material Symbols (Google, Apache 2.0).
 * Apple's license limits SF Symbols to Apple platforms, which is why Android gets its own set.
 */
import type { AndroidSymbol, SFSymbol } from 'expo-symbols';

type IconSpec = { ios: SFSymbol; android: AndroidSymbol };

export const icons = {
  // Navigation
  home: { ios: 'house.fill', android: 'home' },
  library: { ios: 'square.stack.fill', android: 'library_music' },
  playlists: { ios: 'music.note.list', android: 'queue_music' },
  search: { ios: 'magnifyingglass', android: 'search' },
  settings: { ios: 'gearshape', android: 'settings' },
  back: { ios: 'chevron.left', android: 'arrow_back' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right' },
  chevronDown: { ios: 'chevron.down', android: 'keyboard_arrow_down' },
  close: { ios: 'xmark', android: 'close' },
  more: { ios: 'ellipsis', android: 'more_horiz' },

  // Playback
  play: { ios: 'play.fill', android: 'play_arrow' },
  pause: { ios: 'pause.fill', android: 'pause' },
  next: { ios: 'forward.fill', android: 'skip_next' },
  previous: { ios: 'backward.fill', android: 'skip_previous' },
  shuffle: { ios: 'shuffle', android: 'shuffle' },
  repeat: { ios: 'repeat', android: 'repeat' },
  repeatOne: { ios: 'repeat.1', android: 'repeat_one' },
  queue: { ios: 'list.bullet', android: 'format_list_bulleted' },
  lyrics: { ios: 'quote.bubble', android: 'lyrics' },
  output: { ios: 'airplay.audio', android: 'speaker_group' },
  sleepTimer: { ios: 'moon.zzz', android: 'bedtime' },
  equalizer: { ios: 'slider.vertical.3', android: 'equalizer' },

  // Library content
  song: { ios: 'music.note', android: 'music_note' },
  album: { ios: 'square.stack', android: 'album' },
  artist: { ios: 'music.microphone', android: 'mic' },
  genre: { ios: 'guitars', android: 'category' },
  folder: { ios: 'folder', android: 'folder' },
  folderAdd: { ios: 'folder.badge.plus', android: 'create_new_folder' },

  // Actions
  favorite: { ios: 'heart', android: 'favorite' },
  favoriteFilled: { ios: 'heart.fill', android: 'favorite' },
  playNext: { ios: 'text.line.first.and.arrowtriangle.forward', android: 'playlist_play' },
  addToQueue: { ios: 'text.line.last.and.arrowtriangle.forward', android: 'playlist_add' },
  addToPlaylist: { ios: 'text.badge.plus', android: 'playlist_add' },
  add: { ios: 'plus', android: 'add' },
  check: { ios: 'checkmark', android: 'check' },
  delete: { ios: 'trash', android: 'delete' },
  sort: { ios: 'arrow.up.arrow.down', android: 'sort' },
  refresh: { ios: 'arrow.clockwise', android: 'refresh' },
  grid: { ios: 'square.grid.2x2', android: 'grid_view' },
  list: { ios: 'list.bullet', android: 'view_list' },
  info: { ios: 'info.circle', android: 'info' },
  warning: { ios: 'exclamationmark.triangle', android: 'warning' },
} as const satisfies Record<string, IconSpec>;

export type IconName = keyof typeof icons;
