import { TMDB_ARTWORK } from '@/constants/tmdb-artwork';
import type { MediaIcon, MediaTitle } from '@/types/media';

import { COVER_COLORS, GENRE_NAMES, SAFE_YOUTUBE_KEY_REGEX } from './constants';
import type {
  MediaEndpoint,
  TmdbMediaDetails,
  TmdbMediaResult,
  TmdbSeasonSummary,
  TmdbVideoItem,
} from './types';

export const resolvedDurationCache = new Map<string, string>();

export function formatMovieRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours <= 0) return `${remainingMinutes}min`;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}min`;
}

export function formatSeasonsCount(seasons: number): string {
  return seasons === 1 ? '1 temporada' : `${seasons} temporadas`;
}

export function extractRegularTmdbSeasons(
  details: Pick<TmdbMediaDetails, 'seasons'>,
): TmdbSeasonSummary[] {
  return (details.seasons ?? [])
    .filter(
      (season) =>
        typeof season.season_number === 'number' &&
        season.season_number > 0 &&
        (season.episode_count ?? 0) > 0,
    )
    .sort((a, b) => (a.season_number ?? 0) - (b.season_number ?? 0));
}

export function resolveTvDuration(
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

export function resolveTmdbEndpointAndId(
  titleId: string,
): { endpoint: MediaEndpoint; tmdbId: string } | null {
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

export function pickYoutubeTrailerKey(videos: readonly TmdbVideoItem[] | undefined): string | null {
  if (!Array.isArray(videos) || videos.length === 0) return null;
  const youtubeVideos = videos.filter(
    (video) =>
      video.site === 'YouTube' &&
      typeof video.key === 'string' &&
      SAFE_YOUTUBE_KEY_REGEX.test(video.key),
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

export function normalizeBrCertification(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase() === 'livre') return 'L';
  return trimmed.slice(0, 6);
}

export function extractBrCertification(
  endpoint: MediaEndpoint,
  details: TmdbMediaDetails,
): string | null {
  if (endpoint === 'movie') {
    const brEntry = details.release_dates?.results?.find((entry) => entry.iso_3166_1 === 'BR');
    const cert = brEntry?.release_dates?.find((item) =>
      Boolean(item.certification?.trim()),
    )?.certification;
    return normalizeBrCertification(cert);
  }
  const brRating = details.content_ratings?.results?.find(
    (entry) => entry.iso_3166_1 === 'BR',
  )?.rating;
  return normalizeBrCertification(brRating);
}

export function mapMedia(
  item: TmdbMediaResult,
  endpoint: MediaEndpoint,
  services: string[],
): MediaTitle {
  const genres = (item.genre_ids ?? [])
    .map((genreId) => GENRE_NAMES[endpoint][genreId])
    .filter((genre): genre is string => Boolean(genre));
  const isAnime =
    genres.includes('Animação') &&
    (item.original_language === 'ja' ||
      item.origin_country?.includes('JP') === true ||
      services.includes('Crunchyroll'));
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
