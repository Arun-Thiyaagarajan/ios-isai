import { Stack, useRouter } from 'expo-router';

import { IconButton } from '@/design';
import { stackScreenOptions } from '@/features/shell/stackOptions';

function SettingsButton() {
  const router = useRouter();
  return <IconButton icon="settings" label="Settings" onPress={() => router.push('/settings')} />;
}

export default function HomeStack() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen
        name="index"
        options={{
          title: 'Isai',
          headerLargeTitle: true,
          headerRight: () => <SettingsButton />,
        }}
      />
    </Stack>
  );
}
