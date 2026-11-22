import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { queryKeys } from '@/services/queryKeys';
import {
  deleteSeriesProgress,
  fetchAllWatchedProgress,
  fetchSeriesProgress,
  sanitizeProgressObject,
  upsertSeriesProgress,
} from '@/services/repositories/progressRepo';
import { hasSupabaseConfig } from '@/services/supabase';
import {
  applyEpisodeToggle,
  applySeasonToggle,
  mergeWatchedProgress,
  type SeriesProgressMap,
} from '@/utils/watchedProgress';

const BASE_STORAGE_KEY = '@nextwatch/series-progress';
const PENDING_SYNC_PREFIX = '@nextwatch/series-progress-pending';
const EMPTY_MAP: SeriesProgressMap = {};
const EMPTY_IDS: string[] = [];
const EMPTY_BY_TITLE: Record<string, SeriesProgressMap> = {};

type WatchedProgressData = {
  ids: string[];
  byTitleId: Record<string, SeriesProgressMap>;
};

type ProgressMutationInput = {
  updater: (prev: SeriesProgressMap) => SeriesProgressMap;
  resolvedMap?: SeriesProgressMap;
};

type ProgressMutationOutcome = 'ok' | 'retry' | 'offline';

function parseProgressMap(raw: string | null): SeriesProgressMap {
  if (!raw) return EMPTY_MAP;
  try {
    return sanitizeProgressObject(JSON.parse(raw));
  } catch {
    return EMPTY_MAP;
  }
}

async function syncSeriesProgressEntry(
  userId: string,
  titleId: string,
  storageKey: string,
  pendingKey: string,
  hasToken: boolean,
  signal: AbortSignal,
): Promise<SeriesProgressMap> {
  const [rawLocal, rawPending] = await Promise.all([
    AsyncStorage.getItem(storageKey).catch(() => null),
    AsyncStorage.getItem(pendingKey).catch(() => null),
  ]);

  const localMap = parseProgressMap(rawLocal);
  if (!hasToken || !hasSupabaseConfig() || signal.aborted) {
    return localMap;
  }

  if (rawPending === '1') {
    const outcome =
      Object.keys(localMap).length === 0
        ? await deleteSeriesProgress(userId, titleId)
        : await upsertSeriesProgress(userId, titleId, localMap);

    if (!signal.aborted && (outcome === 'ok' || outcome === 'drop')) {
      await AsyncStorage.removeItem(pendingKey).catch(() => {});
    }
    return localMap;
  }

  const remote = await fetchSeriesProgress(userId, titleId);
  if (signal.aborted || !remote) {
    return localMap;
  }

  if (remote.found) {
    await AsyncStorage.setItem(storageKey, JSON.stringify(remote.map)).catch(() => {});
    return remote.map;
  }

  if (Object.keys(localMap).length > 0) {
    // Migra progresso salvo apenas localmente antes da sincronização em nuvem.
    const outcome = await upsertSeriesProgress(userId, titleId, localMap);
    if (outcome === 'retry') {
      await AsyncStorage.setItem(pendingKey, '1').catch(() => {});
    }
  }
  return localMap;
}

async function readLocalWatchedProgress(scope: string): Promise<{
  localById: Record<string, SeriesProgressMap>;
  pendingIds: Set<string>;
}> {
  const localPrefix = `${BASE_STORAGE_KEY}:${scope}:`;
  const pendingPrefix = `${PENDING_SYNC_PREFIX}:${scope}:`;
  const localById: Record<string, SeriesProgressMap> = {};
  const pendingIds = new Set<string>();

  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const relevantKeys = allKeys.filter(
      (key) => key.startsWith(localPrefix) || key.startsWith(pendingPrefix),
    );
    if (relevantKeys.length > 0) {
      const entries = await AsyncStorage.multiGet(relevantKeys);
      for (const [key, raw] of entries) {
        if (key.startsWith(pendingPrefix)) {
          if (raw === '1') {
            pendingIds.add(key.slice(pendingPrefix.length));
          }
        } else if (key.startsWith(localPrefix)) {
          localById[key.slice(localPrefix.length)] = parseProgressMap(raw);
        }
      }
    }
  } catch {
    // ignora erro de leitura local
  }

  return { localById, pendingIds };
}

