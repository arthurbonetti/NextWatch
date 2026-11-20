import { isMediaTitle, type MediaTitle, sanitizeHexColor, sanitizeTmdbPath } from '@/constants/catalog';
import {
  classifySupabaseError,
  hasSupabaseConfig,
  supabase,
  type SupabaseOutcome,
} from '@/services/supabase';

const TABLE_NAME = 'user_my_list';

export type DbMyListRow = {
  user_id: string;
  title_id: string;
  title: string;
  kind: string;
  year: number;
  duration: string;
  genres: string[] | null;
  service: string;
  services: string[] | null;
  imdb_rating: string;
  metacritic_score: number | null;
  synopsis: string;
  color: string;
  icon: string;
  rating_source: string | null;
  catalog_source: string | null;
  tmdb_poster_path: string | null;
  tmdb_backdrop_path: string | null;
  original_title: string | null;
  popularity: number | null;
  vote_count: number | null;
  created_at?: string;
};

export function mapRowToMediaTitle(row: Partial<DbMyListRow> | null | undefined): MediaTitle | null {
  if (!row || typeof row !== 'object') return null;

  const candidate: MediaTitle = {
    id: String(row.title_id ?? '').slice(0, 128),
    title: String(row.title ?? '').slice(0, 500),
    kind: row.kind as MediaTitle['kind'],
    year: Math.max(0, Math.trunc(Number(row.year) || 0)),
    duration: String(row.duration ?? ''),
    genres: Array.isArray(row.genres) ? row.genres.filter((genre): genre is string => typeof genre === 'string') : [],
    service: String(row.service ?? ''),
    ...(Array.isArray(row.services)
      ? { services: row.services.filter((service): service is string => typeof service === 'string') }
      : {}),
    imdbRating: String(row.imdb_rating ?? ''),
    metacriticScore:
      row.catalog_source !== 'tmdb' &&
      typeof row.metacritic_score === 'number' &&
      Number.isFinite(row.metacritic_score)
        ? Math.round(row.metacritic_score)
        : null,
    synopsis: String(row.synopsis ?? ''),
    color: sanitizeHexColor(row.color) ?? '#596b7c',
    icon: row.icon as MediaTitle['icon'],
    ...(row.rating_source === 'IMDb' || row.rating_source === 'TMDB'
      ? { ratingSource: row.rating_source }
      : {}),
    ...(row.catalog_source === 'tmdb' ? { catalogSource: 'tmdb' as const } : {}),
    tmdbPosterPath: sanitizeTmdbPath(row.tmdb_poster_path),
    tmdbBackdropPath: sanitizeTmdbPath(row.tmdb_backdrop_path),
    ...(typeof row.original_title === 'string' ? { originalTitle: row.original_title } : {}),
    ...(typeof row.popularity === 'number' && Number.isFinite(row.popularity)
      ? { popularity: row.popularity }
      : {}),
    ...(typeof row.vote_count === 'number' && Number.isFinite(row.vote_count)
      ? { voteCount: Math.trunc(row.vote_count) }
      : {}),
  };

  return isMediaTitle(candidate) ? candidate : null;
}

export function mapMediaTitleToDbRow(
  userId: string,
  title: MediaTitle,
  createdAt?: string,
): DbMyListRow {
  const safeService = (title.service || title.services?.[0] || 'Netflix').trim().slice(0, 64) || 'Netflix';
  const safeServices = Array.isArray(title.services)
    ? title.services.map((service) => String(service).trim().slice(0, 64)).filter(Boolean).slice(0, 20)
    : null;

  return {
    user_id: userId,
    title_id: title.id.slice(0, 128),
    title: (title.title.trim() || 'Título sem nome').slice(0, 500),
    kind: title.kind,
    year: Math.max(0, Math.trunc(title.year) || 0),
    duration: (title.duration ?? '').slice(0, 64),
    genres: (Array.isArray(title.genres) ? title.genres : [])
      .map((genre) => String(genre).trim())
      .filter(Boolean)
      .slice(0, 20),
    service: safeService,
    services: safeServices && safeServices.length > 0 ? safeServices : null,
    imdb_rating: (title.imdbRating ?? '').slice(0, 16),
    metacritic_score:
      typeof title.metacriticScore === 'number' && Number.isFinite(title.metacriticScore)
        ? Math.min(100, Math.max(0, Math.round(title.metacriticScore)))
        : null,
    synopsis: (title.synopsis ?? '').slice(0, 4000),
    color: sanitizeHexColor(title.color) ?? '#596b7c',
    icon: title.icon,
    rating_source: title.ratingSource === 'IMDb' || title.ratingSource === 'TMDB' ? title.ratingSource : null,
    catalog_source: title.catalogSource === 'tmdb' ? 'tmdb' : null,
    tmdb_poster_path: sanitizeTmdbPath(title.tmdbPosterPath),
    tmdb_backdrop_path: sanitizeTmdbPath(title.tmdbBackdropPath),
    original_title:
      typeof title.originalTitle === 'string' && title.originalTitle.trim().length > 0
        ? title.originalTitle.trim().slice(0, 500)
        : null,
    popularity:
      typeof title.popularity === 'number' && Number.isFinite(title.popularity) && title.popularity >= 0
        ? title.popularity
        : null,
    vote_count:
      typeof title.voteCount === 'number' && Number.isFinite(title.voteCount) && title.voteCount >= 0
        ? Math.trunc(title.voteCount)
        : null,
    ...(createdAt ? { created_at: createdAt } : {}),
  };
}

export async function fetchMyList(userId: string): Promise<MediaTitle[] | null> {
  if (!userId || !supabase || !hasSupabaseConfig()) return null;

  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error || !Array.isArray(data)) return null;

    return (data as Partial<DbMyListRow>[])
      .map(mapRowToMediaTitle)
      .filter((item): item is MediaTitle => item !== null);
  } catch {
    return null;
  }
}

export async function upsertMyListBatch(
  userId: string,
  items: { title: MediaTitle; createdAt?: string }[],
): Promise<SupabaseOutcome> {
  if (items.length === 0) return 'ok';
  if (!userId || !supabase || !hasSupabaseConfig()) return 'retry';

  try {
    const rows = items.map(({ title, createdAt }) => mapMediaTitleToDbRow(userId, title, createdAt));
    const { error, status } = await supabase
      .from(TABLE_NAME)
      .upsert(rows.length === 1 ? rows[0]! : rows);

    return classifySupabaseError(error ? { code: error.code, status, message: error.message } : null);
  } catch {
    return 'retry';
  }
}

export async function upsertMyListTitle(
  userId: string,
  title: MediaTitle,
  createdAt?: string,
): Promise<SupabaseOutcome> {
  return upsertMyListBatch(userId, [{ title, createdAt }]);
}

export async function deleteMyListTitle(
  userId: string,
  titleId: string,
): Promise<SupabaseOutcome> {
  if (!userId || !supabase || !hasSupabaseConfig()) return 'retry';

  try {
    const { error, status } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq('user_id', userId)
      .eq('title_id', titleId);

    return classifySupabaseError(error ? { code: error.code, status, message: error.message } : null);
  } catch {
    return 'retry';
  }
}
