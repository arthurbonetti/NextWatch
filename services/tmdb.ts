import {
  getSearchRelevanceScore,
  normalizeSearchText,
  rankTitlesBySearchRelevance,
  sanitizeTmdbPath,
  type MediaIcon,
  type MediaTitle,
} from '@/constants/catalog';
import { TMDB_ARTWORK } from '@/constants/tmdb-artwork';
import { getValidAccessToken, hasSupabaseConfig, supabaseRestFetch } from '@/services/authApi';
import { quickSortByRandom } from '@/utils/quickSort';

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

const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';
const MAX_PAGES_PER_ENDPOINT = 60;
const REQUEST_CONCURRENCY = 8;
const REQUEST_TIMEOUT_MS = 15000;
const MAX_SEARCH_QUERY_LENGTH = 100;

let upstreamUnavailable = false;

export class CatalogBackendNotConfiguredError extends Error {
  constructor(
    message = 'Configure o segredo TMDB_API_TOKEN na Edge Function tmdb-proxy do Supabase para habilitar o catálogo dinâmico.',
  ) {
    super(message);
    this.name = 'CatalogBackendNotConfiguredError';
  }
}

export type TmdbImageSize = 'w92' | 'w154' | 'w342' | 'w780';

let cachedProvidersPromise: Promise<TmdbProvider[]> | null = null;
const dynamicProviderLogos = new Map<string, string>();

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

export function getDynamicProviderLogo(providerName: string): string | undefined {
  return dynamicProviderLogos.get(providerName);
}

async function getWatchProviders(): Promise<TmdbProvider[]> {
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
          if (canonical && !dynamicProviderLogos.has(canonical)) {
            dynamicProviderLogos.set(canonical, provider.logo_path);
          }
        }
        return list;
      })
      .catch((error) => {
        cachedProvidersPromise = null;
        throw error;
      });
  }
  return cachedProvidersPromise;
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
  shouldAbort?: () => boolean,
): Promise<void> {
  if (!hasCatalogBackend()) {
    throw new CatalogBackendNotConfiguredError();
  }
  upstreamUnavailable = false;
  if (providerNames.length === 0) {
    onBatch?.([]);
    return;
  }

  const allProviders = await getWatchProviders();
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
  const remainingTasks: (() => Promise<MediaTitle[]>)[] = [];

  const firstPages = await Promise.all(
    resolvedProviders.flatMap(({ providerName, ids }) => {
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
        request<TmdbMediaResponse>('/discover/movie', { ...movieParams, page: '1' }).then((res) => ({
          endpoint: 'movie' as const,
          providerName,
          params: movieParams,
          response: res,
        })),
        request<TmdbMediaResponse>('/discover/tv', { ...baseParams, page: '1' }).then((res) => ({
          endpoint: 'tv' as const,
          providerName,
          params: baseParams,
          response: res,
        })),
      ];
    }),
  );

  if (shouldAbort?.()) return;

  const firstBatchItems: MediaTitle[] = [];
  for (const { endpoint, providerName, params, response } of firstPages) {
    for (const item of response.results) {
      firstBatchItems.push(mapMedia(item, endpoint, [providerName]));
    }
    const maxPages = Math.min(response.total_pages, MAX_PAGES_PER_ENDPOINT);
    for (let page = 2; page <= maxPages; page++) {
      remainingTasks.push(async () => {
        try {
          const pageRes = await request<TmdbMediaResponse>(`/discover/${endpoint}`, {
            ...params,
            page: String(page),
          });
          return pageRes.results.map((item) => mapMedia(item, endpoint, [providerName]));
        } catch {
          return [];
        }
      });
    }
  }

  for (const title of quickSortByRandom(firstBatchItems)) {
    mergeTitleIntoCatalog(catalogById, idByNameKey, title);
  }

  onBatch?.(Array.from(catalogById.values()));

  if (remainingTasks.length > 0) {
    let taskIndex = 0;
    let completedSinceEmit = 0;

    const workers = Array.from({ length: Math.min(REQUEST_CONCURRENCY, remainingTasks.length) }, async () => {
      while (taskIndex < remainingTasks.length) {
        if (shouldAbort?.()) return;
        const currentTask = remainingTasks[taskIndex++];
        if (!currentTask) break;
        const pageTitles = await currentTask();
        if (shouldAbort?.()) return;
        for (const title of quickSortByRandom(pageTitles)) {
          mergeTitleIntoCatalog(catalogById, idByNameKey, title);
        }
        completedSinceEmit += 1;
        if (completedSinceEmit >= 20) {
          completedSinceEmit = 0;
          onBatch?.(Array.from(catalogById.values()));
        }
      }
    });

    await Promise.all(workers);
  }

  if (shouldAbort?.()) return;

  onBatch?.(Array.from(catalogById.values()));
}

