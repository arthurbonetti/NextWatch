import {
  classifySupabaseError,
  type SupabaseOutcome,
  withSupabaseClient,
} from '@/services/supabase';
import type { RemoteProgressEntry, SeriesProgressMap } from '@/utils/watchedProgress';

const TABLE_NAME = 'user_series_progress';
const EMPTY_MAP: SeriesProgressMap = {};

type DbSeriesProgressRow = {
  user_id: string;
  title_id: string;
  progress: SeriesProgressMap;
  updated_at?: string;
};

export function sanitizeProgressObject(parsed: unknown): SeriesProgressMap {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return EMPTY_MAP;
  }
  const result: SeriesProgressMap = {};
  for (const [seasonKey, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue;
    const validEpisodes = Array.from(
      new Set(
        value.filter(
          (ep): ep is number => typeof ep === 'number' && Number.isInteger(ep) && ep > 0,
        ),
      ),
    ).sort((a, b) => a - b);
    if (validEpisodes.length > 0) {
      result[seasonKey] = validEpisodes;
    }
  }
  return result;
}

export async function fetchSeriesProgress(
  userId: string,
  titleId: string,
): Promise<{ found: boolean; map: SeriesProgressMap } | null> {
  if (!userId || !titleId) return null;

  return withSupabaseClient<{ found: boolean; map: SeriesProgressMap } | null>(null, async (client) => {
    const { data, error } = await client
      .from(TABLE_NAME)
      .select('progress')
      .eq('user_id', userId)
      .eq('title_id', titleId)
      .maybeSingle();

    if (error) return null;
    if (!data) {
      return { found: false, map: EMPTY_MAP };
    }
    return {
      found: true,
      map: sanitizeProgressObject((data as Partial<DbSeriesProgressRow>).progress),
    };
  });
}

export async function fetchAllWatchedProgress(userId: string): Promise<RemoteProgressEntry[] | null> {
  if (!userId) return null;

  return withSupabaseClient<RemoteProgressEntry[] | null>(null, async (client) => {
    const { data, error } = await client
      .from(TABLE_NAME)
      .select('title_id,progress')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error || !Array.isArray(data)) return null;

    const remoteRows: RemoteProgressEntry[] = [];
    for (const row of data as { title_id?: unknown; progress?: unknown }[]) {
      if (typeof row?.title_id === 'string' && row.title_id.length > 0) {
        remoteRows.push({
          titleId: row.title_id,
          progress: sanitizeProgressObject(row.progress),
        });
      }
    }
    return remoteRows;
  });
}

export async function upsertSeriesProgress(
  userId: string,
  titleId: string,
  progress: SeriesProgressMap,
): Promise<SupabaseOutcome> {
  if (!userId || !titleId) return 'retry';

  return withSupabaseClient<SupabaseOutcome>('retry', async (client) => {
    const payload: DbSeriesProgressRow = {
      user_id: userId,
      title_id: titleId.slice(0, 128),
      progress,
      updated_at: new Date().toISOString(),
    };
    const { error, status } = await client
      .from(TABLE_NAME)
      .upsert(payload);

    return classifySupabaseError(error ? { code: error.code, status, message: error.message } : null);
  });
}

export async function deleteSeriesProgress(
  userId: string,
  titleId: string,
): Promise<SupabaseOutcome> {
  if (!userId || !titleId) return 'retry';

  return withSupabaseClient<SupabaseOutcome>('retry', async (client) => {
    const { error, status } = await client
      .from(TABLE_NAME)
      .delete()
      .eq('user_id', userId)
      .eq('title_id', titleId);

    return classifySupabaseError(error ? { code: error.code, status, message: error.message } : null);
  });
}
