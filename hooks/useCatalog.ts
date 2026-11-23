import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { queryKeys } from '@/services/queryKeys';
import {
  type CatalogFetchResult,
  fetchAllCatalogForProviders,
  fetchTitleDuration,
  findCachedRelatedTitle,
  getCachedTitleDuration,
  getCachedTitleTotalEpisodes,
  getCachedTitleTrailerUrl,
  getCachedTvSeasonEpisodes,
  getDevCatalogMetrics,
  hasCatalogBackend,
  loadRichTitleDetails,
  loadTitleById,
  loadTitleDuration,
  loadTitleTrailerUrl,
  loadTvSeasonEpisodes,
  raceWithAbort,
  searchCatalogTitles,
} from '@/services/tmdb';
import type { EpisodeSummary, MediaTitle, RichTitleDetails, SeasonSummary } from '@/types/media';
import { nowMs } from '@/utils/time';

export type CatalogStatus = 'loading' | 'ready' | 'needs-api-key' | 'error';

const EMPTY_TITLES: MediaTitle[] = [];
const EMPTY_EPISODES: EpisodeSummary[] = [];

const isDevRuntime = typeof __DEV__ !== 'undefined' && __DEV__;

let devFirstHookMountAt: number | null = null;
let devFirstUiBatchLogged = false;

export function useCatalog() {
  const { token } = useAuth();
  const hasAuthSession = Boolean(token);
  const { subscriptions, storageReady } = useSubscriptions();
  const queryClient = useQueryClient();

  const providerKey = useMemo(
    () =>
      Array.from(
        new Set(
          subscriptions
            .filter((subscription) => subscription.active)
            .map((subscription) => subscription.provider),
        ),
      )
        .sort()
        .join('|'),
    [subscriptions],
  );
  const activeProviders = useMemo(
    () => (providerKey ? providerKey.split('|') : []),
    [providerKey],
  );
  const catalogKey = useMemo(() => queryKeys.catalog(providerKey), [providerKey]);

  useEffect(() => {
    if (!isDevRuntime || !hasAuthSession || devFirstHookMountAt !== null) return;
    devFirstHookMountAt = nowMs();
  }, [hasAuthSession]);

  useEffect(() => {
    if (!storageReady) return;
    void queryClient.cancelQueries({
      queryKey: ['catalog'],
      predicate: (query) => query.queryKey[1] !== providerKey,
    });
  }, [providerKey, queryClient, storageReady]);

  const { data, isLoading, isFetching, isError } = useQuery<CatalogFetchResult>({
    queryKey: catalogKey,
    enabled: Boolean(hasAuthSession && storageReady && activeProviders.length > 0),
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 0,
    queryFn: ({ signal }) =>
      fetchAllCatalogForProviders(
        activeProviders,
        (batchTitles) => {
          if (!signal.aborted) {
            queryClient.setQueryData<CatalogFetchResult>(catalogKey, {
              titles: batchTitles,
              source: 'tmdb',
            });
          }
        },
        signal,
      ),
  });

  const titles = useMemo(
    () =>
      hasAuthSession && activeProviders.length > 0
        ? (data?.titles ?? EMPTY_TITLES)
        : EMPTY_TITLES,
    [activeProviders.length, data?.titles, hasAuthSession],
  );

  useEffect(() => {
    if (!isDevRuntime || !hasAuthSession || devFirstUiBatchLogged || titles.length === 0) return;
    devFirstUiBatchLogged = true;
    const now = nowMs();
    const metrics = getDevCatalogMetrics();
    const sinceMount = devFirstHookMountAt !== null ? Math.round(now - devFirstHookMountAt) : 0;
    const sinceFetch =
      metrics.lastFetchStartedAt !== null ? Math.round(now - metrics.lastFetchStartedAt) : 0;
    console.info(
      `[CatalogPerf] UI first batch visible in ${sinceMount}ms (sinceFetchStart=${sinceFetch}ms, titles=${titles.length}, providerKey="${providerKey}", bootFetchCount=${metrics.fetchCount})`,
    );
  }, [hasAuthSession, providerKey, titles.length]);

  const status: CatalogStatus = useMemo(() => {
    if (!hasAuthSession || !hasCatalogBackend()) {
      return 'needs-api-key';
    }
    if (!storageReady) {
      return 'loading';
    }
    if (activeProviders.length === 0) {
      return 'ready';
    }
    if (data?.source === 'static-fallback') {
      return isFetching ? 'loading' : data.reason === 'not-configured' ? 'needs-api-key' : 'error';
    }
    if (titles.length > 0) {
      return 'ready';
    }
    if (isLoading || isFetching) {
      return 'loading';
    }
    if (isError) {
      return 'error';
    }
    return data ? 'ready' : 'loading';
  }, [activeProviders.length, data, hasAuthSession, isError, isFetching, isLoading, storageReady, titles.length]);

  const errorMessage =
    hasAuthSession && data?.source === 'static-fallback' ? (data.errorMessage ?? null) : null;

  const titlesById = useMemo(() => {
    const map = new Map<string, MediaTitle>();
    for (const title of titles) {
      map.set(title.id, title);
    }
    return map;
  }, [titles]);

  const findTitle = useCallback(
    (id: string) =>
      titlesById.get(id) ??
      queryClient.getQueryData<MediaTitle>(queryKeys.titleById(id)) ??
      findCachedRelatedTitle(id),
    [queryClient, titlesById],
  );

  const refreshCatalog = useCallback(async () => {
    if (!hasAuthSession || !storageReady || activeProviders.length === 0) return;
    await queryClient.refetchQueries({ queryKey: catalogKey, exact: true });
  }, [activeProviders.length, catalogKey, hasAuthSession, queryClient, storageReady]);

  return {
    titles,
    status,
    isFetchingCatalog: Boolean(hasAuthSession && activeProviders.length > 0 && isFetching),
    errorMessage,
    refreshCatalog,
    findTitle,
  };
}

