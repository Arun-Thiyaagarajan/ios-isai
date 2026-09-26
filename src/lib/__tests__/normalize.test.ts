import { normalizeKey, sortKey } from '../normalize';

describe('normalize', () => {
  it('folds case, diacritics and whitespace', () => {
    expect(normalizeKey('  Beyoncé   Knowles ')).toBe('beyonce knowles');
  });

  it('keeps non-Latin text readable', () => {
    expect(normalizeKey('东京')).toBe('东京');
    expect(normalizeKey('Ελλάδα')).toBe('ελλαδα');
  });

  it('sorts without leading articles, empty values last', () => {
    expect(sortKey('The Beatles')).toBe('beatles');
    expect(sortKey('The')).toBe('the');
    expect(sortKey('The Beatles', false)).toBe('the beatles');
    expect(sortKey('')).toBe('￿');
  });
});
