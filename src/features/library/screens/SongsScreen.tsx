import { useQuery } from '@tanstack/react-query';

import { db } from '@/db/client';
import { queryKeys } from '@/db/queryKeys';
import { countSongs } from '@/db/repos/library';

import { SongList } from '../SongList';

export function SongsScreen() {
  const count = useQuery({ queryKey: queryKeys.library.songCount(), queryFn: () => countSongs(db) });
  return <SongList total={count.data ?? 0} />;
}
