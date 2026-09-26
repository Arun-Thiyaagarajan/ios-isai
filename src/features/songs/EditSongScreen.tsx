import { useQueryClient } from '@tanstack/react-query';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View, type KeyboardTypeOptions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { db } from '@/db/client';
import { getSongEditData, saveSongEdits, type ArtworkChange, type SongEditData } from '@/db/repos/songEdits';
import {
  changedFields,
  parseNumberInput,
  validateSongFields,
  type FieldErrors,
  type SongEditableFields,
} from '@/db/songFields';
import { Artwork, Button, EmptyScreen, Text, TextField, makeStyles, useTheme } from '@/design';
import { AlbumArtwork } from '@/features/library/components/AlbumArtwork';
import { refreshSongInQueue } from '@/features/player/playerService';
import { showToast } from '@/features/shell/toast';

type NumberKey = 'year' | 'trackNo' | 'discNo' | 'bpm';
type TextKey = Exclude<keyof SongEditableFields, NumberKey>;

const COVER_SIZE = 168;

/** Copies a picked image into the app's documents (the picker's copy may be deleted by the system). */
async function keepImage(songId: number, pickedUri: string): Promise<string> {
  const covers = new Directory(Paths.document, 'covers');
  covers.create({ idempotent: true, intermediates: true });
  const ext = pickedUri.split('?')[0].split('.').pop()?.toLowerCase();
  const safeExt = ext && /^(jpe?g|png|heic|webp)$/.test(ext) ? ext : 'jpg';
  const target = new File(covers, `song-${songId}-${Date.now()}.${safeExt}`);
  await new File(pickedUri).copy(target);
  return target.uri;
}

