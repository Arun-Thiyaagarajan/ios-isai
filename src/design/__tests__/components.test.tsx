import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button, IconButton, ListRow, Marquee, Text, ThemeProvider } from '..';

function renderThemed(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('design components', () => {
  it('Text renders its content', async () => {
    await renderThemed(<Text variant="headline">Hello</Text>);
    expect(screen.getByText('Hello')).toBeOnTheScreen();
  });

  it('Marquee shows short text once, on one line', async () => {
    await renderThemed(<Marquee variant="playerTitle">Vinmeen Vithaiyil</Marquee>);
    // The visible copy; the measuring copy is hidden from screen readers.
    expect(screen.getByText('Vinmeen Vithaiyil')).toBeOnTheScreen();
  });

  it('IconButton is announced by its label and fires onPress', async () => {
    const onPress = jest.fn();
    await renderThemed(<IconButton icon="play" label="Play" onPress={onPress} />);
    fireEvent.press(screen.getByRole('button', { name: 'Play' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('disabled Button does not fire', async () => {
    const onPress = jest.fn();
    await renderThemed(<Button label="Shuffle" onPress={onPress} disabled />);
    fireEvent.press(screen.getByRole('button', { name: 'Shuffle' }));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('ListRow combines title and subtitle for screen readers', async () => {
    await renderThemed(<ListRow title="Song" subtitle="Artist" onPress={() => {}} />);
    expect(screen.getByRole('button', { name: 'Song, Artist' })).toBeOnTheScreen();
  });
});
