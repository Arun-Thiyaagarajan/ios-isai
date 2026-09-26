import { GREETING_LINES, dayPart, pickGreeting } from '../greetings';

describe('home greetings', () => {
  it.each([
    [6, 'morning'],
    [13, 'afternoon'],
    [18, 'evening'],
    [23, 'night'],
    [0, 'night'],
    [3, 'dawn'],
  ])('%i o’clock is %s', (hour, part) => {
    expect(dayPart(hour)).toBe(part);
  });

  it('includes the name when there is one, and reads cleanly without it', () => {
    for (const lines of Object.values(GREETING_LINES)) {
      for (const line of lines) {
        const withName = line(', Arun');
        const without = line('');
        expect(withName).toContain('Arun');
        expect(without).not.toMatch(/,\s*[?!.✨🌙]|,\s*$|\s{2}/);
      }
    }
  });

  it('never repeats the previous greeting', () => {
    const first = pickGreeting('Arun', 9, () => 0);
    const next = pickGreeting('Arun', 9, () => 0, first);
    expect(next).not.toBe(first);
  });

  it('has an emoji in every line', () => {
    for (const lines of Object.values(GREETING_LINES)) {
      for (const line of lines) expect(line('')).toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});
