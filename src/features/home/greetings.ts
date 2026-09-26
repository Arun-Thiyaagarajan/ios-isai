/**
 * Home greetings: warm, playful lines for the time of day, with the listener's name when they've
 * set one. A new line is picked each time Home opens (and on pull to refresh).
 */

export type DayPart = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night';

/** 5–12 morning, 12–17 afternoon, 17–21 evening, 21–1 night, 1–5 the small hours. */
export function dayPart(hour: number): DayPart {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  if (hour >= 21 || hour < 1) return 'night';
  return 'dawn';
}

/** Each line gets the name (already with a leading ", " or "") so it reads well either way. */
type Line = (name: string) => string;

const LINES: Record<DayPart, Line[]> = {
  morning: [
    (n) => `Good morning${n} ☀️ Let’s start with a banger!`,
    (n) => `Rise and shine${n} 🌅 Your soundtrack is ready.`,
    (n) => `Morning${n} ☕ Coffee and a great song, sorted.`,
    (n) => `Hello${n} 🌼 What’s the vibe today, sunshine?`,
    (n) => `Top of the morning${n} 🎶 Let the music wake you up.`,
    (n) => `Fresh day, fresh tunes${n} ✨`,
  ],
  afternoon: [
    (n) => `Good afternoon${n} 🌤️ Time for a mood boost!`,
    (n) => `Hey${n} 👋 Perfect afternoon for a playlist.`,
    (n) => `Afternoon slump? Not on our watch${n} ⚡🎧`,
    (n) => `Lunch break beats${n} 🍛🎵`,
    (n) => `Keep the energy up${n} 🚀 Press play!`,
    (n) => `Sun’s high, volume’s higher${n} 😎`,
  ],
  evening: [
    (n) => `Good evening${n} 🌇 Unwind with something beautiful.`,
    (n) => `Evening vibes${n} 🌆 Let the music take over.`,
    (n) => `Golden hour, golden songs${n} ✨🎶`,
    (n) => `Hey${n} 🍵 Chai, calm and your favourite melodies.`,
    (n) => `The day’s done${n} 🎧 You’ve earned this.`,
    (n) => `Sunset sessions${n} 🌅 What are we playing?`,
  ],
  night: [
    (n) => `Night owl mode${n} 🦉🎶`,
    (n) => `Good night${n} 🌙 Something soft before sleep?`,
    (n) => `Stars are out${n} ✨ So are the slow songs.`,
    (n) => `Late-night listening${n} 🌌 Our favourite kind.`,
    (n) => `Wind down${n} 😌 Let the melodies do the rest.`,
    (n) => `Moonlight melodies${n} 🌙🎹`,
  ],
  dawn: [
    (n) => `Still up${n}? 🌌 The best songs play at this hour.`,
    (n) => `Hello, fellow night owl${n} 🦉`,
    (n) => `The world’s asleep${n} 🌙 Turn it up (softly).`,
    (n) => `Can’t sleep${n}? 🎧 Let the music keep you company.`,
    (n) => `3 AM thoughts need a soundtrack${n} ✨`,
    (n) => `Quiet hours, loud feelings${n} 💫`,
  ],
};

/**
 * A greeting for this hour. `random` picks the line (injectable for tests); `avoid` skips the line
 * shown last time so refreshing always changes it.
 */
export function pickGreeting(
  name: string,
  hour = new Date().getHours(),
  random: () => number = Math.random,
  avoid?: string,
): string {
  const trimmed = name.trim();
  const suffix = trimmed ? `, ${trimmed}` : '';
  const lines = LINES[dayPart(hour)];
  let index = Math.floor(random() * lines.length);
  let text = lines[index](suffix);
  if (text === avoid && lines.length > 1) {
    index = (index + 1) % lines.length;
    text = lines[index](suffix);
  }
  return text;
}

export const GREETING_LINES = LINES;
