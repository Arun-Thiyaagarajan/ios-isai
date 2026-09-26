import { activeLineIndex, parseLyrics } from '../lrc';

describe('parseLyrics', () => {
  it('returns null for empty lyrics', () => {
    expect(parseLyrics(null)).toBeNull();
    expect(parseLyrics('  \n ')).toBeNull();
  });

  it('keeps plain lyrics as lines, with gaps between verses', () => {
    expect(parseLyrics('One\r\nTwo\n\nThree\n')).toEqual({ kind: 'plain', lines: ['One', 'Two', '', 'Three'] });
  });

  it('parses synced LRC, ignoring header tags', () => {
    const lyrics = parseLyrics('[ar:Someone]\n[ti:Song]\n[00:12.30]Hello\n[00:15.5]World\n[01:02.345]End');
    expect(lyrics).toEqual({
      kind: 'synced',
      lines: [
        { timeMs: 12_300, text: 'Hello' },
        { timeMs: 15_500, text: 'World' },
        { timeMs: 62_345, text: 'End' },
      ],
    });
  });

  it('repeats lines that carry several timestamps, in time order', () => {
    const lyrics = parseLyrics('[00:10.00][00:30.00]Chorus\n[00:20.00]Verse');
    expect(lyrics?.kind === 'synced' && lyrics.lines.map((l) => [l.timeMs, l.text])).toEqual([
      [10_000, 'Chorus'],
      [20_000, 'Verse'],
      [30_000, 'Chorus'],
    ]);
  });

  it('applies the offset tag', () => {
    const lyrics = parseLyrics('[offset:+500]\n[00:10.00]A\n[00:20.00]B');
    expect(lyrics?.kind === 'synced' && lyrics.lines[0].timeMs).toBe(9_500);
  });

  it('treats a single stray timestamp as plain text', () => {
    expect(parseLyrics('[00:01.00]Only one\nPlain line')).toEqual({ kind: 'plain', lines: ['Only one', 'Plain line'] });
  });
});

describe('activeLineIndex', () => {
  const lines = [
    { timeMs: 1000, text: 'a' },
    { timeMs: 2000, text: 'b' },
    { timeMs: 3000, text: 'c' },
  ];
  it.each([
    [0, -1],
    [1000, 0],
    [1999, 0],
    [2500, 1],
    [9999, 2],
  ])('at %i ms → line %i', (position, expected) => {
    expect(activeLineIndex(lines, position)).toBe(expected);
  });
});
