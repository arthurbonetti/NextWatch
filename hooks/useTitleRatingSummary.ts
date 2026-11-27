import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { queryKeys } from '@/services/queryKeys';
import {
  fetchTitleRatingStatsBatch,
  fetchTitleRatingSummary,
} from '@/services/repositories/ratingRepo';
import { hasSupabaseConfig } from '@/services/supabase';
import { createEmptyRatingSummary, type TitleRatingSummary } from '@/utils/titleRating';

const EMPTY_BATCH_MAP: Record<string, TitleRatingSummary> = {};
const EMPTY_SUMMARY_SINGLETON = createEmptyRatingSummary('');

/** Busca a média e a contagem de avaliações dos usuários para um título específico. */
export function useTitleRatingSummary(titleId: string) {
  const { token } = useAuth();
  const hasToken = Boolean(token);
  const queryKey = useMemo(() => queryKeys.titleRatingSummary(titleId), [titleId]);

  const query = useQuery<TitleRatingSummary>({
    queryKey,
    enabled: Boolean(titleId),
    staleTime: 30_000,
    queryFn: async () => {
      if (!hasToken || !hasSupabaseConfig()) {
        return createEmptyRatingSummary(titleId);
      }
      return (await fetchTitleRatingSummary(titleId)) ?? createEmptyRatingSummary(titleId);
    },
  });

  const summary = titleId
    ? (query.data ?? createEmptyRatingSummary(titleId))
    : createEmptyRatingSummary('');

  return {
    summary,
    isLoading: Boolean(titleId && query.isLoading),
    refetch: query.refetch,
  };
}

/** Busca em lote as médias de avaliações dos usuários para listas (Explorar / Minha Lista). */
export function useTitleRatingSummaries(titleIds: readonly string[]) {
  const { token } = useAuth();
  const hasToken = Boolean(token);
  const queryClient = useQueryClient();

  const normalizedIds = useMemo(
    () => Array.from(new Set(titleIds.filter((id) => id.length > 0 && id.length <= 128))).sort(),
    [titleIds],
  );
  const idsKey = useMemo(() => normalizedIds.join(','), [normalizedIds]);
  const queryKey = useMemo(() => queryKeys.titleRatingStatsBatch(idsKey), [idsKey]);

  const query = useQuery<Record<string, TitleRatingSummary>>({
    queryKey,
    enabled: Boolean(hasToken && hasSupabaseConfig() && normalizedIds.length > 0),
    staleTime: 45_000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const batch = await fetchTitleRatingStatsBatch(normalizedIds);
      if (!batch) {
        return EMPTY_BATCH_MAP;
      }
      for (const [id, summary] of Object.entries(batch)) {
        queryClient.setQueryData<TitleRatingSummary>(queryKeys.titleRatingSummary(id), summary);
      }
      return batch;
    },
  });

  const batchMap = query.data ?? EMPTY_BATCH_MAP;

  const getSummary = useCallback(
    (titleId: string): TitleRatingSummary => {
      if (!titleId) return EMPTY_SUMMARY_SINGLETON;
      return (
        queryClient.getQueryData<TitleRatingSummary>(queryKeys.titleRatingSummary(titleId)) ??
        batchMap[titleId] ??
        EMPTY_SUMMARY_SINGLETON
      );
    },
    [batchMap, queryClient],
  );

  return {
    getSummary,
    isLoading: Boolean(hasToken && normalizedIds.length > 0 && query.isLoading),
  };
}
