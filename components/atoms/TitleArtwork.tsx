import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet } from 'react-native';

import { TMDB_ARTWORK } from '@/constants/tmdb-artwork';
import { tmdbImageUri } from '@/services/tmdb';

export type ArtworkVariant = 'poster' | 'backdrop';

const SIZES: Record<ArtworkVariant, 'w342' | 'w780'> = { poster: 'w342', backdrop: 'w780' };

// Pôster para cards verticais, banner (backdrop) para capas largas; se faltar um, usa o outro.
export function getArtworkUri(
  id: string,
  variant: ArtworkVariant,
  dynamicArtwork?: { posterPath?: string | null; backdropPath?: string | null },
): string | null {
  const dynamicPath = variant === 'poster'
    ? dynamicArtwork?.posterPath ?? dynamicArtwork?.backdropPath
    : dynamicArtwork?.backdropPath ?? dynamicArtwork?.posterPath;
  if (dynamicPath) return tmdbImageUri(dynamicPath, SIZES[variant]);

  const artwork = TMDB_ARTWORK[id];
  if (!artwork) return null;
  const path = variant === 'poster' ? artwork.poster ?? artwork.backdrop : artwork.backdrop ?? artwork.poster;
  return path ? `https://image.tmdb.org/t/p/${SIZES[variant]}${path}` : null;
}

type TitleArtworkProps = {
  id: string;
  variant: ArtworkVariant;
  posterPath?: string | null;
  backdropPath?: string | null;
};

// Preenche o container pai (que já tem a cor do título como fundo enquanto a imagem carrega).
export function TitleArtwork({ id, variant, posterPath, backdropPath }: TitleArtworkProps) {
  const uri = getArtworkUri(id, variant, { posterPath, backdropPath });
  if (!uri) return null;

  return (
    <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} cachePolicy="memory-disk" accessible={false} />
  );
}
