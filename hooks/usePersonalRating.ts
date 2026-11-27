import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { queryKeys } from '@/services/queryKeys';
import {
  deleteTitleRating,
  fetchTitleRating,
  upsertTitleRating,
} from '@/services/repositories/ratingRepo';
import { hasSupabaseConfig } from '@/services/supabase';
import {
  applyOptimisticRatingSummary,
  normalizeUserStarRating,
  type TitleRatingSummary,
} from '@/utils/titleRating';

const CACHE_PREFIX = '@nextwatch/personal-rating:';

async function readCachedPersonalRating(storageKey: string): Promise<number | null> {
  if (!storageKey) return null;
  const raw = await AsyncStorage.getItem(storageKey).catch(() => null);
  if (raw === null) return null;
  try {
    return normalizeUserStarRating(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function writeCachedPersonalRating(storageKey: string, rating: number | null): Promise<void> {
  if (!storageKey) return;
  if (rating === null) {
    await AsyncStorage.removeItem(storageKey).catch(() => {});
  } else {
    await AsyncStorage.setItem(storageKey, JSON.stringify(rating)).catch(() => {});
  }
}

export function usePersonalRating(userId: string | null, titleId: string) {
  const { token } = useAuth();
  const hasToken = Boolean(token);
  const queryClient = useQueryClient();
  const storageKey = titleId ? `${CACHE_PREFIX}${userId ?? 'guest'}:${titleId}` : '';
  const queryKey = useMemo(() => queryKeys.personalRating(userId, titleId), [titleId, userId]);
  const summaryKey = useMemo(() => queryKeys.titleRatingSummary(titleId), [titleId]);

  const query = useQuery<number | null>({
    queryKey,
    enabled: Boolean(titleId),
    staleTime: 30_000,
    queryFn: async () => {
      const localRating = await readCachedPersonalRating(storageKey);
      if (!userId || !hasToken || !hasSupabaseConfig()) {
        return localRating;
      }

      const remote = await fetchTitleRating(userId, titleId);
      if (remote.found) {
        await writeCachedPersonalRating(storageKey, remote.rating);
        return remote.rating;
      }

      return localRating;
    },
  });

  const { mutate: mutateRating, isPending: isSaving } = useMutation<
    void,
    Error,
    { nextRating: number | null; previousRating: number | null },
    {
      previousRating: number | null;
      previousSummary: TitleRatingSummary | undefined;
    }
  >({
    mutationFn: async ({ nextRating }) => {
      if (!userId || !titleId || !hasToken || !hasSupabaseConfig()) {
        return;
      }
      const outcome =
        nextRating === null
          ? await deleteTitleRating(userId, titleId)
          : await upsertTitleRating(userId, titleId, nextRating);

      if (outcome === 'drop') {
        throw new Error('Não foi possível salvar sua avaliação.');
      }
    },
    onMutate: async ({ nextRating, previousRating }) => {
      await queryClient.cancelQueries({ queryKey });
      await queryClient.cancelQueries({ queryKey: summaryKey });

      const cachedPrevious = queryClient.getQueryData<number | null>(queryKey) ?? previousRating;
      const previousSummary = queryClient.getQueryData<TitleRatingSummary>(summaryKey);

      queryClient.setQueryData<number | null>(queryKey, nextRating);
      void writeCachedPersonalRating(storageKey, nextRating);

      queryClient.setQueryData<TitleRatingSummary | undefined>(summaryKey, (current) =>
        applyOptimisticRatingSummary({
          current,
          titleId,
          previousUserRating: cachedPrevious,
          nextUserRating: nextRating,
        }),
      );

      queryClient.setQueriesData<Record<string, TitleRatingSummary>>(
        { queryKey: ['titleRatingStats'] },
        (currentBatch) => {
          if (!currentBatch || !(titleId in currentBatch)) return currentBatch;
          return {
            ...currentBatch,
            [titleId]: applyOptimisticRatingSummary({
              current: currentBatch[titleId],
              titleId,
              previousUserRating: cachedPrevious,
              nextUserRating: nextRating,
            }),
          };
        },
      );

      return { previousRating: cachedPrevious, previousSummary };
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      queryClient.setQueryData<number | null>(queryKey, context.previousRating);
      void writeCachedPersonalRating(storageKey, context.previousRating);
      if (context.previousSummary !== undefined) {
        queryClient.setQueryData<TitleRatingSummary>(summaryKey, context.previousSummary);
      }
    },
    onSettled: () => {
      if (!titleId || !hasToken || !hasSupabaseConfig()) return;
      void queryClient.invalidateQueries({ queryKey: summaryKey });
      void queryClient.invalidateQueries({ queryKey: ['titleRatingStats'] });
    },
  });

  const saveRating = useCallback(
    (nextRating: number | null) => {
      if (!titleId) return;
      const normalized = normalizeUserStarRating(nextRating);
      const previousRating = queryClient.getQueryData<number | null>(queryKey) ?? query.data ?? null;
      mutateRating({ nextRating: normalized, previousRating });
    },
    [mutateRating, query.data, queryClient, queryKey, titleId],
  );

  return {
    rating: titleId ? (query.data ?? null) : null,
    ready: !titleId || !query.isLoading,
    isSaving,
    saveRating,
  };
}
