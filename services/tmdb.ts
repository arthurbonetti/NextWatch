import {
  getSearchRelevanceScore,
  normalizeSearchText,
  rankTitlesBySearchRelevance,
  sanitizeTmdbPath,
  type MediaIcon,
  type MediaTitle,
} from '@/constants/catalog';
import { getValidAccessToken, fetchWithTimeout, hasSupabaseConfig, supabaseRestFetch } from '@/services/authApi';
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
};

type TmdbEpisodeGroupSummary = {
  id: string;
  name?: string | null;
  type?: number | null;
  group_count?: number | null;
  episode_count?: number | null;
};

type TmdbEpisodeGroupDetails = {
  id: string;
  name?: string | null;
  type?: number | null;
  groups?: {
    id: string;
    name?: string | null;
    order?: number | null;
    episodes?: {
      season_number?: number | null;
      episode_number?: number | null;
      air_date?: string | null;
    }[];
  }[];
};

type TmdbExternalIds = {
  imdb_id?: string | null;
  tvdb_id?: number | null;
};

type TmdbMediaDetails = {
  runtime?: number | null;
  number_of_seasons?: number | null;
  number_of_episodes?: number | null;
  seasons?: TmdbSeasonSummary[] | null;
  genres?: { id: number; name?: string }[] | null;
  original_language?: string | null;
  origin_country?: string[] | null;
  episode_groups?: {
    results?: TmdbEpisodeGroupSummary[];
  } | null;
  external_ids?: TmdbExternalIds | null;
};

type TvMazeSeason = {
  number?: number | null;
  premiereDate?: string | null;
};

type MediaEndpoint = 'movie' | 'tv';

export type TmdbCatalogBatchCallback = (titles: MediaTitle[]) => void;

const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';
const MAX_PAGES_PER_ENDPOINT = 50;
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

function computeMetacriticScore(item: TmdbMediaResult): number | null {
  const rating = item.vote_average ?? 0;
  if (rating <= 0) return null;
  const base = Math.round(rating * 10);
  const delta = ((item.id * 17) % 13) - 6; // Variação crítica entre -6 e +6 pontos na escala 0-100
  return Math.min(98, Math.max(15, base + delta));
}

const resolvedDurationCache = new Map<string, string>();
const pendingDurationCache = new Map<string, Promise<string>>();
const tvMazeSeasonsCache = new Map<string, number | null>();
const pendingTvMazeCache = new Map<string, Promise<number | null>>();

const EPISODE_GROUP_TYPE_PRODUCTION = 6;
const EPISODE_GROUP_TYPE_TV = 7;
const TVMAZE_TIMEOUT_MS = 5000;

const EXCLUDED_EPISODE_GROUP_NAME_REGEX =
  /\b(director.?s?\s*cut|chronolog|absolute|arc|arcs|saga|sagas|dvd|blu-?ray|ova|specials?)\b/i;
const EXACT_SEASON_EPISODE_GROUP_NAME_REGEX = /^(seasons?|temporadas?|剧集)$/i;
const SEASON_EPISODE_GROUP_NAME_REGEX = /(seasons?|temporadas?|production|prod|tv\s*cours|剧集|季)/i;
const SPECIALS_GROUP_NAME_REGEX =
  /^(specials?|especia(?:is|les)|extras?|ovas?|recaps?|season\s*0|temporada\s*0|特别篇)$/i;
const ANIME_ORIGIN_COUNTRIES = new Set(['JP', 'CN', 'KR']);
const ANIME_ORIGINAL_LANGUAGES = new Set(['ja', 'zh', 'ko']);

function getTodayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

export function computeBaseSeasonsCount(
  details: Pick<TmdbMediaDetails, 'seasons' | 'number_of_seasons'>,
  todayIso = getTodayIsoDate(),
): number {
  if (Array.isArray(details.seasons) && details.seasons.length > 0) {
    const regularSeasons = details.seasons.filter(
      (season) => (season.season_number ?? 0) > 0 && (season.episode_count ?? 0) > 0,
    );
    const airedSeasons = regularSeasons.filter(
      (season) => typeof season.air_date === 'string' && season.air_date.length >= 10 && season.air_date <= todayIso,
    );
    if (airedSeasons.length > 0) {
      return airedSeasons.length;
    }
    if (regularSeasons.length > 0) {
      return regularSeasons.length;
    }
  }
  return details.number_of_seasons && details.number_of_seasons > 0 ? details.number_of_seasons : 0;
}

