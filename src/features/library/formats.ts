/**
 * Which audio formats Isai can play, per platform (see the format matrix in CLAUDE.md §3).
 * Unplayable files still appear in the library, greyed out with a reason.
 */
type Platform = 'ios' | 'android';

const UNSUPPORTED: Record<Platform, Record<string, string>> = {
  ios: {
    wma: 'WMA isn’t supported on iPhone',
  },
  android: {
    wma: 'WMA isn’t supported on Android',
  },
};

export function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : '';
}

export function playability(
  platform: Platform,
  fileName: string,
  mime: string | null,
): { isPlayable: boolean; unplayableReason: string | null } {
  const ext = fileExtension(fileName);
  const isWmaMime = mime === 'audio/x-ms-wma';
  const reason = UNSUPPORTED[platform][isWmaMime ? 'wma' : ext] ?? null;
  return { isPlayable: reason === null, unplayableReason: reason };
}
