/**
 * Removes download-site junk from song tags: "Vinmeen Vithaiyil - MassTamilan.com" → "Vinmeen Vithaiyil".
 * Case-insensitive. Never returns an empty string: if nothing real is left, the original text is kept.
 */

/** Sites that stamp their name into tags. Matched with or without a domain ending. */
const JUNK_SITES = [
  'masstamilan',
  'starmusiq',
  'isaimini',
  'tamilwire',
  'kuttyweb',
  'sensongsmp3',
  'pagalworld',
  'tamilrockers',
];

/** Domain endings treated as a website name ("anything.com"). */
const TLDS = 'com|in|net|org|info|co|cc|me|fm|io|xyz|site|live|biz|ws|to|dev|audio|music';

const JUNK_SITE = new RegExp(`\\b(?:${JUNK_SITES.join('|')})(?:\\.[a-z]{2,6})*\\b`, 'gi');
const WWW = /\bwww\.[^\s|()[\]{}]+/gi;
const DOMAIN = new RegExp(`\\b[a-z0-9][a-z0-9-]+\\.(?:${TLDS})\\b(?![.\\w])`, 'gi');
const BITRATE = /\b\d{2,3}\s?kbps\b/gi;
/** Brackets left empty (or with only separators) after the junk inside was removed. */
const EMPTY_BRACKETS = /[([{]\s*[-|–—_:~.,]*\s*[)\]}]/g;
/** Separators hanging at the start or end: " - ", "|", "–", "_" and friends. */
const EDGE_SEPARATORS = /^[\s\-|–—_:~.,]+|[\s\-|–—_:~,]+$/g;

export function cleanMetadata(text: string): string;
export function cleanMetadata(text: string | null | undefined): string | null;
export function cleanMetadata(text: string | null | undefined): string | null {
  if (text == null) {
    return null;
  }
  const cleaned = text
    .replace(WWW, ' ')
    .replace(JUNK_SITE, ' ')
    .replace(DOMAIN, ' ')
    .replace(BITRATE, ' ')
    .replace(EMPTY_BRACKETS, ' ')
    .replace(/\s+/g, ' ')
    // Separators left dangling in the middle ("Song -  - Artist") collapse to one.
    .replace(/\s*([-|–—])(?:\s*[-|–—])+\s*/g, ' $1 ')
    .replace(/\s+,/g, ',')
    .replace(EDGE_SEPARATORS, '')
    .trim();
  return cleaned.length > 0 ? cleaned : text.trim() || text;
}
