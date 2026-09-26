import type { TrackItem } from '@/db/repos/browse';
import { emptyResults } from '@/db/repos/search';

import { resultItems } from '../resultItems';

const track = (id: number, title: string, isPlayable = true): TrackItem => ({
  id, title, artist: 'A', album: null, albumId: null, trackNo: null, discNo: null, durationMs: 1, isPlayable, artworkKey: null,
});
const artist = { id: 1, name: 'A.R. Rahman', songCount: 3, albumCount: 1, albumId: null, artworkKey: null };
const album = { id: 2, title: 'Love Songs', artist: 'X', year: null, songCount: 2, artworkKey: null, colorPrimary: null };

const headers = (items: ReturnType<typeof resultItems>) =>
  items.filter((i) => i.kind === 'header').map((i) => (i.kind === 'header' ? i.title : ''));

describe('resultItems', () => {
  it('shows a "no results" item when nothing matched', () => {
    expect(resultItems('zzz', emptyResults).map((i) => i.kind)).toEqual(['noResults']);
  });

  it('puts songs first for a plain word', () => {
    const items = resultItems('jai', { ...emptyResults, songs: [track(1, 'Jai Ho')], artists: [artist] });
    expect(headers(items)).toEqual(['Songs', 'Artists']);
  });

  it('puts the artist first when the query names them, ignoring punctuation', () => {
    const items = resultItems('ar rahman', { ...emptyResults, songs: [track(1, 'Jai Ho')], artists: [artist] });
    expect(headers(items)).toEqual(['Artists', 'Songs']);
  });

  it('puts the album first when the query is its title', () => {
    const items = resultItems('love so', { ...emptyResults, songs: [track(1, 'Love')], albums: [album] });
    expect(headers(items)).toEqual(['Albums', 'Songs']);
  });

  it('queues only playable songs, in result order', () => {
    const items = resultItems('x', { ...emptyResults, songs: [track(1, 'A'), track(2, 'B', false), track(3, 'C')] });
    const song = items.find((i) => i.kind === 'song');
    expect(song && song.kind === 'song' ? song.list : []).toEqual([1, 3]);
  });
});