export function useCatalogSearch(rawQuery: string, debounceMs = 350) {
  const { token } = useAuth();
  const hasAuthSession = Boolean(token);
  const { subscriptions } = useSubscriptions();
  const queryClient = useQueryClient();

  const providerKey = useMemo(
    () =>
      Array.from(
        new Set(
          subscriptions
            .filter((subscription) => subscription.active)
            .map((subscription) => subscription.provider),
        ),
      )
        .sort()
        .join('|'),
    [subscriptions],
  );
  const activeProviders = useMemo(
    () => (providerKey ? providerKey.split('|') : []),
    [providerKey],
  );

  const [debouncedRaw, setDebouncedRaw] = useState('');
  const trimmedCurrent = rawQuery.trim();
  const normalizedCurrent = trimmedCurrent.toLocaleLowerCase();

  useEffect(() => {
    if (trimmedCurrent.length < 2) return;
    const timer = setTimeout(() => {
      setDebouncedRaw(trimmedCurrent);
    }, debounceMs);
    return () => {
      clearTimeout(timer);
    };
  }, [debounceMs, trimmedCurrent]);

  const normalizedDebounced =
    normalizedCurrent.length >= 2 && debouncedRaw.trim().length >= 2
      ? debouncedRaw.trim().toLocaleLowerCase()
      : '';
  const isMatch = normalizedCurrent.length >= 2 && normalizedDebounced === normalizedCurrent;

  const { data, isFetching, isError } = useQuery<MediaTitle[]>({
    queryKey: queryKeys.catalogSearch(normalizedDebounced, providerKey),
    enabled: Boolean(hasAuthSession && normalizedDebounced.length >= 2),
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 0,
    queryFn: async ({ signal }) => {
      const results = await searchCatalogTitles(normalizedDebounced, activeProviders, signal);
      for (const item of results) {
        queryClient.setQueryData<MediaTitle>(queryKeys.titleById(item.id), item);
      }
      return results;
    },
  });

  return {
    results: isMatch ? (data ?? EMPTY_TITLES) : EMPTY_TITLES,
    isSearching: Boolean(hasAuthSession && isMatch && isFetching),
    isMatch,
    errorMessage: isError ? 'Não foi possível pesquisar no catálogo online. Tente novamente.' : null,
  };
}

export function useTitleById(titleId: string, enabled = true) {
  return useQuery<MediaTitle | null>({
    queryKey: queryKeys.titleById(titleId),
    enabled: Boolean(enabled && titleId),
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 0,
    queryFn: ({ signal }) => raceWithAbort(loadTitleById(titleId), signal),
  });
}

