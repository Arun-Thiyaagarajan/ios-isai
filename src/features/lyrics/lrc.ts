/**
 * Lyrics parsing. Handles plain lyrics and LRC (time-synced) lyrics:
 *
 *   [ar:Artist]            ← header tags, ignored
 *   [offset:+250]          ← shifts every timestamp (ms; positive = earlier)
 *   [00:12.30]First line
 *   [00:15.00][01:15.00]A chorus that repeats
 */

export type SyncedLine = { timeMs: number; text: string };

export type ParsedLyrics =
  | { kind: 'synced'; lines: SyncedLine[] }
  | { kind: 'plain'; lines: string[] };

/** "[mm:ss]", "[mm:ss.xx]", "[mm:ss.xxx]" or "[mm:ss:xx]". */
const TIMESTAMP = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
const LEADING_TAGS = /^\s*(\[[^\]]*\]\s*)+/;
const OFFSET = /^\s*\[offset:\s*([+-]?\d+)\s*\]\s*$/i;

function toMs(minutes: string, seconds: string, fraction: string | undefined): number {
  const frac = fraction ? Number(fraction.padEnd(3, '0').slice(0, 3)) : 0;
  return Number(minutes) * 60_000 + Number(seconds) * 1000 + frac;
}

/**
 * Parses saved lyrics. Synced when at least a couple of lines carry timestamps; otherwise plain
 * text with any stray tags removed. Returns null for empty lyrics.
 */
export function parseLyrics(content: string | null | undefined): ParsedLyrics | null {
  if (!content || content.trim() === '') {
    return null;
  }
  const rawLines = content.replace(/\r\n?/g, '\n').split('\n');

  let offset = 0;
  const synced: SyncedLine[] = [];
  for (const raw of rawLines) {
    const offsetMatch = OFFSET.exec(raw);
    if (offsetMatch) {
      offset = Number(offsetMatch[1]);
      continue;
    }
    const times = [...raw.matchAll(TIMESTAMP)];
    if (times.length === 0) {
      continue;
    }
    const text = raw.replace(LEADING_TAGS, '').trim();
    for (const time of times) {
      synced.push({ timeMs: Math.max(0, toMs(time[1], time[2], time[3]) - offset), text });
    }
  }

  if (synced.length >= 2) {
    synced.sort((a, b) => a.timeMs - b.timeMs);
    return { kind: 'synced', lines: synced };
  }

  const lines = rawLines.map((line) => line.replace(LEADING_TAGS, '').trimEnd());
  // Drop blank lines at the ends (LRC headers leave some behind), keep the ones between verses.
  while (lines.length > 0 && lines[0].trim() === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
  return lines.length > 0 ? { kind: 'plain', lines } : null;
}

/** Index of the line being sung at `positionMs` (-1 before the first line). */
export function activeLineIndex(lines: SyncedLine[], positionMs: number): number {
  let low = 0;
  let high = lines.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lines[mid].timeMs <= positionMs) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found;
}
