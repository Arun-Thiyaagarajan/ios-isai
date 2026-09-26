import { formatCount, formatDuration, formatTimeAgo } from '../format';

describe('format', () => {
  it('formats durations', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(185_000)).toBe('3:05');
    expect(formatDuration(3_725_000)).toBe('1:02:05');
  });

  it('formats counts', () => {
    expect(formatCount(1, 'song')).toBe('1 song');
    expect(formatCount(1234, 'song')).toMatch(/^1.?234 songs$/);
  });

  it('formats time ago', () => {
    const now = 10 * 24 * 3_600_000;
    expect(formatTimeAgo(now - 10_000, now)).toBe('just now');
    expect(formatTimeAgo(now - 5 * 60_000, now)).toBe('5 min ago');
    expect(formatTimeAgo(now - 3 * 3_600_000, now)).toBe('3 hr ago');
    expect(formatTimeAgo(now - 30 * 3_600_000, now)).toBe('yesterday');
    expect(formatTimeAgo(now - 4 * 24 * 3_600_000, now)).toBe('4 days ago');
  });
});