function updateWatchedCacheEntry(
  current: WatchedProgressData | undefined,
  titleId: string,
  nextMap: SeriesProgressMap,
): WatchedProgressData | undefined {
  if (!current) return current;
  const hasEntries = Object.keys(nextMap).length > 0;
  const nextByTitleId = { ...current.byTitleId };
  let nextIds = current.ids;

  if (hasEntries) {
    nextByTitleId[titleId] = nextMap;
    if (!nextIds.includes(titleId)) {
      nextIds = [titleId, ...nextIds];
    }
  } else {
    delete nextByTitleId[titleId];
    if (nextIds.includes(titleId)) {
      nextIds = nextIds.filter((id) => id !== titleId);
    }
  }

  return { ids: nextIds, byTitleId: nextByTitleId };
}

export function useSeriesProgress(
  userId: string | null,
  titleId: string,
  token: string | null = null,
) {
  const hasToken = Boolean(token);
  const scope = userId ?? 'guest';
  const storageKey = `${BASE_STORAGE_KEY}:${scope}:${titleId}`;
  const pendingKey = `${PENDING_SYNC_PREFIX}:${scope}:${titleId}`;

  const queryClient = useQueryClient();
  const authQueryKey = useMemo(
    () => queryKeys.seriesProgress(userId, titleId),
    [titleId, userId],
  );
  const guestQueryKey = useMemo(() => queryKeys.seriesProgressGuest(titleId), [titleId]);
  const activeQueryKey = userId ? authQueryKey : guestQueryKey;
  const watchedQueryKey = useMemo(
    () => (userId ? queryKeys.watchedProgressIds(userId) : queryKeys.watchedProgressIdsGuest()),
    [userId],
  );

  const authQuery = useQuery<SeriesProgressMap>({
    queryKey: authQueryKey,
    enabled: Boolean(userId && titleId),
    staleTime: 30_000,
    queryFn: ({ signal }) =>
      syncSeriesProgressEntry(userId!, titleId, storageKey, pendingKey, hasToken, signal),
  });

  const guestQuery = useQuery<SeriesProgressMap>({
    queryKey: guestQueryKey,
    enabled: Boolean(!userId && titleId),
    staleTime: Infinity,
    queryFn: async () => {
      const rawLocal = await AsyncStorage.getItem(storageKey).catch(() => null);
      return parseProgressMap(rawLocal);
    },
  });

  const activeQuery = userId ? authQuery : guestQuery;
  const activeMap = titleId ? (activeQuery.data ?? EMPTY_MAP) : EMPTY_MAP;

  const { mutate: mutateProgress } = useMutation<
    ProgressMutationOutcome,
    Error,
    ProgressMutationInput,
    {
      previous: SeriesProgressMap | undefined;
      previousWatched: WatchedProgressData | undefined;
    }
  >({
    mutationFn: async (input) => {
      const nextMap = input.resolvedMap ?? EMPTY_MAP;
      if (!userId || !titleId || !hasToken || !hasSupabaseConfig()) {
        return 'offline';
      }

      await AsyncStorage.setItem(pendingKey, '1').catch(() => {});
      const outcome =
        Object.keys(nextMap).length === 0
          ? await deleteSeriesProgress(userId, titleId)
          : await upsertSeriesProgress(userId, titleId, nextMap);

      if (outcome === 'drop') {
        await AsyncStorage.removeItem(pendingKey).catch(() => {});
        throw new Error('Não foi possível salvar o progresso da série.');
      }

      if (outcome === 'ok') {
        const latestCached = queryClient.getQueryData<SeriesProgressMap>(activeQueryKey);
        if (latestCached === nextMap) {
          await AsyncStorage.removeItem(pendingKey).catch(() => {});
        }
      }
      return outcome;
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: activeQueryKey });
      const previous = queryClient.getQueryData<SeriesProgressMap>(activeQueryKey);
      const previousWatched = queryClient.getQueryData<WatchedProgressData>(watchedQueryKey);
      const nextMap = input.updater(previous ?? EMPTY_MAP);
      input.resolvedMap = nextMap;

      queryClient.setQueryData<SeriesProgressMap>(activeQueryKey, nextMap);
      queryClient.setQueryData<WatchedProgressData | undefined>(watchedQueryKey, (current) =>
        updateWatchedCacheEntry(current, titleId, nextMap),
      );
      void AsyncStorage.setItem(storageKey, JSON.stringify(nextMap)).catch(() => {});
      if (userId) {
        void AsyncStorage.setItem(pendingKey, '1').catch(() => {});
      }

      return { previous, previousWatched };
    },
    onError: (_error, _input, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData<SeriesProgressMap>(activeQueryKey, context.previous);
        void AsyncStorage.setItem(storageKey, JSON.stringify(context.previous)).catch(() => {});
      }
      if (context?.previousWatched !== undefined) {
        queryClient.setQueryData<WatchedProgressData>(watchedQueryKey, context.previousWatched);
      }
    },
    onSettled: (outcome) => {
      if (outcome === 'ok' && userId && hasToken) {
        void queryClient.invalidateQueries({ queryKey: activeQueryKey });
        void queryClient.invalidateQueries({ queryKey: watchedQueryKey });
      }
    },
  });

  const isEpisodeWatched = useCallback(
    (seasonNumber: number, episodeNumber: number): boolean => {
      const episodes = activeMap[String(seasonNumber)];
      return episodes ? episodes.includes(episodeNumber) : false;
    },
    [activeMap],
  );

  const getSeasonWatchedCount = useCallback(
    (seasonNumber: number): number => {
      return activeMap[String(seasonNumber)]?.length ?? 0;
    },
    [activeMap],
  );

  const isSeasonCompleted = useCallback(
    (seasonNumber: number, episodeCount: number): boolean => {
      if (episodeCount <= 0) return false;
      return (activeMap[String(seasonNumber)]?.length ?? 0) >= episodeCount;
    },
    [activeMap],
  );

  const toggleEpisode = useCallback(
    (seasonNumber: number, episodeNumber: number) => {
      if (!titleId) return;
      mutateProgress({
        updater: (prev) => applyEpisodeToggle(prev, seasonNumber, episodeNumber),
      });
    },
    [mutateProgress, titleId],
  );

  const toggleSeason = useCallback(
    (seasonNumber: number, episodeCount: number, episodeNumbers?: number[]) => {
      if (!titleId) return;
      const targetNumbers =
        episodeNumbers && episodeNumbers.length > 0
          ? Array.from(new Set(episodeNumbers)).sort((a, b) => a - b)
          : Array.from({ length: Math.max(0, episodeCount) }, (_, idx) => idx + 1);

      if (targetNumbers.length === 0) return;

      mutateProgress({
        updater: (prev) => applySeasonToggle(prev, seasonNumber, episodeCount, targetNumbers),
      });
    },
    [mutateProgress, titleId],
  );

  const totalWatchedEpisodes = useMemo(() => {
    let total = 0;
    for (const episodes of Object.values(activeMap)) {
      total += episodes.length;
    }
    return total;
  }, [activeMap]);

  return {
    ready: Boolean(titleId) && !activeQuery.isLoading,
    progressMap: activeMap,
    isEpisodeWatched,
    getSeasonWatchedCount,
    isSeasonCompleted,
    toggleEpisode,
    toggleSeason,
    totalWatchedEpisodes,
  };
}

