/** @jest-environment node */
import { getArtworkPalette, saveArtworkPalette } from '../repos/palettes';
import { createTestDb } from '../testing/testDb';

describe('artwork palettes', () => {
  it('saves and reads colors by image URI', () => {
    const db = createTestDb();
    expect(getArtworkPalette(db, 'file:///a.jpg')).toBeUndefined();
    saveArtworkPalette(db, 'file:///a.jpg', { dominant: '#112233' });
    saveArtworkPalette(db, 'file:///a.jpg', { dominant: '#445566', vibrant: '#FF0000' });
    expect(getArtworkPalette(db, 'file:///a.jpg')).toEqual({ dominant: '#445566', vibrant: '#FF0000' });
  });
});
