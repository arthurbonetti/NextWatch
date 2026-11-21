import {
  CATALOG,
  getSearchRelevanceScore,
  matchesSearchQuery,
  normalizeSearchText,
  rankTitlesBySearchRelevance,
  sanitizeTmdbPath,
  type MediaIcon,
  type MediaTitle,
} from '@/constants/catalog';
import { TMDB_ARTWORK } from '@/constants/tmdb-artwork';
import { getSupabaseAnonKey, getSupabaseUrl, hasSupabaseConfig } from '@/services/supabase';
import type {
  CastMember,
  EpisodeSummary,
  RichTitleDetails,
  SeasonSummary,
} from '@/types/media';
import { fetchWithTimeout } from '@/utils/http';
import { quickSortByRandom } from '@/utils/quickSort';
import {
  getDynamicProviderLogo,
  setDynamicProviderLogo,
  tmdbImageUri,
} from '@/utils/tmdbImage';

export type {
  CastMember,
  EpisodeSummary,
  RichTitleDetails,
  SeasonSummary,
  TmdbImageSize,
} from '@/types/media';
export { getDynamicProviderLogo, tmdbImageUri };

type TmdbProvider = {
  provider_id: number;
  provider_name: string;
  logo_path?: string | null;
};

type TmdbProviderResponse = {
  results: TmdbProvider[];
};

type TmdbTitleWatchProvidersResponse = {
  results?: {
    BR?: {
      flatrate?: TmdbProvider[];
      free?: TmdbProvider[];
      ads?: TmdbProvider[];
    };
  };
};

type TmdbMediaResult = {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  genre_ids?: number[];
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  original_language?: string;
  origin_country?: string[];
};

type TmdbMediaResponse = {
  results: TmdbMediaResult[];
  total_pages: number;
  total_results: number;
};

type TmdbSeasonSummary = {
  season_number?: number | null;
  episode_count?: number | null;
  air_date?: string | null;
  name?: string | null;
  vote_average?: number | null;
  poster_path?: string | null;
};

type TmdbMediaDetails = Partial<TmdbMediaResult> & {
  genres?: { id?: number; name?: string }[] | null;
  runtime?: number | null;
  episode_run_time?: number[] | null;
  last_episode_to_air?: { runtime?: number | null } | null;
  status?: string | null;
  vote_count?: number | null;
  number_of_seasons?: number | null;
  number_of_episodes?: number | null;
  seasons?: TmdbSeasonSummary[] | null;
  videos?: TmdbVideosResponse | null;
  credits?: {
    cast?: {
      id: number;
      name?: string | null;
      character?: string | null;
      profile_path?: string | null;
    }[];
  } | null;
  recommendations?: { results?: TmdbMediaResult[] } | null;
  similar?: { results?: TmdbMediaResult[] } | null;
  release_dates?: {
    results?: {
      iso_3166_1?: string;
      release_dates?: { certification?: string | null }[];
    }[];
  } | null;
  content_ratings?: {
    results?: {
      iso_3166_1?: string;
      rating?: string | null;
    }[];
  } | null;
  'watch/providers'?: TmdbTitleWatchProvidersResponse | null;
};

type MediaEndpoint = 'movie' | 'tv';

export type TmdbCatalogBatchCallback = (titles: MediaTitle[]) => void;

export type CatalogFetchResult = {
  titles: MediaTitle[];
  source: 'tmdb' | 'static-fallback';
  reason?: 'not-configured' | 'error';
  errorMessage?: string;
};

const MAX_PAGES_PER_ENDPOINT = 60;
const REQUEST_CONCURRENCY = 6;
const FIRST_BATCH_EMIT_THRESHOLD = 4;
const PROGRESSIVE_BATCH_EMIT_INTERVAL = 16;
const REQUEST_TIMEOUT_MS = 15000;
const MAX_SEARCH_QUERY_LENGTH = 100;

const isDevRuntime = typeof __DEV__ !== 'undefined' && __DEV__;
const nowMs = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

let devCatalogFetchCount = 0;
let devLastCatalogFetchStartedAt: number | null = null;

export function getDevCatalogMetrics() {
  return {
    fetchCount: devCatalogFetchCount,
    lastFetchStartedAt: devLastCatalogFetchStartedAt,
  };
}

