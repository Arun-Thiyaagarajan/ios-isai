/**
 * Moving Isai data in and out as files: backups (JSON) and playlists (M3U8).
 * Saving writes a file to the cache and opens the share sheet (Save to Files, AirDrop, Drive…);
 * opening uses the system file picker.
 */
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

import { db } from '@/db/client';
import { queryClient } from '@/db/queryClient';
import { createBackup, isBackup, restoreBackup } from '@/db/repos/backup';
import { importM3u, playlistForM3u } from '@/db/repos/m3u';
import { buildM3u, m3uFileName, parseM3u } from '@/features/playlists/m3u';
import { useSettings } from '@/features/settings/settingsStore';
import { showToast } from '@/features/shell/toast';
import { formatCount } from '@/lib/format';

function writeToCache(name: string, content: string): File {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  return file;
}

async function share(file: File, mimeType: string, uti: string, title: string) {
  if (!(await Sharing.isAvailableAsync())) {
    Alert.alert('Can’t share files', 'Sharing isn’t available on this device.');
    return;
  }
  await Sharing.shareAsync(file.uri, { mimeType, UTI: uti, dialogTitle: title });
}

/** Lets the user pick one file; returns its text, or null if they cancelled. */
async function pickText(types: string[]): Promise<{ name: string; text: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: types, copyToCacheDirectory: true, multiple: false });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return { name: asset.name, text: await new File(asset.uri).text() };
}

// ─── Backup ─────────────────────────────────────────────────────────────────

export async function backUpNow(): Promise<void> {
  try {
    const date = new Date().toISOString().slice(0, 10);
    const file = writeToCache(`Isai Backup ${date}.json`, JSON.stringify(createBackup(db), null, 2));
    await share(file, 'application/json', 'public.json', 'Save your Isai backup');
  } catch (error) {
    Alert.alert('Couldn’t create the backup', error instanceof Error ? error.message : 'Please try again.');
  }
}

export async function restoreFromBackup(): Promise<void> {
  let picked;
  try {
    picked = await pickText(['application/json', 'text/plain', '*/*']);
  } catch {
    Alert.alert('Couldn’t open that file');
    return;
  }
  if (!picked) return;

  let backup: unknown;
  try {
    backup = JSON.parse(picked.text);
  } catch {
    backup = null;
  }
  if (!isBackup(backup)) {
    Alert.alert('Not an Isai backup', 'Choose a file made with Back Up Now.');
    return;
  }
  const valid = backup;
  Alert.alert(
    'Restore this backup?',
    `From ${new Date(valid.createdAt).toLocaleDateString()}. Playlists, favorites, play counts, edits and settings are added to what’s already here; nothing is deleted.`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restore',
        onPress: () => {
          try {
            const summary = restoreBackup(db, valid);
            // Settings were written to the database; load them into the app.
            useSettings.getState().hydrate(db);
            queryClient.invalidateQueries();
            const missing = summary.songsMissing > 0 ? ` ${formatCount(summary.songsMissing, 'song')} aren’t on this phone.` : '';
            showToast(`Restored ${formatCount(summary.playlists, 'playlist')} and ${formatCount(summary.favorites, 'favorite')}.${missing}`);
          } catch (error) {
            Alert.alert('Couldn’t restore', error instanceof Error ? error.message : 'Please try again.');
          }
        },
      },
    ],
  );
}

// ─── M3U ────────────────────────────────────────────────────────────────────

export async function exportPlaylistM3u(playlistId: number, name: string): Promise<void> {
  try {
    const file = writeToCache(m3uFileName(name), buildM3u(playlistForM3u(db, playlistId)));
    await share(file, 'audio/x-mpegurl', 'public.m3u-playlist', `Export “${name}”`);
  } catch (error) {
    Alert.alert('Couldn’t export the playlist', error instanceof Error ? error.message : 'Please try again.');
  }
}

/** Imports an M3U/M3U8 file as a new playlist. Resolves to the new playlist's id, or null. */
export async function importPlaylistFile(): Promise<number | null> {
  let picked;
  try {
    picked = await pickText(['audio/x-mpegurl', 'audio/mpegurl', 'application/vnd.apple.mpegurl', 'application/x-mpegurl', '*/*']);
  } catch {
    Alert.alert('Couldn’t open that file');
    return null;
  }
  if (!picked) return null;

  const entries = parseM3u(picked.text);
  if (entries.length === 0) {
    Alert.alert('No songs in that file', 'Choose an .m3u or .m3u8 playlist.');
    return null;
  }
  const name = picked.name.replace(/\.m3u8?$/i, '').trim() || 'Imported Playlist';
  const result = importM3u(db, name, entries);
  queryClient.invalidateQueries({ queryKey: ['playlists'] });
  showToast(
    result.matched === result.total
      ? `Imported “${name}” with ${formatCount(result.matched, 'song')}`
      : `Imported “${name}”: found ${result.matched} of ${formatCount(result.total, 'song')} on this phone`,
  );
  return result.playlistId;
}
