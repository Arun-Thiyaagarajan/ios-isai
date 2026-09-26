import { EmptyState } from '@/design';
import { TabScreen } from '@/features/shell/TabScreen';

export default function SearchScreen() {
  return (
    <TabScreen>
      <EmptyState
        icon="search"
        title="Search your music"
        message="Find songs, artists, albums and playlists."
      />
    </TabScreen>
  );
}