function createAbortError(): Error {
  const err = new Error('Aborted');
  err.name = 'AbortError';
  return err;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function sleepWithSignal(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(createAbortError());
  }
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(createAbortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function raceWithAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) {
    return Promise.reject(createAbortError());
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(createAbortError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

let upstreamUnavailable = false;

export class CatalogBackendNotConfiguredError extends Error {
  constructor(
    message = 'Configure o segredo TMDB_API_TOKEN na Edge Function tmdb-proxy do Supabase para habilitar o catálogo dinâmico.',
  ) {
    super(message);
    this.name = 'CatalogBackendNotConfiguredError';
  }
}

let cachedProvidersPromise: Promise<TmdbProvider[]> | null = null;

const PROVIDER_ALIASES: Record<string, string[]> = {
  'Netflix': ['netflix', 'netflix standard with ads', 'netflix basic with ads'],
  'Disney+': ['disney plus', 'disney'],
  'Max': ['max', 'hbo max'],
  'Prime Video': ['amazon prime video', 'prime video', 'amazon prime video with ads'],
  'Apple TV+': ['apple tv plus', 'apple tv'],
  'Globoplay': ['globoplay'],
  'Crunchyroll': ['crunchyroll', 'crunchyroll amazon channel'],
};

const GENRE_NAMES: Record<MediaEndpoint, Record<number, string>> = {
  movie: {
    12: 'Aventura',
    14: 'Fantasia',
    16: 'Animação',
    18: 'Drama',
    27: 'Terror',
    28: 'Ação',
    35: 'Comédia',
    36: 'História',
    37: 'Faroeste',
    53: 'Suspense',
    80: 'Crime',
    99: 'Documentário',
    878: 'Ficção científica',
    9648: 'Mistério',
    10402: 'Música',
    10749: 'Romance',
    10751: 'Família',
    10752: 'Guerra',
    10770: 'Filme para TV',
  },
  tv: {
    16: 'Animação',
    18: 'Drama',
    35: 'Comédia',
    37: 'Faroeste',
    80: 'Crime',
    99: 'Documentário',
    9648: 'Mistério',
    10751: 'Família',
    10759: 'Ação e aventura',
    10762: 'Infantil',
    10763: 'Notícias',
    10764: 'Reality',
    10765: 'Ficção científica e fantasia',
    10766: 'Novela',
    10767: 'Talk show',
    10768: 'Guerra e política',
  },
};

const COVER_COLORS = ['#596b7c', '#76515e', '#397a91', '#806341', '#59517f', '#48616d'];

export function hasCatalogBackend() {
  return hasSupabaseConfig();
}

function buildStaticFallbackCatalog(): MediaTitle[] {
  return quickSortByRandom(CATALOG);
}

function searchStaticCatalog(encodedQuery: string): MediaTitle[] {
  const matched = CATALOG.filter((title) => matchesSearchQuery(title, encodedQuery));
  return rankTitlesBySearchRelevance(matched, encodedQuery);
}

async function getWatchProviders(signal?: AbortSignal): Promise<TmdbProvider[]> {
  if (signal?.aborted) {
    throw createAbortError();
  }
  if (!cachedProvidersPromise) {
    cachedProvidersPromise = Promise.all([
      request<TmdbProviderResponse>('/watch/providers/movie', { watch_region: 'BR', language: 'pt-BR' }),
      request<TmdbProviderResponse>('/watch/providers/tv', { watch_region: 'BR', language: 'pt-BR' }),
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

function mergeTitleIntoCatalog(
  byId: Map<string, MediaTitle>,
  byNameKey: Map<string, string>,
  incoming: MediaTitle,
) {
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

export async function fetchAllCatalogForProviders(
  providerNames: string[],
  onBatch?: TmdbCatalogBatchCallback,
  signal?: AbortSignal,
): Promise<CatalogFetchResult> {
  if (signal?.aborted) {
    throw createAbortError();
  }
  if (!hasCatalogBackend()) {
    const fallback = buildStaticFallbackCatalog();
    if (!signal?.aborted) {
      onBatch?.(fallback);
    }
    return { titles: fallback, source: 'static-fallback', reason: 'not-configured' };
  }
  upstreamUnavailable = false;
  if (providerNames.length === 0) {
    if (!signal?.aborted) {
      onBatch?.([]);
    }
    return { titles: [], source: 'tmdb' };
  }

  devCatalogFetchCount += 1;
  const runId = devCatalogFetchCount;
  const startedAt = nowMs();
  devLastCatalogFetchStartedAt = startedAt;
  if (isDevRuntime) {
    console.info(
      `[CatalogPerf] fetchAllCatalogForProviders #${runId} start (providers=${providerNames.join('|')})`,
    );
  }

  try {
    const allProviders = await getWatchProviders(signal);
    const resolvedProviders = providerNames
      .map((providerName) => ({
        providerName,
        ids: findProviderIds([providerName], allProviders),
      }))
      .filter((entry) => entry.ids.length > 0);

    if (resolvedProviders.length === 0) {
      throw new Error(`Não encontrei no TMDB os serviços ativos: ${providerNames.join(', ')}.`);
    }

    const catalogById = new Map<string, MediaTitle>();
    const idByNameKey = new Map<string, string>();

    const firstPageDescriptors = resolvedProviders.flatMap(({ providerName, ids }) => {
      const baseParams: Record<string, string> = {
        language: 'pt-BR',
        watch_region: 'BR',
        with_watch_providers: ids.join('|'),
        with_watch_monetization_types: 'flatrate|free|ads',
        sort_by: 'popularity.desc',
      };
      const movieParams: Record<string, string> = {
        ...baseParams,
        region: 'BR',
        include_adult: 'false',
      };

      return [
        { endpoint: 'movie' as const, providerName, params: movieParams },
        { endpoint: 'tv' as const, providerName, params: baseParams },
      ];
    });

    type PageStreamDescriptor = {
      endpoint: MediaEndpoint;
      providerName: string;
      params: Record<string, string>;
      maxPages: number;
    };

    const pageStreams: PageStreamDescriptor[] = [];
    const pendingFirstBatchItems: MediaTitle[] = [];
    let firstPagesSettled = 0;
    let firstPagesSucceeded = 0;
    let firstPageError: unknown = null;
    let firstBatchEmitted = false;
    let hasUnemittedFirstPageItems = false;
    let firstPageIndex = 0;
    const initialEmitTarget = Math.min(FIRST_BATCH_EMIT_THRESHOLD, firstPageDescriptors.length);

    const firstPageWorkers = Array.from(
      { length: Math.min(REQUEST_CONCURRENCY, firstPageDescriptors.length) },
      async () => {
        while (firstPageIndex < firstPageDescriptors.length) {
          if (signal?.aborted) return;
          const descriptor = firstPageDescriptors[firstPageIndex++];
          if (!descriptor) break;

          try {
            const response = await request<TmdbMediaResponse>(
              `/discover/${descriptor.endpoint}`,
              { ...descriptor.params, page: '1' },
              { signal },
            );
            if (signal?.aborted) return;

            firstPagesSucceeded += 1;
            const mapped = response.results.map((item) =>
              mapMedia(item, descriptor.endpoint, [descriptor.providerName]),
            );
            const maxPages = Math.min(response.total_pages, MAX_PAGES_PER_ENDPOINT);
            if (maxPages >= 2) {
              pageStreams.push({
                endpoint: descriptor.endpoint,
                providerName: descriptor.providerName,
                params: descriptor.params,
                maxPages,
              });
            }

            if (!firstBatchEmitted) {
              pendingFirstBatchItems.push(...mapped);
            } else {
              for (const title of quickSortByRandom(mapped)) {
                mergeTitleIntoCatalog(catalogById, idByNameKey, title);
              }
              hasUnemittedFirstPageItems = true;
            }
          } catch (error) {
            if (signal?.aborted || isAbortError(error)) {
              throw createAbortError();
            }
            if (firstPageError === null) {
              firstPageError = error;
            }
          } finally {
            firstPagesSettled += 1;
            if (
              !signal?.aborted &&
              !firstBatchEmitted &&
              firstPagesSettled >= initialEmitTarget &&
              pendingFirstBatchItems.length > 0
            ) {
              firstBatchEmitted = true;
              const itemsToMerge = pendingFirstBatchItems.splice(0, pendingFirstBatchItems.length);
              for (const title of quickSortByRandom(itemsToMerge)) {
                mergeTitleIntoCatalog(catalogById, idByNameKey, title);
              }
              const snapshot = Array.from(catalogById.values());
              onBatch?.(snapshot);
              if (isDevRuntime) {
                console.info(
                  `[CatalogPerf] fetchAllCatalogForProviders #${runId} firstBatch emitted in ${Math.round(nowMs() - startedAt)}ms (titles=${snapshot.length})`,
                );
              }
            }
          }
        }
      },
    );

    await Promise.all(firstPageWorkers);

    if (signal?.aborted) {
      throw createAbortError();
    }

    if (firstPagesSucceeded === 0 && firstPageError !== null) {
      throw firstPageError;
    }

    if (pendingFirstBatchItems.length > 0) {
      for (const title of quickSortByRandom(pendingFirstBatchItems)) {
        mergeTitleIntoCatalog(catalogById, idByNameKey, title);
      }
      pendingFirstBatchItems.length = 0;
      hasUnemittedFirstPageItems = true;
    }

    if (!firstBatchEmitted || hasUnemittedFirstPageItems) {
      const snapshot = Array.from(catalogById.values());
      onBatch?.(snapshot);
      if (!firstBatchEmitted && isDevRuntime) {
        console.info(
          `[CatalogPerf] fetchAllCatalogForProviders #${runId} firstBatch emitted in ${Math.round(nowMs() - startedAt)}ms (titles=${snapshot.length})`,
        );
      }
      firstBatchEmitted = true;
    }

    const highestMaxPage = pageStreams.reduce(
      (max, stream) => Math.max(max, stream.maxPages),
      1,
    );
    const remainingTasks: (() => Promise<MediaTitle[]>)[] = [];
    for (let page = 2; page <= highestMaxPage; page++) {
      for (const stream of pageStreams) {
        if (page > stream.maxPages) continue;
        remainingTasks.push(async () => {
          if (signal?.aborted) {
            throw createAbortError();
          }
          try {
            const pageRes = await request<TmdbMediaResponse>(
              `/discover/${stream.endpoint}`,
              {
                ...stream.params,
                page: String(page),
              },
              { retries: 2, signal },
            );
            return pageRes.results.map((item) =>
              mapMedia(item, stream.endpoint, [stream.providerName]),
            );
          } catch (error) {
            if (signal?.aborted || isAbortError(error)) {
              throw createAbortError();
            }
            return [];
          }
        });
      }
    }

    if (remainingTasks.length > 0) {
      let taskIndex = 0;
      let completedSinceEmit = 0;

      const workers = Array.from(
        { length: Math.min(REQUEST_CONCURRENCY, remainingTasks.length) },
        async () => {
          while (taskIndex < remainingTasks.length) {
            if (signal?.aborted) return;
            const currentTask = remainingTasks[taskIndex++];
            if (!currentTask) break;
            const pageTitles = await currentTask();
            if (signal?.aborted) return;
            for (const title of quickSortByRandom(pageTitles)) {
              mergeTitleIntoCatalog(catalogById, idByNameKey, title);
            }
            completedSinceEmit += 1;
            if (completedSinceEmit >= PROGRESSIVE_BATCH_EMIT_INTERVAL) {
              completedSinceEmit = 0;
              onBatch?.(Array.from(catalogById.values()));
            }
          }
        },
      );

      await Promise.all(workers);
    }

    if (signal?.aborted) {
      throw createAbortError();
    }

    const finalTitles = Array.from(catalogById.values());
    onBatch?.(finalTitles);
    if (isDevRuntime) {
      console.info(
        `[CatalogPerf] fetchAllCatalogForProviders #${runId} finished in ${Math.round(nowMs() - startedAt)}ms (titles=${finalTitles.length}, bootFetchCount=${devCatalogFetchCount})`,
      );
    }
    return { titles: finalTitles, source: 'tmdb' };
  } catch (error) {
    if (signal?.aborted || isAbortError(error)) {
      if (isDevRuntime) {
        console.info(
          `[CatalogPerf] fetchAllCatalogForProviders #${runId} aborted after ${Math.round(nowMs() - startedAt)}ms`,
        );
      }
      throw createAbortError();
    }
    const fallback = buildStaticFallbackCatalog();
    onBatch?.(fallback);
    if (error instanceof CatalogBackendNotConfiguredError) {
      return { titles: fallback, source: 'static-fallback', reason: 'not-configured' };
    }
    return {
      titles: fallback,
      source: 'static-fallback',
      reason: 'error',
      errorMessage: error instanceof Error ? error.message : 'Não foi possível atualizar o catálogo.',
    };
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
  if (!hasCatalogBackend() || upstreamUnavailable) {
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
        preliminaryScore: getSearchRelevanceScore(mapMedia(item, 'movie', fallbackProviders), encodedQuery),
      })),
      ...shows.results.map((item) => ({
        item,
        endpoint: 'tv' as const,
        preliminaryScore: getSearchRelevanceScore(mapMedia(item, 'tv', fallbackProviders), encodedQuery),
      })),
    ].sort((a, b) => b.preliminaryScore - a.preliminaryScore);

    const mappedTitles = await Promise.all(
      rawItems.map(async ({ item, endpoint }, index) => {
        const providers = index < 16 ? await fetchTitleProvidersInBrazil(endpoint, item.id, signal) : [];
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

async function fetchTitleProvidersInBrazil(
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

function matchCanonicalProviderName(rawProviderName: string): string | null {
  const normalizedRaw = normalizeSearchText(rawProviderName);
  for (const [canonicalName, aliases] of Object.entries(PROVIDER_ALIASES)) {
    if (aliases.some((alias) => normalizeSearchText(alias) === normalizedRaw)) {
      return canonicalName;
    }
  }
  return null;
}

async function request<T>(
  endpoint: string,
  params: Record<string, string>,
  options: { retries?: number; signal?: AbortSignal } = {},
): Promise<T> {
  const { retries = 3, signal } = options;
  if (signal?.aborted) {
    throw createAbortError();
  }

  const baseUrl = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!baseUrl || !anonKey) {
    throw new CatalogBackendNotConfiguredError();
  }

  const retryRequest = async (delayMs: number) => {
    await sleepWithSignal(delayMs, signal);
    return request<T>(endpoint, params, { retries: retries - 1, signal });
  };

  let response: Response;
  try {
    response = await fetchWithTimeout(
      `${baseUrl}/functions/v1/tmdb-proxy`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          apikey: anonKey,
        },
        body: JSON.stringify({ endpoint, params }),
        signal,
      },
      REQUEST_TIMEOUT_MS,
    );
  } catch (error) {
    if (signal?.aborted || isAbortError(error)) {
      throw createAbortError();
    }
    if (retries > 0) {
      return retryRequest(500 * (4 - Math.min(retries, 3)));
    }
    throw error;
  }

  if (signal?.aborted) {
    throw createAbortError();
  }

  if (response.status === 503) {
    upstreamUnavailable = true;
    throw new CatalogBackendNotConfiguredError();
  }

  if ((response.status === 429 || response.status >= 500) && retries > 0) {
    const retryAfterHeader = response.status === 429 ? response.headers.get('Retry-After') : null;
    const retryAfterSec = retryAfterHeader ? Number(retryAfterHeader) : Number.NaN;
    const delayMs =
      Number.isFinite(retryAfterSec) && retryAfterSec > 0
        ? Math.min(retryAfterSec * 1000, 3000)
        : 500 * (4 - Math.min(retries, 3));
    return retryRequest(delayMs);
  }

  if (!response.ok) {
    throw new Error(`Serviço de catálogo respondeu com erro ${response.status}. Tente novamente.`);
  }
  return response.json() as Promise<T>;
}

function findProviderIds(activeNames: string[], providers: TmdbProvider[]) {
  const providerNames = new Set(activeNames.flatMap((name) => PROVIDER_ALIASES[name] ?? [name]).map(normalizeSearchText));
  return Array.from(new Set(
    providers
      .filter((provider) => providerNames.has(normalizeSearchText(provider.provider_name)))
      .map((provider) => provider.provider_id),
  ));
}

const resolvedDurationCache = new Map<string, string>();
const pendingDurationCache = new Map<string, Promise<string>>();
const resolvedTotalEpisodesCache = new Map<string, number>();

function cacheTvTotalEpisodes(
  titleId: string,
  details: Pick<TmdbMediaDetails, 'seasons' | 'number_of_episodes'>,
  regularSeasons = extractRegularTmdbSeasons(details),
): number | null {
  const fromSeasons = regularSeasons.reduce((acc, s) => acc + Math.max(0, s.episode_count ?? 0), 0);
  const total = fromSeasons > 0 ? fromSeasons : (details.number_of_episodes ?? 0);
  if (total > 0) {
    resolvedTotalEpisodesCache.set(titleId, total);
    return total;
  }
  return null;
}

export function getCachedTitleTotalEpisodes(titleId: string): number | null {
  return resolvedTotalEpisodesCache.get(titleId) ?? null;
}

function formatMovieRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours <= 0) return `${remainingMinutes}min`;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}min`;
}

function formatSeasonsCount(seasons: number): string {
  return seasons === 1 ? '1 temporada' : `${seasons} temporadas`;
}

function extractRegularTmdbSeasons(details: Pick<TmdbMediaDetails, 'seasons'>): TmdbSeasonSummary[] {
  return (details.seasons ?? [])
    .filter(
      (season) =>
        typeof season.season_number === 'number' &&
        season.season_number > 0 &&
        (season.episode_count ?? 0) > 0,
    )
    .sort((a, b) => (a.season_number ?? 0) - (b.season_number ?? 0));
}

function resolveTvDuration(
  title: MediaTitle,
  details: Pick<TmdbMediaDetails, 'seasons' | 'number_of_seasons' | 'number_of_episodes'>,
  regularSeasons = extractRegularTmdbSeasons(details),
): string {
  const seasonCount =
    regularSeasons.length > 0
      ? regularSeasons.length
      : details.number_of_seasons && details.number_of_seasons > 0
        ? details.number_of_seasons
        : 0;

  if (seasonCount > 0) {
    return formatSeasonsCount(seasonCount);
  }
  if (details.number_of_episodes && details.number_of_episodes > 0) {
    return details.number_of_episodes === 1
      ? '1 episódio'
      : `${details.number_of_episodes} episódios`;
  }
  return title.duration;
}

export function getCachedTitleDuration(title: MediaTitle): string {
  return resolvedDurationCache.get(title.id) ?? title.duration;
}

export async function fetchTitleDuration(
  title: MediaTitle,
  signal?: AbortSignal,
): Promise<string> {
  if (signal?.aborted) {
    throw createAbortError();
  }
  const cached = resolvedDurationCache.get(title.id);
  if (cached) {
    return cached;
  }

  const target = resolveTmdbEndpointAndId(title.id);
  if (!target || !hasCatalogBackend() || upstreamUnavailable) {
    return title.duration;
  }

  const existingPromise = pendingDurationCache.get(title.id);
  if (existingPromise) {
    return raceWithAbort(existingPromise, signal);
  }

  const promise = request<TmdbMediaDetails>(`/${target.endpoint}/${target.tmdbId}`, {
    language: 'pt-BR',
  })
    .then((details) => {
      let formatted = title.duration;
      if (target.endpoint === 'movie') {
        if (details.runtime && details.runtime > 0) {
          formatted = formatMovieRuntime(details.runtime);
        }
      } else {
        const regularSeasons = extractRegularTmdbSeasons(details);
        cacheTvTotalEpisodes(title.id, details, regularSeasons);
        formatted = resolveTvDuration(title, details, regularSeasons);
      }
      if (formatted) {
        resolvedDurationCache.set(title.id, formatted);
      }
      return formatted;
    })
    .catch(() => title.duration)
    .finally(() => {
      pendingDurationCache.delete(title.id);
    });

  pendingDurationCache.set(title.id, promise);
  return raceWithAbort(promise, signal);
}

type TmdbVideoItem = {
  key?: string | null;
  site?: string | null;
  type?: string | null;
  official?: boolean | null;
};

type TmdbVideosResponse = {
  results?: TmdbVideoItem[];
};

const resolvedTrailerCache = new Map<string, string | null>();
const pendingTrailerCache = new Map<string, Promise<string | null>>();
const SAFE_YOUTUBE_KEY_REGEX = /^[a-zA-Z0-9_-]{6,32}$/;

function resolveTmdbEndpointAndId(titleId: string): { endpoint: MediaEndpoint; tmdbId: string } | null {
  const match = /^tmdb-(movie|tv)-(\d+)$/.exec(titleId);
  if (match) {
    return { endpoint: match[1] as MediaEndpoint, tmdbId: match[2]! };
  }
  const staticArtwork = TMDB_ARTWORK[titleId];
  if (staticArtwork) {
    return { endpoint: staticArtwork.type, tmdbId: String(staticArtwork.tmdbId) };
  }
  return null;
}

function pickYoutubeTrailerKey(videos: readonly TmdbVideoItem[] | undefined): string | null {
  if (!Array.isArray(videos) || videos.length === 0) return null;
  const youtubeVideos = videos.filter(
    (video) => video.site === 'YouTube' && typeof video.key === 'string' && SAFE_YOUTUBE_KEY_REGEX.test(video.key),
  );
  if (youtubeVideos.length === 0) return null;

  const prioritized =
    youtubeVideos.find((v) => v.type === 'Trailer' && v.official) ??
    youtubeVideos.find((v) => v.type === 'Trailer') ??
    youtubeVideos.find((v) => v.type === 'Teaser' && v.official) ??
    youtubeVideos.find((v) => v.type === 'Teaser') ??
    youtubeVideos[0];

  return prioritized?.key ?? null;
}

export function getCachedTitleTrailerUrl(title: MediaTitle): string | null {
  return resolvedTrailerCache.get(title.id) ?? null;
}

export async function fetchTitleTrailerUrl(
  title: MediaTitle,
  signal?: AbortSignal,
): Promise<string | null> {
  if (signal?.aborted) {
    throw createAbortError();
  }
  if (resolvedTrailerCache.has(title.id)) {
    return resolvedTrailerCache.get(title.id) ?? null;
  }

  const target = resolveTmdbEndpointAndId(title.id);
  if (!target || !hasCatalogBackend() || upstreamUnavailable) {
    return null;
  }

  const existingPromise = pendingTrailerCache.get(title.id);
  if (existingPromise) {
    return raceWithAbort(existingPromise, signal);
  }

  const promise = (async () => {
    const ptRes = await request<TmdbVideosResponse>(`/${target.endpoint}/${target.tmdbId}/videos`, {
      language: 'pt-BR',
    }).catch(() => null);
    let videoKey = pickYoutubeTrailerKey(ptRes?.results);

    if (!videoKey) {
      const enRes = await request<TmdbVideosResponse>(`/${target.endpoint}/${target.tmdbId}/videos`, {
        language: 'en-US',
      }).catch(() => null);
      videoKey = pickYoutubeTrailerKey(enRes?.results);
    }

    const url = videoKey ? `https://www.youtube.com/watch?v=${videoKey}` : null;
    resolvedTrailerCache.set(title.id, url);
    return url;
  })()
    .catch(() => null)
    .finally(() => {
      pendingTrailerCache.delete(title.id);
    });

  pendingTrailerCache.set(title.id, promise);
  return raceWithAbort(promise, signal);
}

const richDetailsCache = new Map<string, RichTitleDetails>();
const pendingRichDetailsCache = new Map<string, Promise<RichTitleDetails | null>>();
const seasonEpisodesCache = new Map<string, EpisodeSummary[]>();
const pendingSeasonEpisodesCache = new Map<string, Promise<EpisodeSummary[]>>();
const relatedTitlesById = new Map<string, MediaTitle>();

const TMDB_STATUS_LABELS: Record<string, string> = {
  'Returning Series': 'Em exibição',
  Ended: 'Finalizada',
  Canceled: 'Cancelada',
  'In Production': 'Em produção',
  Planned: 'Planejada',
  Pilot: 'Piloto',
  Released: 'Lançado',
};

function normalizeBrCertification(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase() === 'livre') return 'L';
  return trimmed.slice(0, 6);
}

function extractBrCertification(endpoint: MediaEndpoint, details: TmdbMediaDetails): string | null {
  if (endpoint === 'movie') {
    const brEntry = details.release_dates?.results?.find((entry) => entry.iso_3166_1 === 'BR');
    const cert = brEntry?.release_dates?.find((item) => Boolean(item.certification?.trim()))?.certification;
    return normalizeBrCertification(cert);
  }
  const brRating = details.content_ratings?.results?.find((entry) => entry.iso_3166_1 === 'BR')?.rating;
  return normalizeBrCertification(brRating);
}

function extractProvidersFromDetails(details: TmdbMediaDetails): string[] | null {
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

const pendingTitleByIdCache = new Map<string, Promise<MediaTitle | null>>();

export function findCachedRelatedTitle(id: string): MediaTitle | undefined {
  return relatedTitlesById.get(id);
}

export async function fetchTitleById(
  titleId: string,
  signal?: AbortSignal,
): Promise<MediaTitle | null> {
  if (signal?.aborted) {
    throw createAbortError();
  }
  const cached = relatedTitlesById.get(titleId);
  if (cached) return cached;

  const staticMatch = CATALOG.find((item) => item.id === titleId) ?? null;
  const target = resolveTmdbEndpointAndId(titleId);
  if (!target || !hasCatalogBackend() || upstreamUnavailable) {
    return staticMatch;
  }

  const pending = pendingTitleByIdCache.get(titleId);
  if (pending) return raceWithAbort(pending, signal);

  const promise = request<TmdbMediaDetails>(`/${target.endpoint}/${target.tmdbId}`, {
    language: 'pt-BR',
    append_to_response: 'watch/providers',
  })
    .then((details) => {
      if (target.endpoint === 'movie') {
        if (details.runtime && details.runtime > 0) {
          resolvedDurationCache.set(titleId, formatMovieRuntime(details.runtime));
        }
      } else {
        const regularSeasons = extractRegularTmdbSeasons(details);
        cacheTvTotalEpisodes(titleId, details, regularSeasons);
        const formatted = resolveTvDuration({ duration: '' } as MediaTitle, details, regularSeasons);
        if (formatted) {
          resolvedDurationCache.set(titleId, formatted);
        }
      }
      const genreIds = (details.genres ?? [])
        .map((g) => g.id)
        .filter((id): id is number => typeof id === 'number');
      const providers = extractProvidersFromDetails(details) ?? [];
      const mapped = mapMedia(
        { ...details, id: details.id ?? Number(target.tmdbId), genre_ids: genreIds },
        target.endpoint,
        providers,
      );
      const resolved = mapped.id === titleId ? mapped : { ...mapped, id: titleId };
      relatedTitlesById.set(titleId, resolved);
      return resolved;
    })
    .catch(() => staticMatch)
    .finally(() => {
      pendingTitleByIdCache.delete(titleId);
    });

  pendingTitleByIdCache.set(titleId, promise);
  return raceWithAbort(promise, signal);
}

export function getCachedRichTitleDetails(titleId: string): RichTitleDetails | null {
  return richDetailsCache.get(titleId) ?? null;
}

export async function fetchRichTitleDetails(
  title: MediaTitle,
  options?: { throwOnError?: boolean; signal?: AbortSignal },
): Promise<RichTitleDetails | null> {
  if (options?.signal?.aborted) {
    throw createAbortError();
  }
  const cached = richDetailsCache.get(title.id);
  if (cached) return cached;

  const target = resolveTmdbEndpointAndId(title.id);
  if (!target || !hasCatalogBackend() || upstreamUnavailable) {
    return null;
  }

  let pending = pendingRichDetailsCache.get(title.id);
  if (!pending) {
    pending = (async () => {
      const append =
        target.endpoint === 'tv'
          ? 'videos,credits,recommendations,similar,content_ratings,watch/providers'
          : 'videos,credits,recommendations,similar,release_dates,watch/providers';

      const details = await request<TmdbMediaDetails>(`/${target.endpoint}/${target.tmdbId}`, {
        language: 'pt-BR',
        append_to_response: append,
      });

      const regularSeasons =
        target.endpoint === 'tv' ? extractRegularTmdbSeasons(details) : [];

      let duration = title.duration;
      if (target.endpoint === 'movie') {
        if (details.runtime && details.runtime > 0) {
          duration = formatMovieRuntime(details.runtime);
        }
      } else {
        cacheTvTotalEpisodes(title.id, details, regularSeasons);
        duration = resolveTvDuration(title, details, regularSeasons);
      }
      if (duration) {
        resolvedDurationCache.set(title.id, duration);
      }

      const rawEpRuntime =
        details.episode_run_time?.find((val) => typeof val === 'number' && val > 0) ??
        (details.last_episode_to_air?.runtime && details.last_episode_to_air.runtime > 0
          ? details.last_episode_to_air.runtime
          : null);
      const episodeDuration = rawEpRuntime ? `${rawEpRuntime}min/ep` : null;

      const videoKey = pickYoutubeTrailerKey(details.videos?.results);
      let trailerUrl = videoKey ? `https://www.youtube.com/watch?v=${videoKey}` : null;
      if (trailerUrl) {
        resolvedTrailerCache.set(title.id, trailerUrl);
      } else {
        trailerUrl = await fetchTitleTrailerUrl(title);
      }

      const cast: CastMember[] = (details.credits?.cast ?? [])
        .filter((member) => Boolean(member.name?.trim()))
        .slice(0, 14)
        .map((member) => ({
          id: member.id,
          name: member.name!.trim(),
          character: member.character?.trim() || '',
          profilePath: sanitizeTmdbPath(member.profile_path),
        }));

      const seasons: SeasonSummary[] = regularSeasons.map((season) => ({
        seasonNumber: season.season_number!,
        name: season.name?.trim() || `Temporada ${season.season_number}`,
        episodeCount: season.episode_count ?? 0,
        voteAverage:
          typeof season.vote_average === 'number' && season.vote_average > 0
            ? Number(season.vote_average.toFixed(1))
            : null,
        airDate: season.air_date ?? null,
        posterPath: sanitizeTmdbPath(season.poster_path),
      }));

      const rawRelated = [
        ...(details.recommendations?.results ?? []),
        ...(details.similar?.results ?? []),
      ];
      const seenRelatedIds = new Set<number>([Number(target.tmdbId)]);
      const similarTitles: MediaTitle[] = [];
      for (const item of rawRelated) {
        if (!item?.id || seenRelatedIds.has(item.id)) continue;
        seenRelatedIds.add(item.id);
        const mapped = mapMedia(item, target.endpoint, []);
        relatedTitlesById.set(mapped.id, mapped);
        similarTitles.push(mapped);
        if (similarTitles.length >= 14) break;
      }

      const rich: RichTitleDetails = {
        duration,
        episodeDuration,
        statusLabel: details.status ? (TMDB_STATUS_LABELS[details.status] ?? null) : null,
        certification: extractBrCertification(target.endpoint, details),
        voteCount:
          typeof details.vote_count === 'number' && details.vote_count > 0 ? details.vote_count : null,
        trailerUrl,
        providers: extractProvidersFromDetails(details),
        cast,
        seasons,
        similarTitles,
      };

      richDetailsCache.set(title.id, rich);
      return rich;
    })().finally(() => {
      pendingRichDetailsCache.delete(title.id);
    });

    pendingRichDetailsCache.set(title.id, pending);
  }

  if (options?.throwOnError) {
    return raceWithAbort(pending, options.signal);
  }
  return raceWithAbort(pending.catch(() => null), options?.signal);
}

type TmdbSeasonDetailsResponse = {
  episodes?: {
    episode_number?: number | null;
    name?: string | null;
    runtime?: number | null;
    air_date?: string | null;
    vote_average?: number | null;
  }[];
};

export function getCachedTvSeasonEpisodes(titleId: string, seasonNumber: number): EpisodeSummary[] | null {
  return seasonEpisodesCache.get(`${titleId}:s${seasonNumber}`) ?? null;
}

export async function fetchTvSeasonEpisodes(
  titleId: string,
  seasonNumber: number,
  options?: { throwOnError?: boolean; signal?: AbortSignal },
): Promise<EpisodeSummary[]> {
  if (options?.signal?.aborted) {
    throw createAbortError();
  }
  const cacheKey = `${titleId}:s${seasonNumber}`;
  const cached = seasonEpisodesCache.get(cacheKey);
  if (cached) return cached;

  const target = resolveTmdbEndpointAndId(titleId);
  if (!target || target.endpoint !== 'tv' || !hasCatalogBackend() || upstreamUnavailable) {
    return [];
  }

  let pending = pendingSeasonEpisodesCache.get(cacheKey);
  if (!pending) {
    pending = request<TmdbSeasonDetailsResponse>(
      `/tv/${target.tmdbId}/season/${seasonNumber}`,
      { language: 'pt-BR' },
    )
      .then((res) => {
        const episodes: EpisodeSummary[] = (res.episodes ?? [])
          .filter((ep) => typeof ep.episode_number === 'number' && ep.episode_number > 0)
          .map((ep) => ({
            episodeNumber: ep.episode_number!,
            name: ep.name?.trim() || `Episódio ${ep.episode_number}`,
            runtime: typeof ep.runtime === 'number' && ep.runtime > 0 ? ep.runtime : null,
            airDate: ep.air_date ?? null,
            voteAverage:
              typeof ep.vote_average === 'number' && ep.vote_average > 0
                ? Number(ep.vote_average.toFixed(1))
                : null,
          }));
        seasonEpisodesCache.set(cacheKey, episodes);
        return episodes;
      })
      .finally(() => {
        pendingSeasonEpisodesCache.delete(cacheKey);
      });

    pendingSeasonEpisodesCache.set(cacheKey, pending);
  }

  if (options?.throwOnError) {
    return raceWithAbort(pending, options.signal);
  }
  return raceWithAbort(pending.catch(() => []), options?.signal);
}

function mapMedia(item: TmdbMediaResult, endpoint: MediaEndpoint, services: string[]): MediaTitle {
  const genres = (item.genre_ids ?? [])
    .map((genreId) => GENRE_NAMES[endpoint][genreId])
    .filter((genre): genre is string => Boolean(genre));
  const isAnime = genres.includes('Animação')
    && (item.original_language === 'ja' || item.origin_country?.includes('JP') === true || services.includes('Crunchyroll'));
  const title = item.title ?? item.name ?? 'Título sem nome';
  const releaseDate = item.release_date ?? item.first_air_date ?? '';
  const icon: MediaIcon = endpoint === 'movie' ? 'movie' : 'live-tv';
  const rating = item.vote_average ?? 0;
  const resolvedServices = services.length > 0 ? services : ['Netflix'];
  const id = `tmdb-${endpoint}-${item.id}`;
  const duration = resolvedDurationCache.get(id) ?? '';

  return {
    id,
    title,
    kind: isAnime ? 'Anime' : endpoint === 'movie' ? 'Filme' : 'Série',
    year: Number(releaseDate.slice(0, 4)) || 0,
    duration,
    genres: genres.length ? genres : ['Outros'],
    service: resolvedServices[0]!,
    services: resolvedServices,
    imdbRating: rating > 0 ? rating.toFixed(1).replace('.', ',') : '—',
    metacriticScore: null,
    synopsis: item.overview?.trim() || 'Sinopse indisponível no TMDB.',
    color: COVER_COLORS[item.id % COVER_COLORS.length] ?? COVER_COLORS[0]!,
    icon,
    ratingSource: 'TMDB',
    catalogSource: 'tmdb',
    tmdbPosterPath: item.poster_path,
    tmdbBackdropPath: item.backdrop_path,
    originalTitle: item.original_title ?? item.original_name,
    popularity: item.popularity ?? 0,
    voteCount: item.vote_count ?? 0,
  };
}
