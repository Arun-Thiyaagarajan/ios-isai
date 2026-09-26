import { EmptyState } from '@/design';
import { TabScreen } from '@/features/shell/TabScreen';

export default function PlaylistsScreen() {
  return (
    <TabScreen>
      <EmptyState
        icon="playlists"
        title="No playlists yet"
        message="Create playlists and keep your favorites here."
      />
    </TabScreen>
  );
}
