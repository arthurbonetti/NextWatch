import {
  classifySupabaseError,
  type SupabaseOutcome,
  withSupabaseClient,
} from '@/services/supabase';
import {
  createEmptyRatingSummary,
  normalizeUserStarRating,
  type TitleRatingSummary,
} from '@/utils/titleRating';

const RATINGS_TABLE = 'user_title_ratings';
const STATS_TABLE = 'title_rating_stats';
const STATS_BATCH_CHUNK_SIZE = 100;

export type UserTitleRating = {
  userId: string;
  titleId: string;
  rating: number;
  updatedAt: string;
};

type RatingRow = {
  user_id: string;
  title_id: string;
  rating: number;
  updated_at: string;
};

type RatingStatsRow = {
  title_id: string;
  rating_sum: number | string;
  rating_count: number;
  average_rating: number | string;
};

function mapStatsRow(row: RatingStatsRow): TitleRatingSummary {
  const count = typeof row.rating_count === 'number' && Number.isFinite(row.rating_count)
    ? Math.max(0, Math.trunc(row.rating_count))
    : 0;
  const sum = Number(row.rating_sum);
  const parsedAverage = Number(row.average_rating);
  const average =
    count > 0
      ? Number.isFinite(parsedAverage)
        ? parsedAverage
        : Number.isFinite(sum)
          ? Math.round((sum / count) * 100) / 100
          : null
      : null;

  return {
    titleId: row.title_id,
    sum: Number.isFinite(sum) ? Math.max(0, sum) : 0,
    count,
    average,
  };
}

export async function fetchTitleRating(
  userId: string,
  titleId: string,
): Promise<{ found: boolean; rating: number | null }> {
  if (!userId || !titleId) return { found: false, rating: null };

  return withSupabaseClient<{ found: boolean; rating: number | null }>(
    { found: false, rating: null },
    async (client) => {
      const { data, error } = await client
        .from(RATINGS_TABLE)
        .select('rating')
        .eq('user_id', userId)
        .eq('title_id', titleId)
        .maybeSingle<Pick<RatingRow, 'rating'>>();

      if (error || !data) return { found: false, rating: null };
      const normalized = normalizeUserStarRating(data.rating);
      return normalized !== null ? { found: true, rating: normalized } : { found: false, rating: null };
    },
  );
}

export async function upsertTitleRating(
  userId: string,
  titleId: string,
  rating: number,
): Promise<SupabaseOutcome> {
  const normalized = normalizeUserStarRating(rating);
  if (!userId || !titleId || normalized === null) return 'drop';

  return withSupabaseClient<SupabaseOutcome>('retry', async (client) => {
    const { error, status } = await client.from(RATINGS_TABLE).upsert(
      {
        user_id: userId,
        title_id: titleId.slice(0, 128),
        rating: normalized,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,title_id' },
    );

    return classifySupabaseError(
      error ? { code: error.code, status, message: error.message } : null,
    );
  });
}

export async function deleteTitleRating(
  userId: string,
  titleId: string,
): Promise<SupabaseOutcome> {
  if (!userId || !titleId) return 'drop';

  return withSupabaseClient<SupabaseOutcome>('retry', async (client) => {
    const { error, status } = await client
      .from(RATINGS_TABLE)
      .delete()
      .eq('user_id', userId)
      .eq('title_id', titleId);

    return classifySupabaseError(
      error ? { code: error.code, status, message: error.message } : null,
    );
  });
}

export async function fetchTitleRatingSummary(
  titleId: string,
): Promise<TitleRatingSummary | null> {
  if (!titleId) return createEmptyRatingSummary('');

  return withSupabaseClient<TitleRatingSummary | null>(null, async (client) => {
    const { data, error } = await client
      .from(STATS_TABLE)
      .select('title_id, rating_sum, rating_count, average_rating')
      .eq('title_id', titleId)
      .maybeSingle<RatingStatsRow>();

    if (error) return null;
    if (!data) return createEmptyRatingSummary(titleId);
    return mapStatsRow(data);
  });
}

export async function fetchTitleRatingStatsBatch(
  titleIds: readonly string[],
): Promise<Record<string, TitleRatingSummary> | null> {
  const uniqueIds = Array.from(new Set(titleIds.filter((id) => id.length > 0 && id.length <= 128)));
  if (uniqueIds.length === 0) return {};

  return withSupabaseClient<Record<string, TitleRatingSummary> | null>(null, async (client) => {
    const result: Record<string, TitleRatingSummary> = {};
    for (const id of uniqueIds) {
      result[id] = createEmptyRatingSummary(id);
    }

    for (let offset = 0; offset < uniqueIds.length; offset += STATS_BATCH_CHUNK_SIZE) {
      const chunk = uniqueIds.slice(offset, offset + STATS_BATCH_CHUNK_SIZE);
      const { data, error } = await client
        .from(STATS_TABLE)
        .select('title_id, rating_sum, rating_count, average_rating')
        .in('title_id', chunk);

      if (error || !Array.isArray(data)) return null;
      for (const row of data as RatingStatsRow[]) {
        if (typeof row?.title_id === 'string' && row.title_id.length > 0) {
          result[row.title_id] = mapStatsRow(row);
        }
      }
    }

    return result;
  });
}
