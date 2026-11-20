import { sanitizeTmdbPath } from '@/constants/catalog';
import type { TmdbImageSize } from '@/types/media';

const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';
const dynamicProviderLogos = new Map<string, string>();

export function tmdbImageUri(path: string | null | undefined, size: TmdbImageSize): string | null {
  const safePath = sanitizeTmdbPath(path);
  return safePath ? `${IMAGE_BASE_URL}/${size}${safePath}` : null;
}

export function getDynamicProviderLogo(providerName: string): string | undefined {
  return dynamicProviderLogos.get(providerName);
}

export function setDynamicProviderLogo(providerName: string, logoPath: string): void {
  if (!dynamicProviderLogos.has(providerName)) {
    dynamicProviderLogos.set(providerName, logoPath);
  }
}