/** Lista IDs e mapas de progresso de obras com registros marcados (local + nuvem). */
export function useWatchedProgressIds(userId: string | null, token: string | null) {
  const hasToken = Boolean(token);
  const queryClient = useQueryClient();
  const authQueryKey = useMemo(() => queryKeys.watchedProgressIds(userId), [userId]);
  const guestQueryKey = useMemo(() => queryKeys.watchedProgressIdsGuest(), []);
  const activeKey = userId ? authQueryKey : guestQueryKey;

  const authQuery = useQuery<WatchedProgressData>({
    queryKey: authQueryKey,
    enabled: Boolean(userId),
    staleTime: 30_000,
    queryFn: async ({ signal }) => {
      const { localById, pendingIds } = await readLocalWatchedProgress(userId!);
      if (!hasToken || !hasSupabaseConfig() || signal.aborted) {
        return mergeWatchedProgress(localById, [], pendingIds);
      }
      const remoteRows = (await fetchAllWatchedProgress(userId!)) ?? [];
      if (signal.aborted) {
        return mergeWatchedProgress(localById, [], pendingIds);
      }
      return mergeWatchedProgress(localById, remoteRows, pendingIds);
    },
  });

  const guestQuery = useQuery<WatchedProgressData>({
    queryKey: guestQueryKey,
    enabled: !userId,
    staleTime: Infinity,
    queryFn: async () => {
      const { localById, pendingIds } = await readLocalWatchedProgress('guest');
      return mergeWatchedProgress(localById, [], pendingIds);
    },
  });

  const activeQuery = userId ? authQuery : guestQuery;

  const refreshProgressIds = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: activeKey });
  }, [activeKey, queryClient]);

  return {
    progressTitleIds: activeQuery.data?.ids ?? EMPTY_IDS,
    progressByTitleId: activeQuery.data?.byTitleId ?? EMPTY_BY_TITLE,
    progressReady: !activeQuery.isLoading,
    refreshProgressIds,
  };
}
