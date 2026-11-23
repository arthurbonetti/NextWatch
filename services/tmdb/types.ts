import type { MediaTitle } from '@/types/media';

export type TmdbProvider = {
  provider_id: number;
  provider_name: string;
  logo_path?: string | null;
};

export type TmdbProviderResponse = {
  results: TmdbProvider[];
};

export type TmdbTitleWatchProvidersResponse = {
  results?: {
    BR?: {
      flatrate?: TmdbProvider[];
      free?: TmdbProvider[];
      ads?: TmdbProvider[];
    };
  };
};

export type TmdbMediaResult = {
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

export type TmdbMediaResponse = {
  results: TmdbMediaResult[];
  total_pages: number;
  total_results: number;
};

export type TmdbSeasonSummary = {
  season_number?: number | null;
  episode_count?: number | null;
  air_date?: string | null;
  name?: string | null;
  vote_average?: number | null;
  poster_path?: string | null;
};

export type TmdbVideoItem = {
  key?: string | null;
  site?: string | null;
  type?: string | null;
  official?: boolean | null;
};

export type TmdbVideosResponse = {
  results?: TmdbVideoItem[];
};

export type TmdbMediaDetails = Partial<TmdbMediaResult> & {
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

export type TmdbSeasonDetailsResponse = {
  episodes?: {
    episode_number?: number | null;
    name?: string | null;
    runtime?: number | null;
    air_date?: string | null;
    vote_average?: number | null;
  }[];
};

export type MediaEndpoint = 'movie' | 'tv';

export type TmdbCatalogBatchCallback = (titles: MediaTitle[]) => void;

export type CatalogFetchResult = {
  titles: MediaTitle[];
  source: 'tmdb' | 'static-fallback';
  reason?: 'not-configured' | 'error';
  errorMessage?: string;
};

export class CatalogBackendNotConfiguredError extends Error {
  constructor(
    message = 'Configure o segredo TMDB_API_TOKEN na Edge Function tmdb-proxy do Supabase para habilitar o catálogo dinâmico.',
  ) {
    super(message);
    this.name = 'CatalogBackendNotConfiguredError';
  }
}