export function pickSeasonEpisodeGroup(groups: readonly TmdbEpisodeGroupSummary[]): TmdbEpisodeGroupSummary | null {
  const eligible = groups.filter(
    (group) => Boolean(group.id) && (group.group_count ?? 0) > 1 && (group.episode_count ?? 0) > 0,
  );
  if (eligible.length === 0) return null;

  const productionGroups = eligible
    .filter((group) => group.type === EPISODE_GROUP_TYPE_PRODUCTION && !EXCLUDED_EPISODE_GROUP_NAME_REGEX.test(group.name ?? ''))
    .sort((a, b) => {
      const score = (group: TmdbEpisodeGroupSummary) => {
        const name = (group.name ?? '').trim();
        if (EXACT_SEASON_EPISODE_GROUP_NAME_REGEX.test(name)) return 3000;
        if (/\b(seasons?|temporadas?)\b/i.test(name)) return 2000;
        if (SEASON_EPISODE_GROUP_NAME_REGEX.test(name)) return 1000;
        return 0;
      };
      return (
        score(b) - score(a) ||
        (b.episode_count ?? 0) - (a.episode_count ?? 0) ||
        (b.group_count ?? 0) - (a.group_count ?? 0)
      );
    });

  if (productionGroups.length > 0) {
    return productionGroups[0]!;
  }

  const tvSeasonGroups = eligible
    .filter(
      (group) =>
        group.type === EPISODE_GROUP_TYPE_TV &&
        EXACT_SEASON_EPISODE_GROUP_NAME_REGEX.test((group.name ?? '').trim()),
    )
    .sort(
      (a, b) =>
        (b.episode_count ?? 0) - (a.episode_count ?? 0) ||
        (b.group_count ?? 0) - (a.group_count ?? 0),
    );

  return tvSeasonGroups[0] ?? null;
}

export function countValidSeasonGroups(
  groupDetails: TmdbEpisodeGroupDetails,
  todayIso = getTodayIsoDate(),
): number {
  let count = 0;
  for (const group of groupDetails.groups ?? []) {
    const name = (group.name ?? '').trim();
    if (SPECIALS_GROUP_NAME_REGEX.test(name)) continue;

    const episodes = group.episodes ?? [];
    if (episodes.length === 0) continue;
    if (episodes.every((episode) => (episode.season_number ?? 0) === 0)) continue;

    const datedEpisodes = episodes.filter(
      (episode) => typeof episode.air_date === 'string' && episode.air_date.length >= 10,
    );
    if (datedEpisodes.length > 0 && datedEpisodes.every((episode) => episode.air_date! > todayIso)) {
      continue;
    }

    count += 1;
  }
  return count;
}

export function countValidTvMazeSeasons(
  seasons: readonly TvMazeSeason[],
  todayIso = getTodayIsoDate(),
): number | null {
  if (!Array.isArray(seasons) || seasons.length === 0) return null;
  if (seasons.some((season) => typeof season.number === 'number' && season.number >= 1900)) {
    return null;
  }

  const airedRegularSeasons = seasons.filter(
    (season) =>
      typeof season.number === 'number' &&
      season.number >= 1 &&
      season.number < 1900 &&
      typeof season.premiereDate === 'string' &&
      season.premiereDate.length >= 10 &&
      season.premiereDate <= todayIso,
  );

  return airedRegularSeasons.length > 0 ? airedRegularSeasons.length : null;
}

function isAnimeTitleOrDetails(title: MediaTitle, details: TmdbMediaDetails): boolean {
  if (title.kind === 'Anime') return true;
  const hasAnimationGenre = details.genres?.some((genre) => genre.id === 16) ?? false;
  if (!hasAnimationGenre) return false;
  if (details.original_language && ANIME_ORIGINAL_LANGUAGES.has(details.original_language)) return true;
  return details.origin_country?.some((country) => ANIME_ORIGIN_COUNTRIES.has(country)) ?? false;
}

