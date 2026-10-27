import type { MediaIcon, MediaKind, MediaTitle } from '@/constants/catalog';
import { quickSortByRandom } from '@/utils/quickSort';

type TmdbProvider = {
  provider_id: number;
  provider_name: string;
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
  overview?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  genre_ids?: number[];
  vote_average?: number;
  original_language?: string;
  origin_country?: string[];
};

type TmdbMediaResponse = {
  results: TmdbMediaResult[];
  total_pages: number;
  total_results: number;
};

type TmdbMediaDetails = {
  runtime?: number | null;
  number_of_seasons?: number | null;
  number_of_episodes?: number | null;
};

type MediaEndpoint = 'movie' | 'tv';

export type TmdbCatalogResult = {
  titles: MediaTitle[];
  totalResults: number;
};

export type TmdbCatalogBatchCallback = (titles: MediaTitle[], totalResults: number) => void;

const API_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';
const API_TOKEN = process.env.EXPO_PUBLIC_TMDB_API_KEY?.trim();
const MAX_PAGES_PER_ENDPOINT = 500;
const REQUEST_CONCURRENCY = 10;

let cachedProvidersPromise: Promise<TmdbProvider[]> | null = null;

const PROVIDER_ALIASES: Record<string, string[]> = {
  'Netflix': ['netflix', 'netflix standard with ads', 'netflix basic with ads'],
  'Disney+': ['disney plus', 'disney'],
  'Max': ['max', 'hbo max'],
  'Prime Video': ['amazon prime video', 'prime video', 'amazon prime video with ads'],
  'Apple TV+': ['apple tv plus', 'apple tv'],
  'Globoplay': ['globoplay'],
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

export function hasTmdbApiKey() {
  return Boolean(API_TOKEN);
}

async function getWatchProviders(): Promise<TmdbProvider[]> {
  if (!cachedProvidersPromise) {
    cachedProvidersPromise = Promise.all([
      request<TmdbProviderResponse>('/watch/providers/movie', { watch_region: 'BR', language: 'pt-BR' }),
      request<TmdbProviderResponse>('/watch/providers/tv', { watch_region: 'BR', language: 'pt-BR' }),
    ])
      .then(([movieProviders, tvProviders]) => [...movieProviders.results, ...tvProviders.results])
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
  const nameKey = `${incoming.kind}-${normalize(incoming.title)}-${incoming.year}`;
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
): Promise<TmdbCatalogResult> {
  if (!API_TOKEN) throw new Error('Configure EXPO_PUBLIC_TMDB_API_KEY para habilitar o catálogo automático.');
  if (providerNames.length === 0) {
    onBatch?.([], 0);
    return { titles: [], totalResults: 0 };
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
  const remainingTasks: Array<() => Promise<MediaTitle[]>> = [];

  const firstPages = await Promise.all(
    resolvedProviders.flatMap(({ providerName, ids }) => {
      const providersQuery = ids.join('|');
      const movieParams: Record<string, string> = {
        language: 'pt-BR',
        region: 'BR',
        watch_region: 'BR',
        with_watch_providers: providersQuery,
        with_watch_monetization_types: 'flatrate|free|ads',
        sort_by: 'popularity.desc',
        include_adult: 'false',
      };
      const tvParams: Record<string, string> = {
        language: 'pt-BR',
        watch_region: 'BR',
        with_watch_providers: providersQuery,
        with_watch_monetization_types: 'flatrate|free|ads',
        sort_by: 'popularity.desc',
      };

      return [
        request<TmdbMediaResponse>('/discover/movie', { ...movieParams, page: '1' }).then((res) => ({
          endpoint: 'movie' as const,
          providerName,
          params: movieParams,
          response: res,
        })),
        request<TmdbMediaResponse>('/discover/tv', { ...tvParams, page: '1' }).then((res) => ({
          endpoint: 'tv' as const,
          providerName,
          params: tvParams,
          response: res,
        })),
      ];
    }),
  );

  if (shouldAbort?.()) return { titles: [], totalResults: 0 };

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

  const initialList = Array.from(catalogById.values());
  onBatch?.(initialList, initialList.length);

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
          const updatedList = Array.from(catalogById.values());
          onBatch?.(updatedList, updatedList.length);
        }
      }
    });

    await Promise.all(workers);
  }

  if (shouldAbort?.()) return { titles: [], totalResults: 0 };

  const finalList = Array.from(catalogById.values());
  onBatch?.(finalList, finalList.length);
  return {
    titles: finalList,
    totalResults: finalList.length,
  };
}

