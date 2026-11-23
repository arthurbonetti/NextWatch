import {
  sanitizeHexColor,
  sanitizeTmdbPath,
  VALID_MEDIA_KINDS,
} from '@/constants/catalog';
import {
  classifySupabaseError,
  type SupabaseOutcome,
  withSupabaseClient,
} from '@/services/supabase';
import { type DrawAction, type DrawHistoryEntry, isDrawAction } from '@/types/drawHistory';
import type { MediaKind } from '@/types/media';

const TABLE_NAME = 'user_draw_history';
const SELECT_COLUMNS = 'id,user_id,tmdb_id,sorteado_em,acao,title,kind,tmdb_poster_path,color';
export const MAX_HISTORY_ENTRIES = 100;

type DbDrawHistoryRow = {
  id: number | string;
  user_id: string;
  tmdb_id: string;
  sorteado_em: string;
  acao: string;
  title: string | null;
  kind: string | null;
  tmdb_poster_path: string | null;
  color: string | null;
};

function mapDbRowToEntry(row: DbDrawHistoryRow): DrawHistoryEntry | null {
  if (!isDrawAction(row.acao) || typeof row.tmdb_id !== 'string' || !row.tmdb_id) return null;
  const kind = typeof row.kind === 'string' && VALID_MEDIA_KINDS.has(row.kind)
    ? (row.kind as MediaKind)
    : undefined;
  return {
    id: String(row.id),
    tmdbId: row.tmdb_id,
    sorteadoEm: typeof row.sorteado_em === 'string' ? row.sorteado_em : new Date().toISOString(),
    acao: row.acao,
    title: typeof row.title === 'string' && row.title.trim() ? row.title : undefined,
    kind,
    tmdbPosterPath: sanitizeTmdbPath(row.tmdb_poster_path),
    color: sanitizeHexColor(row.color),
  };
}

export async function fetchDrawHistory(
  userId: string,
  limit = MAX_HISTORY_ENTRIES,
): Promise<DrawHistoryEntry[] | null> {
  if (!userId) return null;

  return withSupabaseClient<DrawHistoryEntry[] | null>(null, async (client) => {
    const { data, error } = await client
      .from(TABLE_NAME)
      .select(SELECT_COLUMNS)
      .eq('user_id', userId)
      .order('sorteado_em', { ascending: false })
      .limit(limit);

    if (error || !Array.isArray(data)) return null;

    return (data as DbDrawHistoryRow[])
      .map(mapDbRowToEntry)
      .filter((entry): entry is DrawHistoryEntry => entry !== null);
  });
}

export async function insertDrawHistoryEntry(
  userId: string,
  entry: DrawHistoryEntry,
): Promise<{ status: 'ok'; saved: DrawHistoryEntry } | { status: Exclude<SupabaseOutcome, 'ok'> }> {
  if (!userId) return { status: 'retry' };

  return withSupabaseClient<
    { status: 'ok'; saved: DrawHistoryEntry } | { status: Exclude<SupabaseOutcome, 'ok'> }
  >({ status: 'retry' }, async (client) => {
    const { data, error, status } = await client
      .from(TABLE_NAME)
      .insert({
        user_id: userId,
        tmdb_id: entry.tmdbId.slice(0, 128),
        sorteado_em: entry.sorteadoEm,
        acao: entry.acao,
        title: entry.title ? entry.title.slice(0, 500) : null,
        kind: entry.kind ?? null,
        tmdb_poster_path: sanitizeTmdbPath(entry.tmdbPosterPath),
        color: sanitizeHexColor(entry.color) ?? null,
      })
      .select(SELECT_COLUMNS)
      .single();

    if (error) {
      const outcome = classifySupabaseError({ code: error.code, status, message: error.message });
      return { status: outcome === 'drop' ? 'drop' : 'retry' };
    }

    const mapped = data ? mapDbRowToEntry(data as DbDrawHistoryRow) : null;
    return { status: 'ok', saved: mapped ?? entry };
  });
}

export async function updateDrawHistoryAction(
  userId: string,
  entryId: string,
  acao: DrawAction,
): Promise<boolean> {
  if (!userId) return false;

  return withSupabaseClient(false, async (client) => {
    const { error } = await client
      .from(TABLE_NAME)
      .update({ acao })
      .eq('id', entryId)
      .eq('user_id', userId);

    return !error;
  });
}

export async function clearDrawHistory(userId: string): Promise<boolean> {
  if (!userId) return false;

  return withSupabaseClient(false, async (client) => {
    const { error } = await client
      .from(TABLE_NAME)
      .delete()
      .eq('user_id', userId);

    return !error;
  });
}