export async function searchCatalogTitles(query: string, fallbackProviders: string[] = []): Promise<MediaTitle[]> {
  const encodedQuery = query.trim().slice(0, MAX_SEARCH_QUERY_LENGTH);
  if (!hasCatalogBackend() || encodedQuery.length < 2) return [];
  upstreamUnavailable = false;

  const [movies, shows] = await Promise.all([
    request<TmdbMediaResponse>('/search/movie', {
      language: 'pt-BR',
      region: 'BR',
      query: encodedQuery,
      include_adult: 'false',
      page: '1',
    }),
    request<TmdbMediaResponse>('/search/tv', {
      language: 'pt-BR',
      query: encodedQuery,
      include_adult: 'false',
      page: '1',
    }),
  ]);

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
      const providers = index < 16 ? await fetchTitleProvidersInBrazil(endpoint, item.id) : [];
      const services = providers.length > 0 ? providers : fallbackProviders;
      return mapMedia(item, endpoint, services);
    }),
  );

  const deduplicated = new Map<string, MediaTitle>();
  const idByNameKey = new Map<string, string>();
  for (const title of mappedTitles) {
    mergeTitleIntoCatalog(deduplicated, idByNameKey, title);
  }
  return rankTitlesBySearchRelevance(Array.from(deduplicated.values()), encodedQuery);
}

