import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import type { MediaTitle } from '@/constants/catalog';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscriptions } from '@/contexts/SubscriptionsContext';
import {
  fetchAllCatalogForProviders,
  hasCatalogBackend,
  searchCatalogTitles,
} from '@/services/tmdb';

export type CatalogStatus = 'loading' | 'ready' | 'needs-api-key' | 'error';

type CatalogContextValue = {
  titles: MediaTitle[];
  status: CatalogStatus;
  isFetchingCatalog: boolean;
  errorMessage: string | null;
  refreshCatalog: () => Promise<void>;
  searchTitles: (query: string) => Promise<MediaTitle[]>;
  findTitle: (id: string) => MediaTitle | undefined;
};

const MAX_SEARCH_CACHE_ENTRIES = 50;

const CatalogContext = createContext<CatalogContextValue | null>(null);

export function CatalogProvider({ children }: PropsWithChildren) {
  const { token } = useAuth();
  const hasAuthSession = Boolean(token);
  const { subscriptions, storageReady } = useSubscriptions();
  const providerKey = subscriptions
    .filter((subscription) => subscription.active)
    .map((subscription) => subscription.provider)
    .sort()
    .join('|');
  const activeProvidersRef = useRef<string[]>([]);
  const [prevHasAuthSession, setPrevHasAuthSession] = useState(hasAuthSession);
  const [remoteTitles, setRemoteTitles] = useState<MediaTitle[] | null>(null);
  const [remoteProviderKey, setRemoteProviderKey] = useState('');
  const [status, setStatus] = useState<CatalogStatus>(() => (hasAuthSession && hasCatalogBackend() ? 'loading' : 'needs-api-key'));
  const [isFetchingCatalog, setIsFetchingCatalog] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchedTitles, setSearchedTitles] = useState<MediaTitle[]>([]);
  const requestVersionRef = useRef(0);
  const searchCacheRef = useRef(new Map<string, MediaTitle[]>());

  if (prevHasAuthSession !== hasAuthSession) {
    setPrevHasAuthSession(hasAuthSession);
    if (!hasAuthSession) {
      setRemoteTitles(null);
      setRemoteProviderKey('');
      setSearchedTitles([]);
      setStatus('needs-api-key');
      setIsFetchingCatalog(false);
      setErrorMessage(null);
    }
  }

  useEffect(() => {
    activeProvidersRef.current = providerKey ? providerKey.split('|') : [];
    searchCacheRef.current.clear();
  }, [providerKey]);

  useEffect(() => {
    if (!hasAuthSession) {
      requestVersionRef.current += 1;
      searchCacheRef.current.clear();
    }
  }, [hasAuthSession]);

  const executeCatalogRefresh = useCallback(async () => {
    if (!storageReady) return;
    const requestVersion = ++requestVersionRef.current;

    if (!hasAuthSession) {
      setStatus('needs-api-key');
      setIsFetchingCatalog(false);
      setErrorMessage(null);
      return;
    }

    setStatus('loading');
    setIsFetchingCatalog(true);
    setErrorMessage(null);
    const shouldAbort = () => requestVersionRef.current !== requestVersion;

    const result = await fetchAllCatalogForProviders(
      providerKey ? providerKey.split('|') : [],
      (batchTitles) => {
        if (shouldAbort()) return;
        setRemoteTitles(batchTitles);
        setRemoteProviderKey(providerKey);
        setStatus('ready');
      },
      shouldAbort,
    );

    if (shouldAbort()) return;

    setRemoteTitles(result.titles);
    setRemoteProviderKey(providerKey);
    setIsFetchingCatalog(false);
    if (result.source === 'static-fallback') {
      setStatus(result.reason === 'not-configured' ? 'needs-api-key' : 'error');
      setErrorMessage(result.errorMessage ?? null);
    } else {
      setStatus('ready');
    }
  }, [hasAuthSession, providerKey, storageReady]);

  const searchTitles = useCallback(async (query: string) => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (normalizedQuery.length < 2) return [];
    const cachedResults = searchCacheRef.current.get(normalizedQuery);
    if (cachedResults) {
      setSearchedTitles((current) => mergeTitles(current, cachedResults));
      return cachedResults;
    }

    const results = await searchCatalogTitles(normalizedQuery, activeProvidersRef.current);
    if (searchCacheRef.current.size >= MAX_SEARCH_CACHE_ENTRIES) {
      const oldestKey = searchCacheRef.current.keys().next().value;
      if (oldestKey !== undefined) {
        searchCacheRef.current.delete(oldestKey);
      }
    }
    searchCacheRef.current.set(normalizedQuery, results);
    setSearchedTitles((current) => mergeTitles(current, results));
    return results;
  }, []);

  useEffect(() => {
    if (!storageReady || !hasAuthSession) return;
    const timer = setTimeout(() => {
      void executeCatalogRefresh();
    }, 0);
    return () => clearTimeout(timer);
  }, [executeCatalogRefresh, hasAuthSession, storageReady]);

  const activeTitles = useMemo(() => {
    if (remoteTitles && remoteProviderKey === providerKey) {
      return remoteTitles;
    }
    return [];
  }, [providerKey, remoteProviderKey, remoteTitles]);

  const titlesById = useMemo(() => {
    const map = new Map<string, MediaTitle>();
    for (const title of searchedTitles) map.set(title.id, title);
    for (const title of activeTitles) map.set(title.id, title);
    return map;
  }, [activeTitles, searchedTitles]);

  const findTitle = useCallback(
    (id: string) => titlesById.get(id),
    [titlesById],
  );

  const value = useMemo<CatalogContextValue>(() => ({
    titles: activeTitles,
    status,
    isFetchingCatalog,
    errorMessage,
    refreshCatalog: executeCatalogRefresh,
    searchTitles,
    findTitle,
  }), [activeTitles, errorMessage, executeCatalogRefresh, findTitle, isFetchingCatalog, searchTitles, status]);

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
