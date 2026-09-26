import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { makeStyles } from '../theme';
import { Text } from './Text';

type Props<T extends string> = {
  value: T;
  choices: { value: T; label: string }[];
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
};

/** A row of mutually exclusive choices (a radio group); the chosen one is filled with the accent. */
export function Segmented<T extends string>({ value, choices, onChange, style }: Props<T>) {
  const styles = useStyles();
  return (
    <View style={[styles.segmented, style]} accessibilityRole="radiogroup">
      {choices.map((choice) => {
        const active = choice.value === value;
        return (
          <Pressable
            key={choice.value}
            onPress={() => onChange(choice.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text variant="subhead" color={active ? 'onAccent' : 'primary'} style={styles.label}>
              {choice.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  segmented: {
    flexDirection: 'row',
    backgroundColor: t.colors.surfaceHigh,
    borderRadius: t.radius.md,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    minHeight: 36,
    paddingHorizontal: t.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: t.radius.sm,
  },
  segmentActive: {
    backgroundColor: t.colors.accent,
  },
  label: {
    fontWeight: '600',
  },
}));
