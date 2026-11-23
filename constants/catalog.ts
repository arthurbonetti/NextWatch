import type { MaterialIconName } from '@/components/atoms/AppIcon';

import type {
  MediaIcon,
  MediaKind,
  MediaKindFilter,
  MediaTitle,
} from '../types/media.ts';

export const MIN_DRAW_RATING = 6.0;
export const MIN_DRAW_VOTE_COUNT = 25;
export const EXCLUDED_DRAW_GENRES: ReadonlySet<string> = new Set(['Notícias', 'Talk show', 'News', 'Talk']);

export const KIND_ICONS: Record<'Todos' | MediaKind, MaterialIconName> = {
  Todos: 'apps',
  Filme: 'movie',
  Série: 'live-tv',
  Anime: 'theaters',
};

export const GENRE_ICONS: Record<string, MaterialIconName> = {
  'Ficção científica': 'science',
  'Ficção científica e fantasia': 'science',
  Drama: 'theater-comedy',
  Aventura: 'explore',
  'Ação e aventura': 'explore',
  Comédia: 'sentiment-very-satisfied',
  Suspense: 'visibility',
  Terror: 'local-fire-department',
  Animação: 'animation',
  História: 'history-edu',
  Romance: 'favorite',
  Ação: 'bolt',
  Música: 'music-note',
  Fantasia: 'auto-fix-high',
  Faroeste: 'terrain',
  Crime: 'gavel',
  Documentário: 'videocam',
  Mistério: 'search',
  Família: 'family-restroom',
  Guerra: 'shield',
  'Guerra e política': 'military-tech',
  'Filme para TV': 'tv',
  Infantil: 'child-care',
  Reality: 'star',
  Novela: 'menu-book',
  Outros: 'label',
};

export function getGenreIcon(genre: string): MaterialIconName {
  return GENRE_ICONS[genre] ?? 'local-movies';
}

export function getKindIcon(kind: 'Todos' | MediaKind): MaterialIconName {
  return KIND_ICONS[kind];
}

export function isSerialTitle(title: Pick<MediaTitle, 'id' | 'kind' | 'icon'>): boolean {
  return (
    (title.kind === 'Série' || title.kind === 'Anime') &&
    !title.id.startsWith('tmdb-movie-') &&
    title.icon === 'live-tv'
  );
}

export const MEDIA_KINDS: readonly MediaKind[] = ['Filme', 'Série', 'Anime'];
export const VALID_MEDIA_KINDS: ReadonlySet<string> = new Set<MediaKind>(MEDIA_KINDS);
export const VALID_KIND_FILTERS: ReadonlySet<string> = new Set<MediaKindFilter>(['Todos', ...MEDIA_KINDS]);
const VALID_MEDIA_ICONS: ReadonlySet<string> = new Set<MediaIcon>(['movie', 'live-tv', 'theaters']);
const SAFE_HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;
const SAFE_TMDB_PATH_REGEX = /^\/[a-zA-Z0-9._-]{1,120}$/;

export function sanitizeTmdbPath(path: unknown): string | null {
  if (typeof path !== 'string') return null;
  return SAFE_TMDB_PATH_REGEX.test(path) && !path.includes('..') ? path : null;
}

export function sanitizeHexColor(color: unknown): string | undefined {
  if (typeof color !== 'string') return undefined;
  return SAFE_HEX_COLOR_REGEX.test(color) ? color : undefined;
}

export function getAllGenres(titles: readonly MediaTitle[]): string[] {
  return Array.from(new Set([...GENRES, ...titles.flatMap((title) => title.genres)]));
}

export function getDrawGenres(titles: readonly MediaTitle[]): string[] {
  return getAllGenres(titles).filter((genre) => !EXCLUDED_DRAW_GENRES.has(genre));
}

export function isMediaTitle(value: unknown): value is MediaTitle {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<MediaTitle>;
  return (
    typeof item.id === 'string' &&
    item.id.length > 0 &&
    item.id.length <= 128 &&
    typeof item.title === 'string' &&
    item.title.length > 0 &&
    item.title.length <= 500 &&
    typeof item.kind === 'string' &&
    VALID_MEDIA_KINDS.has(item.kind) &&
    typeof item.year === 'number' &&
    Number.isInteger(item.year) &&
    item.year >= 0 &&
    typeof item.duration === 'string' &&
    Array.isArray(item.genres) &&
    item.genres.every((genre) => typeof genre === 'string') &&
    typeof item.service === 'string' &&
    item.service.length > 0 &&
    (item.services === undefined ||
      (Array.isArray(item.services) && item.services.every((service) => typeof service === 'string'))) &&
    typeof item.imdbRating === 'string' &&
    (item.metacriticScore === undefined ||
      item.metacriticScore === null ||
      (typeof item.metacriticScore === 'number' && Number.isFinite(item.metacriticScore))) &&
    typeof item.synopsis === 'string' &&
    typeof item.color === 'string' &&
    typeof item.icon === 'string' &&
    VALID_MEDIA_ICONS.has(item.icon) &&
    (item.ratingSource === undefined || item.ratingSource === 'IMDb' || item.ratingSource === 'TMDB') &&
    (item.catalogSource === undefined || item.catalogSource === 'tmdb') &&
    (item.tmdbPosterPath === undefined || item.tmdbPosterPath === null || typeof item.tmdbPosterPath === 'string') &&
    (item.tmdbBackdropPath === undefined || item.tmdbBackdropPath === null || typeof item.tmdbBackdropPath === 'string') &&
    (item.originalTitle === undefined || typeof item.originalTitle === 'string') &&
    (item.popularity === undefined || (typeof item.popularity === 'number' && Number.isFinite(item.popularity))) &&
    (item.voteCount === undefined || (typeof item.voteCount === 'number' && Number.isFinite(item.voteCount)))
  );
}

export function getTitleServices(title: MediaTitle): string[] {
  return title.services && title.services.length > 0 ? title.services : [title.service];
}

export function getMetacriticScore(title: MediaTitle): number | null {
  if (typeof title.metacriticScore === 'number' && title.metacriticScore > 0) {
    return title.metacriticScore;
  }
  return null;
}

function floorToOneDecimal(value: number): number {
  // 1e-9 evita erro de ponto flutuante (ex: 5.999999999999999 virando 5.9 em vez de 6.0)
  return Math.floor(value * 10 + 1e-9) / 10;
}

export function getTitleAverageRating(title: MediaTitle): number {
  const tmdb = Number(title.imdbRating.replace(',', '.'));
  const hasTmdb = !Number.isNaN(tmdb) && tmdb > 0;
  const metacritic = getMetacriticScore(title);
  const hasMetacritic = metacritic !== null && metacritic > 0;

  if (hasTmdb && hasMetacritic) {
    const metacriticNormalized = metacritic / 10;
    return floorToOneDecimal((tmdb + metacriticNormalized) / 2);
  }
  if (hasTmdb) return floorToOneDecimal(tmdb);
  if (hasMetacritic) return floorToOneDecimal(metacritic / 10);
  return 0;
}

export function formatAverageRating(title: MediaTitle): string {
  const avg = getTitleAverageRating(title);
  return avg > 0 ? avg.toFixed(1).replace('.', ',') : '—';
}

export const GENRES = ['Ficção científica', 'Drama', 'Aventura', 'Comédia', 'Suspense', 'Terror', 'Animação', 'História', 'Romance', 'Ação', 'Música'];