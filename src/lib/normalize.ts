/**
 * Text normalization for identity keys, sorting and search.
 * "  Beyoncé   Knowles " → "beyonce knowles"
 */
export function normalizeKey(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '') // strip combining marks (diacritics)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const LEADING_ARTICLE = /^(the|a|an)\s+/;

/**
 * Sort key: normalized, optionally without a leading English article
 * ("The Beatles" sorts under B). Empty values sort last.
 */
export function sortKey(value: string, stripArticles = true): string {
  const key = normalizeKey(value);
  if (!key) {
    return '￿';
  }
  return stripArticles ? key.replace(LEADING_ARTICLE, '') || key : key;
}
