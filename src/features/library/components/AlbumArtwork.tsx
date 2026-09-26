import { Artwork } from '@/design';
import type { IconName } from '@/design';

import { useAlbumArtwork } from '../artwork';

type Props = {
  albumId: number | null;
  artworkKey: string | null;
  size: number;
  shape?: 'rounded' | 'circle';
  placeholderColor?: string | null;
  placeholderIcon?: IconName;
};

/** Album (or artist) artwork that generates its thumbnail the first time it's shown. */
export function AlbumArtwork({
  albumId,
  artworkKey,
  size,
  shape,
  placeholderColor,
  placeholderIcon = 'album',
}: Props) {
  const { uri, onError } = useAlbumArtwork(albumId, artworkKey);

  return (
    <Artwork
      uri={uri}
      size={size}
      shape={shape}
      placeholderColor={placeholderColor ?? undefined}
      placeholderIcon={placeholderIcon}
      recyclingKey={albumId === null ? undefined : String(albumId)}
      onError={onError}
    />
  );
}
