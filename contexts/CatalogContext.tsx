import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { CATALOG, MediaTitle } from '@/constants/catalog';
import { useSubscriptions } from '@/contexts/SubscriptionsContext';
import { fetchAllCatalogForProviders, hasTmdbApiKey, searchCatalogTitles } from '@/services/tmdb';
import { quickSortByRandom } from '@/utils/quickSort';

export type CatalogStatus = 'loading' | 'ready' | 'needs-api-key' | 'error';

type CatalogContextValue = {
  titles: MediaTitle[];
  status: CatalogStatus;
  errorMessage: string | null;
  totalResults: number;
  refreshCatalog: () => Promise<void>;
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
  const [totalResults, setTotalResults] = useState(0);
  const [status, setStatus] = useState<CatalogStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionCatalog] = useState(() => quickSortByRandom(CATALOG));
  const [searchedTitles, setSearchedTitles] = useState<MediaTitle[]>([]);
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
    const shouldAbort = () =>
      requestVersionRef.current !== requestVersion || currentProviderKeyRef.current !== providerKey;

    try {
      await fetchAllCatalogForProviders(
        providerKey ? providerKey.split('|') : [],
        (batchTitles, batchTotal) => {
          if (shouldAbort()) return;
          setRemoteTitles(batchTitles);
          setRemoteProviderKey(providerKey);
          setTotalResults(batchTotal);
          setStatus('ready');
        },
        shouldAbort,
      );
    } catch (error) {
      if (shouldAbort()) return;
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível atualizar o catálogo do TMDB.');
    }
  }, [providerKey, storageReady]);

  const searchTitles = useCallback(async (query: string) => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (normalizedQuery.length < 2 || !hasTmdbApiKey()) return [];
    const cachedResults = searchCacheRef.current.get(normalizedQuery);
    if (cachedResults) {
      setSearchedTitles((current) => mergeTitles(current, cachedResults));
      return cachedResults;
    }

    const activeProviders = currentProviderKeyRef.current ? currentProviderKeyRef.current.split('|') : [];
    const results = await searchCatalogTitles(normalizedQuery, activeProviders);
    searchCacheRef.current.set(normalizedQuery, results);
    setSearchedTitles((current) => mergeTitles(current, results));
    return results;
  }, []);

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  const activeTitles = useMemo(() => {
    if (remoteTitles && remoteProviderKey === providerKey) {
      return remoteTitles;
    }
    if (status === 'needs-api-key' || status === 'error') {
      return sessionCatalog;
    }
    return [];
  }, [providerKey, remoteProviderKey, remoteTitles, sessionCatalog, status]);

  const value = useMemo<CatalogContextValue>(() => ({
    titles: activeTitles,
    status,
    errorMessage,
    totalResults: remoteProviderKey === providerKey ? totalResults : 0,
    refreshCatalog,
    searchTitles,
    findTitle: (id) => [...activeTitles, ...searchedTitles].find((title) => title.id === id),
  }), [activeTitles, errorMessage, providerKey, refreshCatalog, remoteProviderKey, searchedTitles, searchTitles, status, totalResults]);

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