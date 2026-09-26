import { EmptyState } from '@/design';
import { TabScreen } from '@/features/shell/TabScreen';

export default function HomeScreen() {
  return (
    <TabScreen>
      <EmptyState
        icon="song"
        title="Nothing playing yet"
        message="Continue listening, recently played and your favorites will show up here once your library is set up."
      />
    </TabScreen>
  );
}
