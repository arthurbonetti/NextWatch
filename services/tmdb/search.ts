import { CATALOG } from '@/constants/fallbackCatalog';
import type { MediaTitle } from '@/types/media';
import {
  getSearchRelevanceScore,
  matchesSearchQuery,
  normalizeSearchText,
  rankTitlesBySearchRelevance,
} from '@/utils/catalogSearch';

import {
  createAbortError,
  hasCatalogBackend,
  isAbortError,
  isUpstreamUnavailable,
  request,
} from './client';
import { MAX_SEARCH_QUERY_LENGTH } from './constants';
import { mapMedia } from './mappers';
import { fetchTitleProvidersInBrazil } from './providers';
import type { MediaEndpoint, TmdbMediaResponse, TmdbMediaResult } from './types';

export function searchStaticCatalog(encodedQuery: string): MediaTitle[] {
  const matched = CATALOG.filter((title) => matchesSearchQuery(title, encodedQuery));
  return rankTitlesBySearchRelevance(matched, encodedQuery);
}

export function mergeTitleIntoCatalog(
  byId: Map<string, MediaTitle>,
  byNameKey: Map<string, string>,
  incoming: MediaTitle,
): void {
  const nameKey = `${incoming.kind}-${normalizeSearchText(incoming.title)}-${incoming.year}`;
  const existingId = byId.has(incoming.id) ? incoming.id : byNameKey.get(nameKey);
  const existing = existingId ? byId.get(existingId) : undefined;

  if (existing) {
    const currentServices = existing.services ?? [existing.service];
    for (const service of incoming.services ?? [incoming.service]) {
      if (!currentServices.includes(service)) {
        currentServices.push(service);
      }
    }
    existing.services = [...currentServices];
    existing.service = currentServices[0] ?? existing.service;
  } else {
    const entry: MediaTitle = {
      ...incoming,
      services: incoming.services ? [...incoming.services] : [incoming.service],
    };
    byId.set(entry.id, entry);
    byNameKey.set(nameKey, entry.id);
  }
}

export async function searchCatalogTitles(
  query: string,
  fallbackProviders: string[] = [],
  signal?: AbortSignal,
): Promise<MediaTitle[]> {
  if (signal?.aborted) {
    throw createAbortError();
  }
  const encodedQuery = query.trim().slice(0, MAX_SEARCH_QUERY_LENGTH);
  if (encodedQuery.length < 2) return [];
  if (!hasCatalogBackend() || isUpstreamUnavailable()) {
    return searchStaticCatalog(encodedQuery);
  }

  try {
    const [movies, shows] = await Promise.all([
      request<TmdbMediaResponse>(
        '/search/movie',
        {
          language: 'pt-BR',
          region: 'BR',
          query: encodedQuery,
          include_adult: 'false',
          page: '1',
        },
        { signal },
      ),
      request<TmdbMediaResponse>(
        '/search/tv',
        {
          language: 'pt-BR',
          query: encodedQuery,
          include_adult: 'false',
          page: '1',
        },
        { signal },
      ),
    ]);

    if (signal?.aborted) {
      throw createAbortError();
    }

    const rawItems: { item: TmdbMediaResult; endpoint: MediaEndpoint; preliminaryScore: number }[] = [
      ...movies.results.map((item) => ({
        item,
        endpoint: 'movie' as const,
        preliminaryScore: getSearchRelevanceScore(
          mapMedia(item, 'movie', fallbackProviders),
          encodedQuery,
        ),
      })),
      ...shows.results.map((item) => ({
        item,
        endpoint: 'tv' as const,
        preliminaryScore: getSearchRelevanceScore(
          mapMedia(item, 'tv', fallbackProviders),
          encodedQuery,
        ),
      })),
    ].sort((a, b) => b.preliminaryScore - a.preliminaryScore);

    const mappedTitles = await Promise.all(
      rawItems.map(async ({ item, endpoint }, index) => {
        const providers =
          index < 16 ? await fetchTitleProvidersInBrazil(endpoint, item.id, signal) : [];
        const services = providers.length > 0 ? providers : fallbackProviders;
        return mapMedia(item, endpoint, services);
      }),
    );

    if (signal?.aborted) {
      throw createAbortError();
    }

    const deduplicated = new Map<string, MediaTitle>();
    const idByNameKey = new Map<string, string>();
    for (const title of mappedTitles) {
      mergeTitleIntoCatalog(deduplicated, idByNameKey, title);
    }
    return rankTitlesBySearchRelevance(Array.from(deduplicated.values()), encodedQuery);
  } catch (error) {
    if (signal?.aborted || isAbortError(error)) {
      throw createAbortError();
    }
    return searchStaticCatalog(encodedQuery);
  }
}
