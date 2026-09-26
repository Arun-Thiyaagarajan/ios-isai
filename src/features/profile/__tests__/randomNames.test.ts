import { NAME_ADJECTIVES, NAME_NOUNS, initials, randomName } from '../randomNames';

describe('random profile names', () => {
  it('has about 30 words on each side, no duplicates', () => {
    expect(NAME_ADJECTIVES.length).toBe(30);
    expect(NAME_NOUNS.length).toBe(30);
    expect(new Set(NAME_ADJECTIVES).size).toBe(30);
    expect(new Set(NAME_NOUNS).size).toBe(30);
  });

  it('makes "Adjective Noun" names', () => {
    const name = randomName();
    const [adjective, noun] = name.split(' ');
    expect(NAME_ADJECTIVES).toContain(adjective);
    expect(NAME_NOUNS).toContain(noun);
  });

  it('never repeats the current name', () => {
    let calls = 0;
    // First attempt returns the name to avoid, the second a different one.
    const random = () => (calls++ < 2 ? 0 : 0.5);
    expect(randomName('Velvet Melody', random)).not.toBe('Velvet Melody');
  });
});

describe('initials', () => {
  it.each([
    ['Arun', 'A'],
    ['arun kumar', 'AK'],
    ['  Velvet  Quiet Melody ', 'VM'],
    ['', ''],
  ])('%s → %s', (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});
