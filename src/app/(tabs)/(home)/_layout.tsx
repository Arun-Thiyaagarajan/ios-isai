import { Stack, router } from 'expo-router';

import { headerActions } from '@/features/shell/headerActions';
import { stackScreenOptions } from '@/features/shell/stackOptions';
import { TabStackFrame } from '@/features/shell/TabStackFrame';

export default function HomeStack() {
  return (
    <TabStackFrame>
      <Stack screenOptions={stackScreenOptions}>
        <Stack.Screen
          name="index"
          options={{
            title: 'Isai',
            headerLargeTitle: true,
            ...headerActions([{ icon: 'settings', label: 'Settings', onPress: () => router.push('/settings') }]),
          }}
        />
      </Stack>
    </TabStackFrame>
  );
}
