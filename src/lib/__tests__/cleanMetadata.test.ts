import { cleanMetadata } from '../cleanMetadata';

describe('cleanMetadata', () => {
  it.each([
    ['Vinmeen Vithaiyil - MassTamilan.com', 'Vinmeen Vithaiyil'],
    ['Abhay Jodhpurkar, Saindhavi - MassTamilan.com', 'Abhay Jodhpurkar, Saindhavi'],
    ['Thegidi - MassTamilan.com', 'Thegidi'],
    ['Kaathalae Kaathalae - Masstamilan.in', 'Kaathalae Kaathalae'],
    ['Ennai Maatrum Kadhale [Starmusiq]', 'Ennai Maatrum Kadhale'],
    ['Why This Kolaveri Di - isaimini', 'Why This Kolaveri Di'],
    ['Rowdy Baby | www.tamilsongs.net', 'Rowdy Baby'],
    ['Vaathi Coming (128kbps)', 'Vaathi Coming'],
    ['Arabic Kuthu 320kbps', 'Arabic Kuthu'],
    ['Aalaporaan Tamizhan - 320 kbps - MassTamilan.com', 'Aalaporaan Tamizhan'],
    ['MassTamilan.com - Megham Karukatha', 'Megham Karukatha'],
    ['Enjoy  Enjaami  -  ', 'Enjoy Enjaami'],
    ['Master (2021) - MassTamilan.dev', 'Master (2021)'],
  ])('%s → %s', (input, expected) => {
    expect(cleanMetadata(input)).toBe(expected);
  });

  it('is case-insensitive', () => {
    expect(cleanMetadata('Song - MASSTAMILAN.COM')).toBe('Song');
    expect(cleanMetadata('Song [STARMUSIQ]')).toBe('Song');
  });

  it('keeps real names untouched', () => {
    expect(cleanMetadata('A.R. Rahman')).toBe('A.R. Rahman');
    expect(cleanMetadata('Anirudh Ravichander, Dhanush')).toBe('Anirudh Ravichander, Dhanush');
    expect(cleanMetadata('Nenjame - Reprise')).toBe('Nenjame - Reprise');
    expect(cleanMetadata('Why This Kolaveri Di (Remix)')).toBe('Why This Kolaveri Di (Remix)');
    expect(cleanMetadata('வெண்மேகம்')).toBe('வெண்மேகம்');
  });

  it('never returns an empty string', () => {
    expect(cleanMetadata('MassTamilan.com')).toBe('MassTamilan.com');
    expect(cleanMetadata(' - ')).not.toBe('');
  });

  it('passes null through', () => {
    expect(cleanMetadata(null)).toBeNull();
    expect(cleanMetadata(undefined)).toBeNull();
  });
});
