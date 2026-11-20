import { Image, type ImageProps } from 'expo-image';
import { memo, ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { TMDB_ARTWORK } from '@/constants/tmdb-artwork';
import type { TmdbImageSize } from '@/types/media';
import { TMDB_IMAGE_DEFAULT_SIZES, type TmdbArtworkVariant, tmdbImageUri } from '@/utils/tmdbImage';

// Pôster para cards verticais, banner (backdrop) para capas largas; se faltar um, usa o outro.
export function getArtworkUri(
  id: string,
  variant: TmdbArtworkVariant,
  dynamicArtwork?: { posterPath?: string | null; backdropPath?: string | null },
  sizeOverride?: TmdbImageSize,
): string | null {
  const targetSize = sizeOverride ?? TMDB_IMAGE_DEFAULT_SIZES[variant];
  const dynamicPath = variant === 'poster'
    ? dynamicArtwork?.posterPath ?? dynamicArtwork?.backdropPath
    : dynamicArtwork?.backdropPath ?? dynamicArtwork?.posterPath;
  if (dynamicPath) return tmdbImageUri(dynamicPath, targetSize);

  const artwork = TMDB_ARTWORK[id];
  if (!artwork) return null;
  const path = variant === 'poster' ? artwork.poster ?? artwork.backdrop : artwork.backdrop ?? artwork.poster;
  return tmdbImageUri(path, targetSize);
}

type TitleArtworkProps = {
  id: string;
  variant: TmdbArtworkVariant;
  posterPath?: string | null;
  backdropPath?: string | null;
  size?: TmdbImageSize;
  priority?: ImageProps['priority'];
  transition?: ImageProps['transition'];
  fallback?: ReactNode;
};

// Preenche o container pai (que já tem a cor do título como fundo enquanto a imagem carrega).
export const TitleArtwork = memo(function TitleArtwork({
  id,
  variant,
  posterPath,
  backdropPath,
  size,
  priority = 'normal',
  transition,
  fallback = null,
}: TitleArtworkProps) {
  const uri = getArtworkUri(id, variant, { posterPath, backdropPath }, size);
  if (!uri) return fallback;

  const resolvedTransition = transition ?? (priority === 'high' ? 0 : 200);

  return (
    <Image
      source={{ uri }}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      priority={priority}
      transition={resolvedTransition}
      cachePolicy="memory-disk"
      accessible={false}
    />
  );
});
