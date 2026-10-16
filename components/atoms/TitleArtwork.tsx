import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet } from 'react-native';

import { TMDB_ARTWORK } from '@/constants/tmdb-artwork';

export type ArtworkVariant = 'poster' | 'backdrop';

const SIZES: Record<ArtworkVariant, string> = { poster: 'w342', backdrop: 'w780' };

// Pôster para cards verticais, banner (backdrop) para capas largas; se faltar um, usa o outro.
export function getArtworkUri(id: string, variant: ArtworkVariant): string | null {
  const artwork = TMDB_ARTWORK[id];
  if (!artwork) return null;
  const path = variant === 'poster' ? artwork.poster ?? artwork.backdrop : artwork.backdrop ?? artwork.poster;
  return path ? `https://image.tmdb.org/t/p/${SIZES[variant]}${path}` : null;
}

type TitleArtworkProps = {
  id: string;
  variant: ArtworkVariant;
};

// Preenche o container pai (que já tem a cor do título como fundo enquanto a imagem carrega).
export function TitleArtwork({ id, variant }: TitleArtworkProps) {
  const uri = getArtworkUri(id, variant);
  if (!uri) return null;

  return (
    <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} cachePolicy="memory-disk" accessible={false} />
  );
}