function Section({ title, children, footer }: { title: string; children: ReactNode; footer?: string }) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <Text variant="footnote" color="secondary" accessibilityRole="header" style={styles.sectionTitle}>
        {title.toUpperCase()}
      </Text>
      <View style={styles.sectionBody}>{children}</View>
      {footer ? (
        <Text variant="footnote" color="secondary" style={styles.sectionFooter}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.field}>
      <Text variant="footnote" color="secondary">
        {label}
      </Text>
      {children}
      {error ? (
        <Text variant="footnote" color="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.readOnly}>
      <Text variant="subhead" color="secondary">
        {label}
      </Text>
      <Text variant="body" selectable numberOfLines={3}>
        {value || '—'}
      </Text>
    </View>
  );
}

function Editor({ data }: { data: SongEditData }) {
  const theme = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const navigation = useNavigation();

  const [fields, setFields] = useState<SongEditableFields>(data.fields);
  // Number inputs keep the raw text so partial typing ("20") isn't rewritten while typing.
  const [numberText, setNumberText] = useState<Record<NumberKey, string>>({
    year: data.fields.year?.toString() ?? '',
    trackNo: data.fields.trackNo?.toString() ?? '',
    discNo: data.fields.discNo?.toString() ?? '',
    bpm: data.fields.bpm?.toString() ?? '',
  });
  const [lyrics, setLyrics] = useState(data.lyrics);
  const [artwork, setArtwork] = useState<ArtworkChange>({ kind: 'keep' });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const errors: FieldErrors = validateSongFields(fields);
  const changes = changedFields(data.fields, fields);
  const lyricsChanged = lyrics.trim() !== data.lyrics.trim();
  const dirty = Object.keys(changes).length > 0 || lyricsChanged || artwork.kind !== 'keep';
  const valid = Object.keys(errors).length === 0;

  // Close once a save finished (after the "unsaved changes" guard is released).
  useEffect(() => {
    if (done) router.back();
  }, [done]);

  usePreventRemove(dirty && !done, ({ data: event }) => {
    Alert.alert('Discard changes?', 'Your edits to this song haven’t been saved.', [
      { text: 'Keep Editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(event.action) },
    ]);
  });

  const setText = (key: TextKey) => (value: string) => setFields((f) => ({ ...f, [key]: value }));
  const setNumber = (key: NumberKey) => (value: string) => {
    setNumberText((t) => ({ ...t, [key]: value }));
    setFields((f) => ({ ...f, [key]: parseNumberInput(value) }));
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setArtwork({ kind: 'set', uri: result.assets[0].uri });
    }
  };

  const save = async () => {
    if (!dirty || !valid || saving) return;
    setSaving(true);
    try {
      const finalArtwork: ArtworkChange =
        artwork.kind === 'set' ? { kind: 'set', uri: await keepImage(data.songId, artwork.uri) } : artwork;
      saveSongEdits(db, data.songId, {
        changes,
        lyrics: lyricsChanged ? lyrics : undefined,
        artwork: finalArtwork,
      });
      refreshSongInQueue(data.songId);
      await client.invalidateQueries();
      showToast({ icon: 'edit', message: 'Song Info Saved' });
      setDone(true);
    } catch (error) {
      setSaving(false);
      Alert.alert('Couldn’t save', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  // What the cover preview shows for the pending choice.
  const cover =
    artwork.kind === 'set' ? (
      <Artwork uri={artwork.uri} size={COVER_SIZE} />
    ) : artwork.kind === 'remove' ? (
      <Artwork uri={null} size={COVER_SIZE} placeholderIcon="song" />
    ) : artwork.kind === 'reset' || !data.hasCustomArtwork ? (
      <AlbumArtwork albumId={data.albumId} artworkKey={null} size={COVER_SIZE} placeholderIcon="song" />
    ) : (
      <Artwork uri={data.artworkUri} size={COVER_SIZE} placeholderIcon="song" />
    );
  // A cover is showing (and can be removed) unless it was just removed or the song has none.
  const canRemove =
    artwork.kind === 'set' || artwork.kind === 'reset' || (artwork.kind === 'keep' && data.artworkUri !== null);
  // "Use Album Artwork" undoes a custom or removed cover.
  const canReset = data.hasCustomArtwork ? artwork.kind !== 'reset' : artwork.kind !== 'keep';

  const text = (key: TextKey, label: string, extra?: { multiline?: boolean; placeholder?: string }) => (
    <Field label={label} error={errors[key]}>
      <TextField
        value={fields[key]}
        onChangeText={setText(key)}
        placeholder={extra?.placeholder}
        autoCapitalize={key === 'genre' ? 'words' : 'sentences'}
        accessibilityLabel={label}
        multiline={extra?.multiline}
        style={extra?.multiline ? styles.multiline : undefined}
      />
    </Field>
  );

  const number = (key: NumberKey, label: string, keyboard: KeyboardTypeOptions = 'number-pad') => (
    <View style={styles.half}>
      <Field label={label} error={errors[key]}>
        <TextField
          value={numberText[key]}
          onChangeText={setNumber(key)}
          keyboardType={keyboard}
          inputMode="numeric"
          maxLength={4}
          accessibilityLabel={label}
        />
      </Field>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { paddingTop: Platform.OS === 'ios' ? 0 : insets.top }]}
    >
      {/* Top bar: Cancel · title · Save, all vertically centered. */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={8} style={styles.barButton}>
          <Text variant="body" color="accent">
            Cancel
          </Text>
        </Pressable>
        <Text variant="headline" numberOfLines={1} style={styles.barTitle}>
          Edit Info
        </Text>
        <Pressable
          onPress={save}
          disabled={!dirty || !valid || saving}
          accessibilityRole="button"
          accessibilityState={{ disabled: !dirty || !valid || saving }}
          hitSlop={8}
          style={[styles.barButton, styles.barButtonRight]}
        >
          <Text variant="headline" color={dirty && valid && !saving ? 'accent' : 'tertiary'}>
            {saving ? 'Saving…' : 'Save'}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.max }]}
      >
        <View style={styles.coverArea}>
          <View style={styles.cover}>{cover}</View>
          <View style={styles.coverButtons}>
            <Button label="Choose Photo" icon="photo" variant="secondary" onPress={pickImage} />
            {canRemove ? (
              <Button label="Remove" variant="secondary" onPress={() => setArtwork({ kind: 'remove' })} />
            ) : null}
          </View>
          {canReset ? (
            <Pressable onPress={() => setArtwork(data.hasCustomArtwork ? { kind: 'reset' } : { kind: 'keep' })} hitSlop={8}>
              <Text variant="subhead" color="accent">
                Use Album Artwork
              </Text>
            </Pressable>
          ) : null}
        </View>

        <Section title="Details">
          {text('title', 'Title')}
          {text('artist', 'Artist')}
          {text('album', 'Album')}
          {text('albumArtist', 'Album Artist', { placeholder: 'Same as artist' })}
          {text('composer', 'Composer')}
          {text('genre', 'Genre', { placeholder: 'e.g. Rock; Indie' })}
        </Section>

        <Section title="Numbers">
          <View style={styles.row}>
            {number('year', 'Year')}
            {number('bpm', 'BPM')}
          </View>
          <View style={styles.row}>
            {number('trackNo', 'Track')}
            {number('discNo', 'Disc')}
          </View>
        </Section>

        <Section title="Notes">
          {text('comment', 'Comment', { multiline: true })}
          {text('copyright', 'Copyright')}
        </Section>

        <Section title="Lyrics">
          <TextField
            value={lyrics}
            onChangeText={setLyrics}
            placeholder="Add lyrics"
            multiline
            accessibilityLabel="Lyrics"
            style={styles.lyrics}
          />
        </Section>

        <Section
          title="File"
          footer="Changes are saved in Isai’s library and kept when you rescan. Writing them into the music file itself isn’t supported yet."
        >
          <ReadOnlyRow label="File name" value={data.file.name} />
          <ReadOnlyRow label="Format" value={data.file.format} />
          <ReadOnlyRow label="Folder" value={data.file.folder} />
        </Section>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Edit Song Info. Route param: `songId`. */
export function EditSongScreen() {
  const songId = Number(useLocalSearchParams<{ songId: string }>().songId);
  // Read once: the form works on its own copy until Save.
  const [data] = useState(() => (Number.isFinite(songId) ? getSongEditData(db, songId) : null));

  if (!data) {
    return <EmptyScreen icon="song" title="Song not found" message="It may have been removed from your library." />;
  }
  return <Editor data={data} />;
}

const useStyles = makeStyles((t) => ({
  screen: {
    flex: 1,
    backgroundColor: t.colors.bgElevated,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: t.sizes.touchTarget + t.spacing.md,
    paddingHorizontal: t.gutter,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.separator,
  },
  barButton: {
    minWidth: 72,
    minHeight: t.sizes.touchTarget,
    justifyContent: 'center',
  },
  barButtonRight: {
    alignItems: 'flex-end',
  },
  barTitle: {
    flex: 1,
    textAlign: 'center',
  },
  content: {
    paddingTop: t.spacing.lg,
  },
  coverArea: {
    alignItems: 'center',
    gap: t.spacing.md,
    paddingHorizontal: t.gutter,
  },
  cover: {
    ...t.shadows.artwork,
  },
  coverButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
  },
  section: {
    paddingTop: t.spacing.xxl,
  },
  sectionTitle: {
    paddingHorizontal: t.gutter,
    paddingBottom: t.spacing.sm,
    letterSpacing: 0.4,
  },
  sectionBody: {
    paddingHorizontal: t.gutter,
    gap: t.spacing.md,
  },
  sectionFooter: {
    paddingHorizontal: t.gutter,
    paddingTop: t.spacing.sm,
  },
  field: {
    gap: t.spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: t.spacing.md,
  },
  half: {
    flex: 1,
  },
  multiline: {
    height: undefined,
    minHeight: 88,
    paddingTop: t.spacing.md,
    paddingBottom: t.spacing.md,
    textAlignVertical: 'top',
  },
  lyrics: {
    height: undefined,
    minHeight: 180,
    paddingTop: t.spacing.md,
    paddingBottom: t.spacing.md,
    textAlignVertical: 'top',
  },
  readOnly: {
    gap: t.spacing.xxs,
  },
}));
