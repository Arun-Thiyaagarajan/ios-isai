import { useQueryClient } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { db } from '@/db/client';
import { queryKeys } from '@/db/queryKeys';
import { getPlaylistSummary } from '@/db/repos/browse';
import { addSongsToPlaylist, createPlaylist, renamePlaylist } from '@/db/repos/playlists';
import { Button, Text, TextField, makeStyles, useTheme } from '@/design';
import { showErrorToast, showToast } from '@/features/shell/toast';

/**
 * Create a playlist (optionally with songs already chosen) or rename one.
 * Params: `playlistId` to rename; `songIds` ("1,2,3") to add after creating.
 */
export function PlaylistEditScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const client = useQueryClient();
  const params = useLocalSearchParams<{ playlistId?: string; songIds?: string }>();
  const playlistId = params.playlistId ? Number(params.playlistId) : null;
  const renaming = playlistId !== null;

  const [name, setName] = useState(() => (renaming ? (getPlaylistSummary(db, playlistId)?.name ?? '') : ''));
  const trimmed = name.trim();

  const save = () => {
    if (!trimmed) return;
    try {
      if (renaming) {
        renamePlaylist(db, playlistId, trimmed);
        showToast({ icon: 'edit', message: `Renamed to ${trimmed}` });
      } else {
        const playlist = createPlaylist(db, trimmed);
        const songIds = (params.songIds ?? '').split(',').filter(Boolean).map(Number).filter(Number.isFinite);
        if (songIds.length > 0) {
          addSongsToPlaylist(db, playlist.id, songIds);
          showToast({ icon: 'addToPlaylist', message: `Added to ${trimmed}` });
        } else {
          showToast({ icon: 'playlistNew', message: `Created ${trimmed}` });
        }
      }
    } catch {
      showErrorToast(renaming ? 'Couldn’t rename playlist' : 'Couldn’t create playlist');
    }
    client.invalidateQueries({ queryKey: queryKeys.playlists.all });
    router.back();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { backgroundColor: theme.colors.bgElevated }]}
    >
      <Stack.Screen options={{ title: renaming ? 'Rename Playlist' : 'New Playlist' }} />
      <View style={styles.form}>
        <Text variant="footnote" color="secondary">
          Name
        </Text>
        <TextField
          value={name}
          onChangeText={setName}
          placeholder="My Playlist"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={save}
          maxLength={100}
          accessibilityLabel="Playlist name"
        />
        <Button label={renaming ? 'Save' : 'Create Playlist'} onPress={save} disabled={!trimmed} />
      </View>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((t) => ({
  screen: {
    flex: 1,
  },
  form: {
    padding: t.gutter,
    gap: t.spacing.md,
  },
}));
