import { normalizeSearchText } from '@/utils/catalogSearch';
import { setDynamicProviderLogo } from '@/utils/tmdbImage';

import { createAbortError, isAbortError, raceWithAbort, request } from './client';
import { PROVIDER_ALIASES } from './constants';
import type {
  MediaEndpoint,
  TmdbMediaDetails,
  TmdbProvider,
  TmdbProviderResponse,
  TmdbTitleWatchProvidersResponse,
} from './types';

let cachedProvidersPromise: Promise<TmdbProvider[]> | null = null;

export function matchCanonicalProviderName(rawProviderName: string): string | null {
  const normalizedRaw = normalizeSearchText(rawProviderName);
  for (const [canonicalName, aliases] of Object.entries(PROVIDER_ALIASES)) {
    if (aliases.some((alias) => normalizeSearchText(alias) === normalizedRaw)) {
      return canonicalName;
    }
  }
  return null;
}

export function findProviderIds(activeNames: string[], providers: TmdbProvider[]): number[] {
  const providerNames = new Set(
    activeNames.flatMap((name) => PROVIDER_ALIASES[name] ?? [name]).map(normalizeSearchText),
  );
  return Array.from(
    new Set(
      providers
        .filter((provider) => providerNames.has(normalizeSearchText(provider.provider_name)))
        .map((provider) => provider.provider_id),
    ),
  );
}

export async function getWatchProviders(signal?: AbortSignal): Promise<TmdbProvider[]> {
  if (signal?.aborted) {
    throw createAbortError();
  }
  if (!cachedProvidersPromise) {
    cachedProvidersPromise = Promise.all([
      request<TmdbProviderResponse>('/watch/providers/movie', {
        watch_region: 'BR',
        language: 'pt-BR',
      }),
      request<TmdbProviderResponse>('/watch/providers/tv', {
        watch_region: 'BR',
        language: 'pt-BR',
      }),
    ])
      .then(([movieProviders, tvProviders]) => {
        const list = [...movieProviders.results, ...tvProviders.results];
        for (const provider of list) {
          if (!provider.logo_path) continue;
          const canonical = matchCanonicalProviderName(provider.provider_name);
          if (canonical) {
            setDynamicProviderLogo(canonical, provider.logo_path);
          }
        }
        return list;
      })
      .catch((error) => {
        cachedProvidersPromise = null;
        throw error;
      });
  }
  return raceWithAbort(cachedProvidersPromise, signal);
}

export async function fetchTitleProvidersInBrazil(
  endpoint: MediaEndpoint,
  tmdbId: number,
  signal?: AbortSignal,
): Promise<string[]> {
  try {
    const response = await request<TmdbTitleWatchProvidersResponse>(
      `/${endpoint}/${tmdbId}/watch/providers`,
      {},
      { signal },
    );
    const br = response.results?.BR;
    if (!br) return [];
    const rawProviders = [...(br.flatrate ?? []), ...(br.free ?? []), ...(br.ads ?? [])];
    const matchedNames: string[] = [];

    for (const provider of rawProviders) {
      const canonical = matchCanonicalProviderName(provider.provider_name);
      if (canonical && !matchedNames.includes(canonical)) {
        matchedNames.push(canonical);
      }
    }
    return matchedNames;
  } catch (error) {
    if (signal?.aborted || isAbortError(error)) {
      throw createAbortError();
    }
    return [];
  }
}

export function extractProvidersFromDetails(details: TmdbMediaDetails): string[] | null {
  const br = details['watch/providers']?.results?.BR;
  if (!br) return null;
  const rawProviders = [...(br.flatrate ?? []), ...(br.free ?? []), ...(br.ads ?? [])];
  const matchedNames: string[] = [];
  for (const provider of rawProviders) {
    const canonical = matchCanonicalProviderName(provider.provider_name);
    if (canonical && !matchedNames.includes(canonical)) {
      matchedNames.push(canonical);
    }
  }
  return matchedNames;
}