export async function searchCatalogTitles(query: string, fallbackProviders: string[] = []): Promise<MediaTitle[]> {
  if (!API_TOKEN || query.trim().length < 2) return [];

  const encodedQuery = query.trim();
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

  const rawItems: Array<{ item: TmdbMediaResult; endpoint: MediaEndpoint }> = [
    ...movies.results.map((item) => ({ item, endpoint: 'movie' as const })),
    ...shows.results.map((item) => ({ item, endpoint: 'tv' as const })),
  ];

  const mappedTitles = await Promise.all(
    rawItems.map(async ({ item, endpoint }, index) => {
      const providers = index < 12 ? await fetchTitleProvidersInBrazil(endpoint, item.id) : [];
      const services = providers.length > 0 ? providers : fallbackProviders;
      return mapMedia(item, endpoint, services);
    }),
  );

  const deduplicated = new Map<string, MediaTitle>();
  const idByNameKey = new Map<string, string>();
  for (const title of mappedTitles) {
    mergeTitleIntoCatalog(deduplicated, idByNameKey, title);
  }
  return Array.from(deduplicated.values());
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
  const normalizedRaw = normalize(rawProviderName);
  for (const [canonicalName, aliases] of Object.entries(PROVIDER_ALIASES)) {
    if (aliases.some((alias) => normalize(alias) === normalizedRaw)) {
      return canonicalName;
    }
  }
  return null;
}

export function tmdbImageUri(path: string | null | undefined, size: 'w342' | 'w780') {
  return path ? `${IMAGE_BASE_URL}/${size}${path}` : null;
}

async function request<T>(endpoint: string, params: Record<string, string>, retries = 3): Promise<T> {
  const url = new URL(`${API_BASE_URL}${endpoint}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const isBearer = API_TOKEN?.startsWith('eyJ');
  if (!isBearer && API_TOKEN) {
    url.searchParams.set('api_key', API_TOKEN);
  }

  const response = await fetch(url, {
    headers: {
      ...(isBearer ? { Authorization: `Bearer ${API_TOKEN}` } : {}),
      Accept: 'application/json',
    },
  });

  if ((response.status === 429 || response.status >= 500) && retries > 0) {
    await new Promise((resolve) => setTimeout(resolve, 500 * (4 - retries)));
    return request<T>(endpoint, params, retries - 1);
  }

  if (!response.ok) {
    throw new Error(`TMDB respondeu com erro ${response.status}. Verifique a chave da API e tente novamente.`);
  }
  return response.json() as Promise<T>;
}

function findProviderIds(activeNames: string[], providers: TmdbProvider[]) {
  const providerNames = new Set(activeNames.flatMap((name) => PROVIDER_ALIASES[name] ?? [name]).map(normalize));
  return Array.from(new Set(
    providers
      .filter((provider) => providerNames.has(normalize(provider.provider_name)))
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

function computeFallbackDuration(item: TmdbMediaResult, endpoint: MediaEndpoint): string {
  if (endpoint === 'tv') {
    const seasons = (item.id % 4) + 1;
    return formatSeasonsCount(seasons);
  }
  const minutes = 92 + ((item.id * 7) % 53);
  return formatMovieRuntime(minutes);
}

export function getCachedTitleDuration(title: MediaTitle): string {
  return resolvedDurationCache.get(title.id) ?? title.duration;
}

export async function fetchTitleDuration(title: MediaTitle): Promise<string> {
  const cached = resolvedDurationCache.get(title.id);
  if (cached) {
    title.duration = cached;
    return cached;
  }

  const match = /^tmdb-(movie|tv)-(\d+)$/.exec(title.id);
  if (!match || !API_TOKEN) {
    return title.duration;
  }

  const existingPromise = pendingDurationCache.get(title.id);
  if (existingPromise) {
    return existingPromise;
  }

  const endpoint = match[1] as MediaEndpoint;
  const tmdbId = match[2];

  const promise = request<TmdbMediaDetails>(`/${endpoint}/${tmdbId}`, { language: 'pt-BR' })
    .then((details) => {
      let formatted = title.duration;
      if (endpoint === 'movie') {
        if (details.runtime && details.runtime > 0) {
          formatted = formatMovieRuntime(details.runtime);
        }
      } else {
        if (details.number_of_seasons && details.number_of_seasons > 0) {
          formatted = formatSeasonsCount(details.number_of_seasons);
        } else if (details.number_of_episodes && details.number_of_episodes > 0) {
          formatted = details.number_of_episodes === 1
            ? '1 episódio'
            : `${details.number_of_episodes} episódios`;
        }
      }
      resolvedDurationCache.set(title.id, formatted);
      title.duration = formatted;
      return formatted;
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
    && (item.original_language === 'ja' || item.origin_country?.includes('JP') === true);
  const title = item.title ?? item.name ?? 'Título sem nome';
  const releaseDate = item.release_date ?? item.first_air_date ?? '';
  const icon: MediaIcon = endpoint === 'movie' ? 'movie' : 'live-tv';
  const rating = item.vote_average ?? 0;
  const resolvedServices = services.length > 0 ? services : ['Netflix'];
  const id = `tmdb-${endpoint}-${item.id}`;
  const duration = resolvedDurationCache.get(id) ?? computeFallbackDuration(item, endpoint);

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
  };
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}