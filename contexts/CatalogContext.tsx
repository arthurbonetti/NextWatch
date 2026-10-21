import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { CATALOG, MediaTitle } from '@/constants/catalog';
import { useSubscriptions } from '@/contexts/SubscriptionsContext';
import { fetchCatalogPage, fetchCatalogPageForProviders, hasTmdbApiKey, searchCatalogTitles } from '@/services/tmdb';
import { quickSortByRandom } from '@/utils/quickSort';

export type CatalogStatus = 'loading' | 'ready' | 'needs-api-key' | 'error';

type CatalogContextValue = {
  titles: MediaTitle[];
  status: CatalogStatus;
  errorMessage: string | null;
  totalResults: number;
  hasMore: boolean;
  loadingMore: boolean;
  refreshCatalog: () => Promise<void>;
  loadMoreTitles: () => Promise<void>;
  searchTitles: (query: string) => Promise<MediaTitle[]>;
  findTitle: (id: string) => MediaTitle | undefined;
};

const CatalogContext = createContext<CatalogContextValue | null>(null);

export function CatalogProvider({ children }: PropsWithChildren) {
  const { subscriptions, storageReady } = useSubscriptions();
  const providerNames = subscriptions
    .filter((subscription) => subscription.active)
    .map((subscription) => subscription.provider);
  const providerKey = providerNames.slice().sort().join('|');
  const currentProviderKeyRef = useRef(providerKey);
  currentProviderKeyRef.current = providerKey;
  const [remoteTitles, setRemoteTitles] = useState<MediaTitle[] | null>(null);
  const [remoteProviderKey, setRemoteProviderKey] = useState('');
  const [remoteProviderIds, setRemoteProviderIds] = useState<number[]>([]);
  const [remotePage, setRemotePage] = useState(0);
  const [remoteTotalPages, setRemoteTotalPages] = useState(0);
  const [totalResults, setTotalResults] = useState(0);
  const [status, setStatus] = useState<CatalogStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sessionCatalog] = useState(() => quickSortByRandom(CATALOG));
  const [searchedTitles, setSearchedTitles] = useState<MediaTitle[]>([]);
  const initialRemoteShuffleRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const requestVersionRef = useRef(0);
  const searchCacheRef = useRef(new Map<string, MediaTitle[]>());

  const refreshCatalog = useCallback(async () => {
    if (!storageReady) return;
    const requestVersion = ++requestVersionRef.current;
    if (!hasTmdbApiKey()) {
      setStatus('needs-api-key');
      setErrorMessage(null);
      return;
    }

    setStatus('loading');
    setErrorMessage(null);
    try {
      const firstPage = await fetchCatalogPageForProviders(providerKey ? providerKey.split('|') : [], 1);
      if (requestVersionRef.current !== requestVersion || currentProviderKeyRef.current !== providerKey) return;
      const orderedFirstPage = initialRemoteShuffleRef.current
        ? firstPage.titles
        : quickSortByRandom(firstPage.titles);
      initialRemoteShuffleRef.current = true;
      setRemoteTitles(orderedFirstPage);
      setRemoteProviderKey(providerKey);
      setRemoteProviderIds(firstPage.providerIds);
      setRemotePage(1);
      setRemoteTotalPages(firstPage.totalPages);
      setTotalResults(firstPage.totalResults);
      setStatus('ready');
    } catch (error) {
      if (requestVersionRef.current !== requestVersion || currentProviderKeyRef.current !== providerKey) return;
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível atualizar o catálogo do TMDB.');
    }
  }, [providerKey, storageReady]);

  const loadMoreTitles = useCallback(async () => {
    if (
      loadingMoreRef.current
      || !remoteTitles
      || remoteProviderKey !== providerKey
      || remotePage >= remoteTotalPages
    ) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);
    setErrorMessage(null);
    const nextPage = remotePage + 1;
    const requestVersion = requestVersionRef.current;
    try {
      const next = await fetchCatalogPage(remoteProviderIds, nextPage);
      if (requestVersionRef.current !== requestVersion || currentProviderKeyRef.current !== providerKey) return;
      setRemoteTitles((current) => {
        if (remoteProviderKey !== providerKey || !current) return current;
        const merged = new Map(current.map((title) => [title.id, title]));
        for (const title of next.titles) merged.set(title.id, title);
        return Array.from(merged.values());
      });
      setRemotePage(nextPage);
      setErrorMessage(null);
    } catch (error) {
      if (requestVersionRef.current !== requestVersion || currentProviderKeyRef.current !== providerKey) return;
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível carregar mais títulos do TMDB.');
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [providerKey, remotePage, remoteProviderIds, remoteProviderKey, remoteTitles, remoteTotalPages]);

  const searchTitles = useCallback(async (query: string) => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (normalizedQuery.length < 2 || !hasTmdbApiKey()) return [];
    const cachedResults = searchCacheRef.current.get(normalizedQuery);
    if (cachedResults) {
      setSearchedTitles((current) => mergeTitles(current, cachedResults));
      return cachedResults;
    }

    const results = await searchCatalogTitles(normalizedQuery);
    searchCacheRef.current.set(normalizedQuery, results);
    setSearchedTitles((current) => mergeTitles(current, results));
    return results;
  }, []);

  useEffect(() => {
    initialRemoteShuffleRef.current = false;
  }, [providerKey]);

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  const value = useMemo<CatalogContextValue>(() => ({
    titles: remoteTitles && remoteProviderKey === providerKey ? remoteTitles : sessionCatalog,
    status,
    errorMessage,
    totalResults: remoteProviderKey === providerKey ? totalResults : 0,
    hasMore: remoteProviderKey === providerKey && remotePage < remoteTotalPages,
    loadingMore,
    refreshCatalog,
    loadMoreTitles,
    searchTitles,
    findTitle: (id) => [...(remoteTitles ?? []), ...searchedTitles, ...sessionCatalog].find((title) => title.id === id),
  }), [errorMessage, loadMoreTitles, loadingMore, providerKey, refreshCatalog, remotePage, remoteProviderKey, remoteTitles, remoteTotalPages, searchedTitles, searchTitles, sessionCatalog, status, totalResults]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

function mergeTitles(current: MediaTitle[], additions: MediaTitle[]) {
  const merged = new Map(current.map((title) => [title.id, title]));
  for (const title of additions) merged.set(title.id, title);
  return Array.from(merged.values());
}

export function useCatalog() {
  const context = useContext(CatalogContext);
  if (!context) throw new Error('useCatalog must be used within CatalogProvider');
  return context;
}