export function useTitleQuickDetails(title: MediaTitle | null) {
  const titleId = title?.id ?? '';

  const durationQuery = useQuery<string>({
    queryKey: queryKeys.titleDuration(titleId),
    enabled: Boolean(title),
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 0,
    queryFn: async ({ signal }) => {
      if (!title) return '';
      const resolved = await raceWithAbort(loadTitleDuration(title), signal);
      return resolved || title.duration;
    },
  });

  const trailerQuery = useQuery<string | null>({
    queryKey: queryKeys.titleTrailerUrl(titleId),
    enabled: Boolean(title),
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 0,
    queryFn: ({ signal }) =>
      title ? raceWithAbort(loadTitleTrailerUrl(title), signal) : Promise.resolve(null),
  });

  const duration = title
    ? (durationQuery.data || getCachedTitleDuration(title))
    : undefined;
  const trailerUrl = title
    ? (trailerQuery.data !== undefined ? trailerQuery.data : getCachedTitleTrailerUrl(title))
    : null;

  return {
    duration,
    trailerUrl,
  };
}

export function useTitleDurationPrefetch() {
  const queryClient = useQueryClient();
  const [durationsById, setDurationsById] = useState<Record<string, string>>({});
  const fetchedDurationIdsRef = useRef(new Set<string>());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const prefetchDurations = useCallback(
    (items: readonly MediaTitle[]) => {
      for (const title of items) {
        const cached =
          queryClient.getQueryData<string>(queryKeys.titleDuration(title.id)) ??
          getCachedTitleDuration(title);
        if (title.duration || cached || fetchedDurationIdsRef.current.has(title.id)) {
          continue;
        }
        fetchedDurationIdsRef.current.add(title.id);
        void queryClient
          .fetchQuery<string>({
            queryKey: queryKeys.titleDuration(title.id),
            staleTime: 1000 * 60 * 30,
            gcTime: 1000 * 60 * 60,
            queryFn: ({ signal }) => raceWithAbort(loadTitleDuration(title), signal),
          })
          .then((resolved) => {
            if (!mountedRef.current || !resolved) return;
            setDurationsById((prev) =>
              prev[title.id] === resolved ? prev : { ...prev, [title.id]: resolved },
            );
          })
          .catch(() => {
            fetchedDurationIdsRef.current.delete(title.id);
          });
      }
    },
    [queryClient],
  );

  const getDuration = useCallback(
    (title: MediaTitle): string =>
      durationsById[title.id] ??
      queryClient.getQueryData<string>(queryKeys.titleDuration(title.id)) ??
      getCachedTitleDuration(title),
    [durationsById, queryClient],
  );

  return {
    prefetchDurations,
    getDuration,
  };
}

export function useTitlesDurations(titles: readonly MediaTitle[]) {
  const queryClient = useQueryClient();
  const titlesMissingDuration = useMemo(
    () => titles.filter((title) => !title.duration && !getCachedTitleDuration(title)),
    [titles],
  );

  const durationQueries = useQueries({
    queries: titlesMissingDuration.map((title) => ({
      queryKey: queryKeys.titleDuration(title.id),
      staleTime: 1000 * 60 * 30,
      gcTime: 1000 * 60 * 60,
      refetchOnWindowFocus: false,
      retry: 0,
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        raceWithAbort(loadTitleDuration(title), signal),
    })),
  });

  const resolvedById = useMemo(() => {
    const map: Record<string, string> = {};
    titlesMissingDuration.forEach((title, idx) => {
      const resolved = durationQueries[idx]?.data;
      if (resolved) {
        map[title.id] = resolved;
      }
    });
    return map;
  }, [durationQueries, titlesMissingDuration]);

  const getDuration = useCallback(
    (title: MediaTitle): string =>
      resolvedById[title.id] ??
      queryClient.getQueryData<string>(queryKeys.titleDuration(title.id)) ??
      getCachedTitleDuration(title),
    [queryClient, resolvedById],
  );

  return { getDuration };
}

export function useTitleTotalEpisodes(title: MediaTitle | undefined, enabled: boolean) {
  const cachedTotal = title ? getCachedTitleTotalEpisodes(title.id) : null;
  const { data: queriedTotal } = useQuery<number | null>({
    queryKey: queryKeys.titleTotalEpisodes(title?.id ?? ''),
    enabled: Boolean(title && enabled && cachedTotal === null),
    staleTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    retry: 0,
    queryFn: async ({ signal }) => {
      if (!title) return null;
      await fetchTitleDuration(title, signal);
      return getCachedTitleTotalEpisodes(title.id);
    },
  });

  return cachedTotal ?? queriedTotal ?? null;
}

