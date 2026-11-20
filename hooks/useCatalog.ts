import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { MediaTitle } from '@/constants/catalog';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { queryKeys } from '@/services/queryKeys';
import {
  type CatalogFetchResult,
  fetchAllCatalogForProviders,
  fetchRichTitleDetails,
  fetchTitleById,
  fetchTvSeasonEpisodes,
  getCachedRichTitleDetails,
  getCachedTvSeasonEpisodes,
  hasCatalogBackend,
  searchCatalogTitles,
} from '@/services/tmdb';
import type { EpisodeSummary, RichTitleDetails } from '@/types/media';

export type CatalogStatus = 'loading' | 'ready' | 'needs-api-key' | 'error';

const EMPTY_TITLES: MediaTitle[] = [];
const EMPTY_EPISODES: EpisodeSummary[] = [];

export function useCatalog() {
  const { token } = useAuth();
  const hasAuthSession = Boolean(token);
  const { subscriptions, storageReady } = useSubscriptions();
  const queryClient = useQueryClient();

  const activeProviders = useMemo(
    () =>
      subscriptions
        .filter((subscription) => subscription.active)
        .map((subscription) => subscription.provider)
        .sort(),
    [subscriptions],
  );
  const providerKey = useMemo(() => activeProviders.join('|'), [activeProviders]);
  const catalogKey = useMemo(() => queryKeys.catalog(providerKey), [providerKey]);

  const { data, isLoading, isFetching, isError } = useQuery<CatalogFetchResult>({
    queryKey: catalogKey,
    enabled: Boolean(hasAuthSession && storageReady),
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
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
        () => signal.aborted,
      ),
  });

  const titles = useMemo(
    () => (hasAuthSession ? (data?.titles ?? EMPTY_TITLES) : EMPTY_TITLES),
    [data?.titles, hasAuthSession],
  );

  const status: CatalogStatus = useMemo(() => {
    if (!hasAuthSession || !hasCatalogBackend()) {
      return 'needs-api-key';
    }
    if (!storageReady || isLoading || (isFetching && data?.source !== 'tmdb')) {
      return 'loading';
    }
    if (data?.source === 'static-fallback') {
      return data.reason === 'not-configured' ? 'needs-api-key' : 'error';
    }
    if (isError) {
      return 'error';
    }
    return data ? 'ready' : 'loading';
  }, [data, hasAuthSession, isError, isFetching, isLoading, storageReady]);

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
      titlesById.get(id) ?? queryClient.getQueryData<MediaTitle>(queryKeys.titleById(id)),
    [queryClient, titlesById],
  );

  const refreshCatalog = useCallback(async () => {
    if (!hasAuthSession || !storageReady) return;
    await queryClient.refetchQueries({ queryKey: catalogKey, exact: true });
  }, [catalogKey, hasAuthSession, queryClient, storageReady]);

  return {
    titles,
    status,
    isFetchingCatalog: hasAuthSession && isFetching,
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

  const activeProviders = useMemo(
    () =>
      subscriptions
        .filter((subscription) => subscription.active)
        .map((subscription) => subscription.provider)
        .sort(),
    [subscriptions],
  );
  const providerKey = useMemo(() => activeProviders.join('|'), [activeProviders]);

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
    retry: 0,
    queryFn: async () => {
      const results = await searchCatalogTitles(normalizedDebounced, activeProviders);
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
    retry: 0,
    queryFn: () => fetchTitleById(titleId),
  });
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
    retry: 0,
    initialData: () => (title ? (getCachedRichTitleDetails(title.id) ?? undefined) : undefined),
    queryFn: async () => {
      if (!title) return null;
      const details = await fetchRichTitleDetails(title, { throwOnError: true });
      if (details) {
        for (const related of details.similarTitles) {
          queryClient.setQueryData<MediaTitle>(queryKeys.titleById(related.id), related);
        }
      }
      return details;
    },
  });

  return {
    details: query.data ?? null,
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
) {
  const validSeason = seasonNumber !== null && seasonNumber > 0 ? seasonNumber : 0;

  const query = useQuery<EpisodeSummary[]>({
    queryKey: queryKeys.seasonEpisodes(titleId, validSeason),
    enabled: Boolean(enabled && titleId && validSeason > 0),
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    retry: 0,
    initialData: () =>
      titleId && validSeason > 0
        ? (getCachedTvSeasonEpisodes(titleId, validSeason) ?? undefined)
        : undefined,
    queryFn: () => fetchTvSeasonEpisodes(titleId, validSeason, { throwOnError: true }),
  });

  return {
    episodes: query.data ?? EMPTY_EPISODES,
    isLoading: query.isLoading || (query.isFetching && query.data === undefined),
    error: query.error && !query.isFetching ? 'Não foi possível carregar os episódios.' : null,
    refetch: query.refetch,
  };
}
