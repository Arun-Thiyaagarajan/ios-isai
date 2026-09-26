/**
 * Word lists for the profile's "Random" name: a gentle adjective and a musical noun,
 * e.g. "Velvet Melody", "Quiet Raga", "Silver Tempo".
 */

export const NAME_ADJECTIVES = [
  'Velvet',
  'Quiet',
  'Silver',
  'Midnight',
  'Golden',
  'Gentle',
  'Amber',
  'Mellow',
  'Lunar',
  'Crimson',
  'Misty',
  'Starlit',
  'Tender',
  'Wandering',
  'Hidden',
  'Dreamy',
  'Evening',
  'Morning',
  'Ivory',
  'Indigo',
  'Warm',
  'Soft',
  'Distant',
  'Serene',
  'Rustic',
  'Silken',
  'Autumn',
  'Monsoon',
  'Coral',
  'Hazy',
] as const;

export const NAME_NOUNS = [
  'Melody',
  'Raga',
  'Tempo',
  'Verse',
  'Chorus',
  'Rhythm',
  'Harmony',
  'Ballad',
  'Echo',
  'Lullaby',
  'Refrain',
  'Sonnet',
  'Cadence',
  'Tala',
  'Anthem',
  'Serenade',
  'Nocturne',
  'Encore',
  'Overture',
  'Aria',
  'Groove',
  'Hymn',
  'Prelude',
  'Interlude',
  'Bridge',
  'Octave',
  'Beat',
  'Tune',
  'Swara',
  'Rhapsody',
] as const;

/** A random "Adjective Noun" name, different from `avoid` (so tapping again always changes it). */
export function randomName(avoid?: string, random: () => number = Math.random): string {
  const pick = <T,>(list: readonly T[]) => list[Math.floor(random() * list.length)];
  for (let attempt = 0; attempt < 5; attempt++) {
    const name = `${pick(NAME_ADJECTIVES)} ${pick(NAME_NOUNS)}`;
    if (name !== avoid) {
      return name;
    }
  }
  return `${NAME_ADJECTIVES[0]} ${NAME_NOUNS[0]}`;
}

/** "Arun Kumar" → "AK", "velvet" → "V"; empty for no name. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return '';
  }
  const letters = words.length === 1 ? [words[0][0]] : [words[0][0], words[words.length - 1][0]];
  return letters.join('').toUpperCase();
}