async function fetchTitleProvidersInBrazil(endpoint: MediaEndpoint, tmdbId: number): Promise<string[]> {
  try {
    const response = await request<TmdbTitleWatchProvidersResponse>(`/${endpoint}/${tmdbId}/watch/providers`, {});
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
  } catch {
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

export function tmdbImageUri(path: string | null | undefined, size: TmdbImageSize): string | null {
  const safePath = sanitizeTmdbPath(path);
  return safePath ? `${IMAGE_BASE_URL}/${size}${safePath}` : null;
}

async function request<T>(endpoint: string, params: Record<string, string>, retries = 3): Promise<T> {
  if (!hasCatalogBackend()) {
    throw new CatalogBackendNotConfiguredError();
  }

  const retryRequest = async () => {
    await new Promise((resolve) => setTimeout(resolve, 500 * (4 - retries)));
    return request<T>(endpoint, params, retries - 1);
  };

  let response: Response | null;
  try {
    response = await supabaseRestFetch(
      '/functions/v1/tmdb-proxy',
      {
        method: 'POST',
        body: JSON.stringify({ endpoint, params }),
      },
      undefined,
      REQUEST_TIMEOUT_MS,
    );
  } catch (error) {
    if (retries > 0) return retryRequest();
    throw error;
  }

  if (!response) {
    throw new Error('Faça login para consultar o catálogo.');
  }

  if (response.status === 503) {
    upstreamUnavailable = true;
    throw new CatalogBackendNotConfiguredError();
  }

  if ((response.status === 429 || response.status >= 500) && retries > 0) {
    return retryRequest();
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

export async function fetchTitleDuration(title: MediaTitle): Promise<string> {
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
    return existingPromise;
  }

  const promise = getValidAccessToken()
    .then((validToken) => {
      if (!validToken) return title.duration;

      return request<TmdbMediaDetails>(`/${target.endpoint}/${target.tmdbId}`, {
        language: 'pt-BR',
      }).then((details) => {
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
      });
    })
    .catch(() => title.duration)
    .finally(() => {
      pendingDurationCache.delete(title.id);
    });

  pendingDurationCache.set(title.id, promise);
  return promise;
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

export async function fetchTitleTrailerUrl(title: MediaTitle): Promise<string | null> {
  if (resolvedTrailerCache.has(title.id)) {
    return resolvedTrailerCache.get(title.id) ?? null;
  }

  const target = resolveTmdbEndpointAndId(title.id);
  if (!target || !hasCatalogBackend() || upstreamUnavailable) {
    return null;
  }

  const existingPromise = pendingTrailerCache.get(title.id);
  if (existingPromise) {
    return existingPromise;
  }

  const promise = getValidAccessToken()
    .then(async (validToken) => {
      if (!validToken) return null;

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
    })
    .catch(() => null)
    .finally(() => {
      pendingTrailerCache.delete(title.id);
    });

  pendingTrailerCache.set(title.id, promise);
  return promise;
}

export type CastMember = {
  id: number;
  name: string;
  character: string;
  profilePath: string | null;
};

export type SeasonSummary = {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  voteAverage: number | null;
  airDate: string | null;
  posterPath: string | null;
};

export type EpisodeSummary = {
  episodeNumber: number;
  name: string;
  runtime: number | null;
  airDate: string | null;
  voteAverage: number | null;
};

export type RichTitleDetails = {
  duration: string;
  episodeDuration: string | null;
  statusLabel: string | null;
  certification: string | null;
  voteCount: number | null;
  trailerUrl: string | null;
  providers: string[] | null;
  cast: CastMember[];
  seasons: SeasonSummary[];
  similarTitles: MediaTitle[];
};

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

export async function fetchTitleById(titleId: string): Promise<MediaTitle | null> {
  const cached = relatedTitlesById.get(titleId);
  if (cached) return cached;

  const target = resolveTmdbEndpointAndId(titleId);
  if (!target || !hasCatalogBackend() || upstreamUnavailable) {
    return null;
  }

  const pending = pendingTitleByIdCache.get(titleId);
  if (pending) return pending;

  const promise = getValidAccessToken()
    .then(async (validToken) => {
      if (!validToken) return null;
      const details = await request<TmdbMediaDetails>(`/${target.endpoint}/${target.tmdbId}`, {
        language: 'pt-BR',
        append_to_response: 'watch/providers',
      });
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
    .catch(() => null)
    .finally(() => {
      pendingTitleByIdCache.delete(titleId);
    });

  pendingTitleByIdCache.set(titleId, promise);
  return promise;
}

export function getCachedRichTitleDetails(titleId: string): RichTitleDetails | null {
  return richDetailsCache.get(titleId) ?? null;
}

export async function fetchRichTitleDetails(title: MediaTitle): Promise<RichTitleDetails | null> {
  const cached = richDetailsCache.get(title.id);
  if (cached) return cached;

  const target = resolveTmdbEndpointAndId(title.id);
  if (!target || !hasCatalogBackend() || upstreamUnavailable) {
    return null;
  }

  const pending = pendingRichDetailsCache.get(title.id);
  if (pending) return pending;

  const promise = getValidAccessToken()
    .then(async (validToken) => {
      if (!validToken) return null;

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

      let videoKey = pickYoutubeTrailerKey(details.videos?.results);
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
    })
    .catch(() => null)
    .finally(() => {
      pendingRichDetailsCache.delete(title.id);
    });

  pendingRichDetailsCache.set(title.id, promise);
  return promise;
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
): Promise<EpisodeSummary[]> {
  const cacheKey = `${titleId}:s${seasonNumber}`;
  const cached = seasonEpisodesCache.get(cacheKey);
  if (cached) return cached;

  const target = resolveTmdbEndpointAndId(titleId);
  if (!target || target.endpoint !== 'tv' || !hasCatalogBackend() || upstreamUnavailable) {
    return [];
  }

  const pending = pendingSeasonEpisodesCache.get(cacheKey);
  if (pending) return pending;

  const promise = getValidAccessToken()
    .then(async (validToken) => {
      if (!validToken) return [];
      const res = await request<TmdbSeasonDetailsResponse>(
        `/tv/${target.tmdbId}/season/${seasonNumber}`,
        { language: 'pt-BR' },
      );
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
    .catch(() => [])
    .finally(() => {
      pendingSeasonEpisodesCache.delete(cacheKey);
    });

  pendingSeasonEpisodesCache.set(cacheKey, promise);
  return promise;
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
