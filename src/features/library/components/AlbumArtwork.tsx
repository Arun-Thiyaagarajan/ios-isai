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
  radius?: number;
  /** Show the first letter of this title on a gradient when there's no artwork. */
  placeholderTitle?: string;
};

/** First visible character (letters and digits; symbols are skipped). */
function firstLetter(title: string): string {
  const match = title.match(/[p{L}p{N}]/u);
  return (match?.[0] ?? '♪').toUpperCase();
}

/** Album (or artist) artwork that generates its thumbnail the first time it's shown. */
export function AlbumArtwork({
  albumId,
  artworkKey,
  size,
  shape,
  placeholderColor,
  placeholderIcon = 'album',
  radius,
  placeholderTitle,
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
      radius={radius}
      placeholderLetter={placeholderTitle ? firstLetter(placeholderTitle) : undefined}
    />
  );
}
