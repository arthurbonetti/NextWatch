import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { MediaKind } from '@/constants/catalog';

export type DrawKindFilter = 'Todos' | MediaKind;

export type DrawFiltersState = {
  kind: DrawKindFilter;
  selectedGenres: string[];
  disabledServices: string[];
  hideWatched: boolean;
};

const BASE_STORAGE_KEY = '@nextwatch/draw-filters';

const DEFAULT_FILTERS: DrawFiltersState = {
  kind: 'Todos',
  selectedGenres: [],
  disabledServices: [],
  hideWatched: false,
};

const VALID_KINDS = new Set<DrawKindFilter>(['Todos', 'Filme', 'Série', 'Anime']);

function parseStoredFilters(raw: string | null): DrawFiltersState {
  if (!raw) return DEFAULT_FILTERS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return DEFAULT_FILTERS;
    }
    const candidate = parsed as Partial<DrawFiltersState>;
    const kind: DrawKindFilter =
      typeof candidate.kind === 'string' && VALID_KINDS.has(candidate.kind as DrawKindFilter)
        ? (candidate.kind as DrawKindFilter)
        : 'Todos';
    const selectedGenres = Array.isArray(candidate.selectedGenres)
      ? candidate.selectedGenres.filter((item): item is string => typeof item === 'string' && item.length > 0)
      : [];
    const disabledServices = Array.isArray(candidate.disabledServices)
      ? candidate.disabledServices.filter((item): item is string => typeof item === 'string' && item.length > 0)
      : [];
    const hideWatched = typeof candidate.hideWatched === 'boolean' ? candidate.hideWatched : false;

    return {
      kind,
      selectedGenres: Array.from(new Set(selectedGenres)),
      disabledServices: Array.from(new Set(disabledServices)),
      hideWatched,
    };
  } catch {
    return DEFAULT_FILTERS;
  }
}

export function usePersistedDrawFilters(userId: string | null, activeServiceNames: readonly string[]) {
  const storageKey = `${BASE_STORAGE_KEY}:${userId ?? 'guest'}`;
  const [state, setState] = useState<{ key: string; filters: DrawFiltersState; ready: boolean }>({
    key: storageKey,
    filters: DEFAULT_FILTERS,
    ready: false,
  });
  const latestStateRef = useRef(state);
  latestStateRef.current = state;

  useEffect(() => {
    let cancelled = false;
    setState((prev) =>
      prev.key === storageKey ? prev : { key: storageKey, filters: DEFAULT_FILTERS, ready: false },
    );

    void AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (cancelled) return;
        const parsed = parseStoredFilters(raw);
        setState({ key: storageKey, filters: parsed, ready: true });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ key: storageKey, filters: DEFAULT_FILTERS, ready: true });
      });

    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  const updateFilters = useCallback(
    (updater: (prev: DrawFiltersState) => DrawFiltersState) => {
      setState((current) => {
        const base = current.key === storageKey ? current.filters : DEFAULT_FILTERS;
        const next = updater(base);
        AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch(() => {});
        return { key: storageKey, filters: next, ready: true };
      });
    },
    [storageKey],
  );

  const setKind = useCallback(
    (kind: DrawKindFilter) => {
      updateFilters((prev) => (prev.kind === kind ? prev : { ...prev, kind }));
    },
    [updateFilters],
  );

  const toggleGenre = useCallback(
    (genre: string) => {
      updateFilters((prev) => {
        const exists = prev.selectedGenres.includes(genre);
        const selectedGenres = exists
          ? prev.selectedGenres.filter((item) => item !== genre)
          : [...prev.selectedGenres, genre];
        return { ...prev, selectedGenres };
      });
    },
    [updateFilters],
  );

  const clearGenres = useCallback(() => {
    updateFilters((prev) => (prev.selectedGenres.length === 0 ? prev : { ...prev, selectedGenres: [] }));
  }, [updateFilters]);

  const toggleService = useCallback(
    (provider: string) => {
      updateFilters((prev) => {
        const isDisabled = prev.disabledServices.includes(provider);
        const disabledServices = isDisabled
          ? prev.disabledServices.filter((item) => item !== provider)
          : [...prev.disabledServices, provider];
        return { ...prev, disabledServices };
      });
    },
    [updateFilters],
  );

  const setHideWatched = useCallback(
    (hideWatched: boolean) => {
      updateFilters((prev) => (prev.hideWatched === hideWatched ? prev : { ...prev, hideWatched }));
    },
    [updateFilters],
  );

  const resetFilters = useCallback(() => {
    updateFilters(() => DEFAULT_FILTERS);
  }, [updateFilters]);

  const activeFilters = state.key === storageKey ? state.filters : DEFAULT_FILTERS;
  const enabledServices = useMemo(() => {
    const disabledSet = new Set(activeFilters.disabledServices);
    return activeServiceNames.filter((name) => !disabledSet.has(name));
  }, [activeFilters.disabledServices, activeServiceNames]);

  return {
    filters: activeFilters,
    filtersReady: state.key === storageKey && state.ready,
    enabledServices,
    setKind,
    toggleGenre,
    clearGenres,
    toggleService,
    setHideWatched,
    resetFilters,
  };
}