export function useTitlesByIds(
  ids: readonly string[],
  options: {
    enabled: boolean;
    resolveKnown?: (id: string) => MediaTitle | undefined;
  },
) {
  const { enabled, resolveKnown } = options;
  const queryClient = useQueryClient();

  const missingIds = useMemo(
    () =>
      ids.filter(
        (id) =>
          !resolveKnown?.(id) &&
          !queryClient.getQueryData<MediaTitle>(queryKeys.titleById(id)) &&
          !findCachedRelatedTitle(id),
      ),
    [ids, queryClient, resolveKnown],
  );

  const queries = useQueries({
    queries: missingIds.map((id) => ({
      queryKey: queryKeys.titleById(id),
      enabled,
      staleTime: 1000 * 60 * 30,
      gcTime: 1000 * 60 * 60,
      refetchOnWindowFocus: false,
      retry: 0,
      queryFn: ({ signal }: { signal: AbortSignal }) => raceWithAbort(loadTitleById(id), signal),
    })),
  });

  const fetchedById = useMemo(() => {
    const map: Record<string, MediaTitle> = {};
    missingIds.forEach((id, idx) => {
      const resolved = queries[idx]?.data;
      if (resolved) {
        map[id] = resolved;
      }
    });
    return map;
  }, [missingIds, queries]);

  const resolveTitle = useCallback(
    (id: string): MediaTitle | undefined =>
      resolveKnown?.(id) ??
      queryClient.getQueryData<MediaTitle>(queryKeys.titleById(id)) ??
      findCachedRelatedTitle(id) ??
      fetchedById[id],
    [fetchedById, queryClient, resolveKnown],
  );

  return { resolveTitle };
}

export function useTitleDetails(title: MediaTitle | undefined) {
  const queryClient = useQueryClient();
  const titleId = title?.id ?? '';

  const query = useQuery<RichTitleDetails | null>({
    queryKey: queryKeys.titleDetails(titleId),
    enabled: Boolean(titleId),
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 0,
    queryFn: ({ signal }) =>
      title
        ? raceWithAbort(loadRichTitleDetails(title, { throwOnError: true }), signal)
        : Promise.resolve(null),
  });

  const cachedDuration = title
    ? (queryClient.getQueryData<string>(queryKeys.titleDuration(title.id)) ??
      getCachedTitleDuration(title))
    : '';

  return {
    details: query.data ?? null,
    cachedDuration,
    isLoading: query.isLoading || (query.isFetching && query.data === undefined),
    error:
      query.error && !query.isFetching
        ? 'Não foi possível carregar detalhes adicionais no momento.'
        : null,
    refetch: query.refetch,
  };
}

export function useSeasonEpisodes(
  titleId: string,
  seasonNumber: number | null,
  enabled = true,
  seasons?: readonly SeasonSummary[],
) {
  const queryClient = useQueryClient();
  const validSeason = seasonNumber !== null && seasonNumber > 0 ? seasonNumber : 0;

  const query = useQuery<EpisodeSummary[]>({
    queryKey: queryKeys.seasonEpisodes(titleId, validSeason),
    enabled: Boolean(enabled && titleId && validSeason > 0),
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 0,
    queryFn: ({ signal }) =>
      raceWithAbort(loadTvSeasonEpisodes(titleId, validSeason, { throwOnError: true }), signal),
  });

  const episodes = query.data ?? EMPTY_EPISODES;

  const episodesBySeason = useMemo(() => {
    const base: Partial<Record<number, EpisodeSummary[]>> = {};
    if (titleId && seasons) {
      for (const season of seasons) {
        const queryCached = queryClient.getQueryData<EpisodeSummary[]>(
          queryKeys.seasonEpisodes(titleId, season.seasonNumber),
        );
        const cached = queryCached ?? getCachedTvSeasonEpisodes(titleId, season.seasonNumber);
        if (cached) {
          base[season.seasonNumber] = cached;
        }
      }
    }
    if (validSeason > 0 && episodes.length > 0) {
      base[validSeason] = episodes;
    }
    return base;
  }, [episodes, queryClient, seasons, titleId, validSeason]);

  return {
    episodes,
    episodesBySeason,
    isLoading: query.isLoading || (query.isFetching && query.data === undefined),
    error: query.error && !query.isFetching ? 'Não foi possível carregar os episódios.' : null,
    refetch: query.refetch,
  };
}
