import type { MediaIcon, MediaKind, MediaTitle } from '@/constants/catalog';

type TmdbProvider = {
  provider_id: number;
  provider_name: string;
};

type TmdbProviderResponse = {
  results: TmdbProvider[];
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

type MediaEndpoint = 'movie' | 'tv';

export type TmdbCatalogPage = {
  titles: MediaTitle[];
  providerIds: number[];
  totalPages: number;
  totalResults: number;
};

export type TmdbMediaPage = Omit<TmdbCatalogPage, 'providerIds'>;

const API_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';
const API_TOKEN = process.env.EXPO_PUBLIC_TMDB_API_KEY?.trim();

const PROVIDER_ALIASES: Record<string, string[]> = {
  'Netflix': ['netflix'],
  'Disney+': ['disney plus', 'disney'],
  'Max': ['max', 'hbo max'],
  'Prime Video': ['amazon prime video', 'prime video'],
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

export async function fetchCatalogPageForProviders(
  providerNames: string[],
  page: number,
): Promise<TmdbCatalogPage> {
  if (!API_TOKEN) throw new Error('Configure EXPO_PUBLIC_TMDB_API_KEY para habilitar o catálogo automático.');
  if (providerNames.length === 0) {
    return { titles: [], providerIds: [], totalPages: 0, totalResults: 0 };
  }

  const [movieProviders, tvProviders] = await Promise.all([
    request<TmdbProviderResponse>('/watch/providers/movie', { watch_region: 'BR', language: 'pt-BR' }),
    request<TmdbProviderResponse>('/watch/providers/tv', { watch_region: 'BR', language: 'pt-BR' }),
  ]);
  const providerIds = findProviderIds(providerNames, [...movieProviders.results, ...tvProviders.results]);
  if (providerIds.length === 0) {
    throw new Error(`Não encontrei no TMDB os serviços ativos: ${providerNames.join(', ')}.`);
  }

  const pageResult = await fetchCatalogPage(providerIds, page);
  return {
    ...pageResult,
    providerIds,
  };
}

export async function fetchCatalogPage(providerIds: number[], page: number): Promise<TmdbMediaPage> {
  if (!API_TOKEN) throw new Error('Configure EXPO_PUBLIC_TMDB_API_KEY para habilitar o catálogo automático.');
  if (providerIds.length === 0) {
    return {
      titles: [],
      totalPages: 0,
      totalResults: 0,
    };
  }

  const providersQuery = providerIds.join('|');
  const [movies, shows] = await Promise.all([
    request<TmdbMediaResponse>('/discover/movie', {
      language: 'pt-BR',
      region: 'BR',
      watch_region: 'BR',
      with_watch_providers: providersQuery,
      with_watch_monetization_types: 'flatrate|free|ads',
      sort_by: 'popularity.desc',
      include_adult: 'false',
      page: String(page),
    }),
    request<TmdbMediaResponse>('/discover/tv', {
      language: 'pt-BR',
      watch_region: 'BR',
      with_watch_providers: providersQuery,
      with_watch_monetization_types: 'flatrate|free|ads',
      sort_by: 'popularity.desc',
      page: String(page),
    }),
  ]);

  return {
    titles: [
      ...movies.results.map((item) => mapMedia(item, 'movie')),
      ...shows.results.map((item) => mapMedia(item, 'tv')),
    ],
    totalPages: Math.max(movies.total_pages, shows.total_pages),
    totalResults: movies.total_results + shows.total_results,
  };
}

export async function searchCatalogTitles(query: string): Promise<MediaTitle[]> {
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

  return [
    ...movies.results.map((item) => mapMedia(item, 'movie')),
    ...shows.results.map((item) => mapMedia(item, 'tv')),
  ];
}

export function tmdbImageUri(path: string | null | undefined, size: 'w342' | 'w780') {
  return path ? `${IMAGE_BASE_URL}/${size}${path}` : null;
}

async function request<T>(endpoint: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE_URL}${endpoint}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${API_TOKEN}`, Accept: 'application/json' },
  });
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

function mapMedia(item: TmdbMediaResult, endpoint: MediaEndpoint): MediaTitle {
  const genres = (item.genre_ids ?? [])
    .map((genreId) => GENRE_NAMES[endpoint][genreId])
    .filter((genre): genre is string => Boolean(genre));
  const isAnime = genres.includes('Animação')
    && (item.original_language === 'ja' || item.origin_country?.includes('JP') === true);
  const title = item.title ?? item.name ?? 'Título sem nome';
  const releaseDate = item.release_date ?? item.first_air_date ?? '';
  const icon: MediaIcon = endpoint === 'movie' ? 'movie' : 'live-tv';
  const rating = item.vote_average ?? 0;

  return {
    id: `tmdb-${endpoint}-${item.id}`,
    title,
    kind: isAnime ? 'Anime' : endpoint === 'movie' ? 'Filme' : 'Série',
    year: Number(releaseDate.slice(0, 4)) || 0,
    duration: endpoint === 'movie' ? 'Duração não informada' : 'Série',
    genres: genres.length ? genres : ['Outros'],
    service: 'Serviços ativos',
    imdbRating: rating > 0 ? rating.toFixed(1).replace('.', ',') : '—',
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
