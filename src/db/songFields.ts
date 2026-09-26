/**
 * The song fields a user can edit (Edit Song Info), in one place so the scanner, the database,
 * the editor form and the save logic all use exactly the same names and types.
 */

export type SongEditableFields = {
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
  composer: string;
  /** One or more genres separated by ";" (e.g. "Rock; Indie"). */
  genre: string;
  year: number | null;
  trackNo: number | null;
  discNo: number | null;
  bpm: number | null;
  comment: string;
  copyright: string;
};

/** A user's edits: only the fields they changed. */
export type SongOverride = Partial<SongEditableFields>;

export const TEXT_FIELDS = [
  'title',
  'artist',
  'album',
  'albumArtist',
  'composer',
  'genre',
  'comment',
  'copyright',
] as const satisfies readonly (keyof SongEditableFields)[];

export const NUMBER_FIELDS = ['year', 'trackNo', 'discNo', 'bpm'] as const satisfies readonly (keyof SongEditableFields)[];

type TextField = (typeof TEXT_FIELDS)[number];
type NumberField = (typeof NUMBER_FIELDS)[number];

/** Reads stored edits, keeping only known fields with the right types (old or corrupt data is ignored). */
export function parseOverride(json: string | null | undefined): SongOverride {
  if (!json) return {};
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return {};
  }
  if (typeof raw !== 'object' || raw === null) return {};
  const source = raw as Record<string, unknown>;
  const result: SongOverride = {};
  for (const key of TEXT_FIELDS) {
    const value = source[key];
    if (typeof value === 'string') result[key] = value;
  }
  for (const key of NUMBER_FIELDS) {
    const value = source[key];
    if (value === null || (typeof value === 'number' && Number.isInteger(value))) result[key] = value;
  }
  return result;
}

/** The tag fields of a scanned file that edits can replace. */
export type TagFields = {
  title: string | null;
  artist: string | null;
  album: string | null;
  albumArtist: string | null;
  composer: string | null;
  genre: string | null;
  year: number | null;
  trackNo: number | null;
  discNo: number | null;
  bpm: number | null;
  comment: string | null;
  copyright: string | null;
};

/** Applies edits on top of the file's tags. An emptied text field means "no value". */
export function applyOverride<T extends TagFields>(tags: T, override: SongOverride): T {
  const result: T = { ...tags };
  for (const key of TEXT_FIELDS) {
    const value = override[key as TextField];
    if (value !== undefined) {
      result[key] = value.trim() === '' ? null : value.trim();
    }
  }
  for (const key of NUMBER_FIELDS) {
    const value = override[key as NumberField];
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

// ─── Validation and change detection (used by the editor) ───────────────────

export const FIELD_LIMITS = {
  year: { min: 1000, max: 2100 },
  trackNo: { min: 1, max: 999 },
  discNo: { min: 1, max: 99 },
  bpm: { min: 1, max: 999 },
} as const;

const MAX_TEXT_LENGTH = 500;

export type FieldErrors = Partial<Record<keyof SongEditableFields, string>>;

/** Checks edited values; returns a message per invalid field (empty object = valid). */
export function validateSongFields(fields: SongEditableFields): FieldErrors {
  const errors: FieldErrors = {};
  if (fields.title.trim() === '') {
    errors.title = 'A title is required.';
  }
  for (const key of TEXT_FIELDS) {
    if (fields[key].length > MAX_TEXT_LENGTH) {
      errors[key] = `Keep this under ${MAX_TEXT_LENGTH} characters.`;
    }
  }
  for (const key of NUMBER_FIELDS) {
    const value = fields[key];
    const { min, max } = FIELD_LIMITS[key];
    if (value !== null && (!Number.isInteger(value) || value < min || value > max)) {
      errors[key] = `Enter a number from ${min} to ${max}.`;
    }
  }
  return errors;
}

/** "2019" → 2019, "" → null, "12a" → NaN (reported by validation). */
export function parseNumberInput(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  return /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}

/** Only the fields the user actually changed (text compared after trimming). */
export function changedFields(original: SongEditableFields, edited: SongEditableFields): SongOverride {
  const changes: SongOverride = {};
  for (const key of TEXT_FIELDS) {
    if (edited[key].trim() !== original[key].trim()) {
      changes[key] = edited[key].trim();
    }
  }
  for (const key of NUMBER_FIELDS) {
    if (edited[key] !== original[key]) {
      changes[key] = edited[key];
    }
  }
  return changes;
}