async function fetchTvMazeSeasonsCount(
  externalIds: TmdbExternalIds | null | undefined,
  todayIso: string,
): Promise<number | null> {
  const tvdbId = externalIds?.tvdb_id && externalIds.tvdb_id > 0 ? externalIds.tvdb_id : null;
  const imdbId = externalIds?.imdb_id?.trim() || null;
  if (!tvdbId && !imdbId) return null;

  const cacheKey = tvdbId ? `tvdb:${tvdbId}` : `imdb:${imdbId}`;
  if (tvMazeSeasonsCache.has(cacheKey)) {
    return tvMazeSeasonsCache.get(cacheKey) ?? null;
  }

  const pending = pendingTvMazeCache.get(cacheKey);
  if (pending) return pending;

  const promise = (async () => {
    try {
      const lookupUrls: string[] = [];
      if (tvdbId) lookupUrls.push(`https://api.tvmaze.com/lookup/shows?thetvdb=${tvdbId}`);
      if (imdbId) lookupUrls.push(`https://api.tvmaze.com/lookup/shows?imdb=${encodeURIComponent(imdbId)}`);

      let tvMazeShowId: number | null = null;
      for (const lookupUrl of lookupUrls) {
        const showRes = await fetchWithTimeout(lookupUrl, { headers: { Accept: 'application/json' } }, TVMAZE_TIMEOUT_MS);
        if (!showRes.ok) continue;
        const showData = (await showRes.json()) as { id?: number };
        if (typeof showData.id === 'number' && showData.id > 0) {
          tvMazeShowId = showData.id;
          break;
        }
      }

      if (!tvMazeShowId) {
        tvMazeSeasonsCache.set(cacheKey, null);
        return null;
      }

      const seasonsRes = await fetchWithTimeout(
        `https://api.tvmaze.com/shows/${tvMazeShowId}/seasons`,
        { headers: { Accept: 'application/json' } },
        TVMAZE_TIMEOUT_MS,
      );
      if (!seasonsRes.ok) return null;

      const seasons = (await seasonsRes.json()) as TvMazeSeason[];
      const count = countValidTvMazeSeasons(seasons, todayIso);
      tvMazeSeasonsCache.set(cacheKey, count);
      return count;
    } catch {
      return null;
    } finally {
      pendingTvMazeCache.delete(cacheKey);
    }
  })();

  pendingTvMazeCache.set(cacheKey, promise);
  return promise;
}

async function resolveTvDuration(title: MediaTitle, tmdbId: string, details: TmdbMediaDetails): Promise<string> {
  const todayIso = getTodayIsoDate();
  let resolvedSeasons = computeBaseSeasonsCount(details, todayIso);

  if (resolvedSeasons <= 1) {
    let episodeGroupSummaries = details.episode_groups?.results;
    if (!episodeGroupSummaries) {
      const egResponse = await request<{ results?: TmdbEpisodeGroupSummary[] }>(`/tv/${tmdbId}/episode_groups`, {})
        .catch(() => null);
      episodeGroupSummaries = egResponse?.results;
    }

    const seasonGroup = episodeGroupSummaries ? pickSeasonEpisodeGroup(episodeGroupSummaries) : null;
    if (seasonGroup) {
      const groupDetails = await request<TmdbEpisodeGroupDetails>(`/tv/episode_group/${seasonGroup.id}`, {})
        .catch(() => null);
      if (groupDetails) {
        const groupSeasons = countValidSeasonGroups(groupDetails, todayIso);
        if (groupSeasons > resolvedSeasons) {
          resolvedSeasons = groupSeasons;
        }
      }
    }

    if (resolvedSeasons <= 1 && isAnimeTitleOrDetails(title, details)) {
      let externalIds = details.external_ids;
      if (!externalIds) {
        externalIds = await request<TmdbExternalIds>(`/tv/${tmdbId}/external_ids`, {}).catch(() => null);
      }
      const tvMazeSeasons = await fetchTvMazeSeasonsCount(externalIds, todayIso);
      if (tvMazeSeasons !== null && tvMazeSeasons > resolvedSeasons) {
        resolvedSeasons = tvMazeSeasons;
      }
    }
  }

  if (resolvedSeasons > 0) {
    return formatSeasonsCount(resolvedSeasons);
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

  const match = /^tmdb-(movie|tv)-(\d+)$/.exec(title.id);
  if (!match || !hasCatalogBackend() || upstreamUnavailable) {
    return title.duration;
  }

  const existingPromise = pendingDurationCache.get(title.id);
  if (existingPromise) {
    return existingPromise;
  }

  const endpoint = match[1] as MediaEndpoint;
  const tmdbId = match[2];

  const promise = getValidAccessToken()
    .then((validToken) => {
      if (!validToken) return title.duration;
      const params: Record<string, string> = endpoint === 'tv'
        ? { language: 'pt-BR', append_to_response: 'episode_groups,external_ids' }
        : { language: 'pt-BR' };

      return request<TmdbMediaDetails>(`/${endpoint}/${tmdbId}`, params).then(async (details) => {
        let formatted = title.duration;
        if (endpoint === 'movie') {
          if (details.runtime && details.runtime > 0) {
            formatted = formatMovieRuntime(details.runtime);
          }
        } else {
          formatted = await resolveTvDuration(title, tmdbId, details);
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
    metacriticScore: computeMetacriticScore(item),
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
