import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button, IconButton, ListRow, Text, ThemeProvider } from '..';

function renderThemed(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('design components', () => {
  it('Text renders its content', async () => {
    await renderThemed(<Text variant="headline">Hello</Text>);
    expect(screen.getByText('Hello')).toBeOnTheScreen();
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
