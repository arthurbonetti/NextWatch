import { sanitizeTmdbPath } from '@/constants/catalog';
import type { TmdbImageSize } from '@/types/media';

const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';
const dynamicProviderLogos = new Map<string, string>();

export type TmdbArtworkVariant = 'poster' | 'backdrop';

export const TMDB_IMAGE_DEFAULT_SIZES: Record<TmdbArtworkVariant, TmdbImageSize> = {
  poster: 'w342',
  backdrop: 'w780',
};

const ALLOWED_TMDB_SIZES = new Set<TmdbImageSize>(['w92', 'w154', 'w342', 'w500', 'w780']);

export function tmdbImageUri(
  path: string | null | undefined,
  size: TmdbImageSize = TMDB_IMAGE_DEFAULT_SIZES.poster,
): string | null {
  const safePath = sanitizeTmdbPath(path);
  const safeSize = ALLOWED_TMDB_SIZES.has(size) ? size : TMDB_IMAGE_DEFAULT_SIZES.poster;
  return safePath ? `${IMAGE_BASE_URL}/${safeSize}${safePath}` : null;
}

export function getDynamicProviderLogo(providerName: string): string | undefined {
  return dynamicProviderLogos.get(providerName);
}

export function setDynamicProviderLogo(providerName: string, logoPath: string): void {
  if (!dynamicProviderLogos.has(providerName)) {
    dynamicProviderLogos.set(providerName, logoPath);
  }
}
