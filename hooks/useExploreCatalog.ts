import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ViewToken } from 'react-native';

import type { MaterialIconName } from '@/components/atoms/AppIcon';
import {
  getAllGenres,
  getTitleAverageRating,
  getTitleServices,
} from '@/constants/catalog';
import { useCatalog, useCatalogSearch, useTitleDurationPrefetch } from '@/hooks/useCatalog';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import type { MediaKind, MediaTitle } from '@/types/media';
import { matchesSearchQuery, rankTitlesBySearchRelevance } from '@/utils/catalogSearch';

export type RatingFilter = 'Qualquer nota' | '6+' | '7+' | '8+';
export type SortOption = 'default' | 'rating' | 'year' | 'title';

export const EXPLORE_SORT_OPTIONS: { value: SortOption; label: string; icon: MaterialIconName }[] = [
  { value: 'default', label: 'Mais populares', icon: 'trending-up' },
  { value: 'rating', label: 'Maior nota', icon: 'star' },
  { value: 'year', label: 'Mais recentes', icon: 'schedule' },
  { value: 'title', label: 'A–Z', icon: 'sort-by-alpha' },
];

export type ActiveFilterChip = {
  key: string;
  label: string;
  service?: string;
  onRemove: () => void;
};

/**
 * Gerencia busca, filtros, ordenação, pull-to-refresh e prefetch de duração
 * do catálogo na tela Explorar (`app/(tabs)/explore.tsx`).
 */
export function useExploreCatalog() {
  const { titles, status: catalogStatus, isFetchingCatalog, refreshCatalog } = useCatalog();
  const { subscriptions, storageReady } = useSubscriptions();
  const { prefetchDurations, getDuration } = useTitleDurationPrefetch();

  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<'Todos' | MediaKind>('Todos');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('Qualquer nota');
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [pullRefreshing, setPullRefreshing] = useState(false);

  const {
    results: remoteResults,
    isSearching: searchLoading,
    isMatch: remoteSearchMatched,
    errorMessage: searchError,
  } = useCatalogSearch(search);

  const handlePullRefresh = useCallback(async () => {
    setPullRefreshing(true);
    try {
      await refreshCatalog();
    } finally {
      setPullRefreshing(false);
    }
  }, [refreshCatalog]);

  const activeServices = useMemo(
    () => new Set(subscriptions.filter((item) => item.active).map((item) => item.provider)),
    [subscriptions],
  );

  const availableTitles = useMemo(
    () =>
      titles.filter((title) =>
        getTitleServices(title).some((service) => activeServices.has(service)),
      ),
    [activeServices, titles],
  );

  const isInitialCatalogLoading =
    availableTitles.length === 0 &&
    (!storageReady ||
      (activeServices.size > 0 && (catalogStatus === 'loading' || isFetchingCatalog)));

  const handleSearchChange = useCallback((nextSearch: string) => {
    setSearch(nextSearch);
  }, []);

  const genres = useMemo(() => getAllGenres(titles), [titles]);

  const serviceNames = useMemo(() => {
    const availableServiceSet = new Set(availableTitles.flatMap((title) => getTitleServices(title)));
    const activeOrdered = subscriptions
      .filter((item) => item.active && availableServiceSet.has(item.provider))
      .map((item) => item.provider);
    return Array.from(new Set(activeOrdered));
  }, [availableTitles, subscriptions]);

  const effectiveSelectedServices = useMemo(
    () => selectedServices.filter((service) => serviceNames.includes(service)),
    [selectedServices, serviceNames],
  );

  const effectiveSelectedGenres = useMemo(
    () => selectedGenres.filter((genre) => genres.includes(genre)),
    [genres, selectedGenres],
  );

  const toggleService = useCallback((service: string) => {
    setSelectedServices((current) =>
      current.includes(service)
        ? current.filter((item) => item !== service)
        : [...current, service],
    );
  }, []);

  const toggleGenre = useCallback((genre: string) => {
    setSelectedGenres((current) =>
      current.includes(genre) ? current.filter((item) => item !== genre) : [...current, genre],
    );
  }, []);

  const hasFilterCriteria =
    kindFilter !== 'Todos' ||
    effectiveSelectedGenres.length > 0 ||
    effectiveSelectedServices.length > 0 ||
    ratingFilter !== 'Qualquer nota';
  const activeSheetFilterCount =
    effectiveSelectedServices.length +
    effectiveSelectedGenres.length +
    Number(ratingFilter !== 'Qualquer nota') +
    Number(sortBy !== 'default');
  const hasActiveFilter = hasFilterCriteria || search.trim().length > 0;
  const hasResettableFilters = hasFilterCriteria || sortBy !== 'default';

  const clearAllFilters = useCallback(() => {
    setKindFilter('Todos');
    setSelectedGenres([]);
    setSelectedServices([]);
    setRatingFilter('Qualquer nota');
    setSortBy('default');
  }, []);

  const results = useMemo(() => {
    const rawQuery = search.trim();
    const localMatched =
      rawQuery.length > 0
        ? availableTitles.filter((title) => matchesSearchQuery(title, rawQuery))
        : availableTitles;

    let sourceTitles: MediaTitle[] = localMatched;
    if (rawQuery.length >= 2 && remoteSearchMatched && remoteResults.length > 0) {
      const mergedById = new Map<string, MediaTitle>();
      for (const item of localMatched) {
        mergedById.set(item.id, item);
      }
      for (const item of remoteResults) {
        if (!mergedById.has(item.id)) {
          mergedById.set(item.id, item);
        }
      }
      sourceTitles = Array.from(mergedById.values());
    }

    const filtered = sourceTitles.filter((title) => {
      const matchesKind = kindFilter === 'Todos' || title.kind === kindFilter;
      const matchesGenre =
        effectiveSelectedGenres.length === 0 ||
        effectiveSelectedGenres.every((genre) => title.genres.includes(genre));
      const matchesService =
        effectiveSelectedServices.length === 0 ||
        getTitleServices(title).some((service) => effectiveSelectedServices.includes(service));
      const rating = getTitleAverageRating(title);
      const matchesRating =
        ratingFilter === 'Qualquer nota' || rating >= Number(ratingFilter.replace('+', ''));
      return matchesKind && matchesGenre && matchesService && matchesRating;
    });

    if (sortBy === 'rating') {
      return [...filtered].sort((a, b) => {
        const ratingDiff = getTitleAverageRating(b) - getTitleAverageRating(a);
        if (ratingDiff !== 0) return ratingDiff;
        return (b.popularity ?? 0) - (a.popularity ?? 0);
      });
    }
    if (sortBy === 'year') {
      return [...filtered].sort((a, b) => {
        const yearDiff = (b.year || 0) - (a.year || 0);
        if (yearDiff !== 0) return yearDiff;
        return getTitleAverageRating(b) - getTitleAverageRating(a);
      });
    }
    if (sortBy === 'title') {
      return [...filtered].sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
    }

    return rawQuery.length > 0 ? rankTitlesBySearchRelevance(filtered, rawQuery) : filtered;
  }, [
    availableTitles,
    effectiveSelectedGenres,
    effectiveSelectedServices,
    kindFilter,
    ratingFilter,
    remoteResults,
    remoteSearchMatched,
    search,
    sortBy,
  ]);

  const activeSortLabel =
    sortBy === 'default' && search.trim().length > 0
      ? 'Relevância'
      : (EXPLORE_SORT_OPTIONS.find((opt) => opt.value === sortBy)?.label ?? 'Mais populares');

  const activeFilterChips = useMemo<ActiveFilterChip[]>(() => {
    const chips: ActiveFilterChip[] = [];
    for (const service of effectiveSelectedServices) {
      chips.push({
        key: `service-${service}`,
        label: service,
        service,
        onRemove: () => toggleService(service),
      });
    }
    for (const genre of effectiveSelectedGenres) {
      chips.push({
        key: `genre-${genre}`,
        label: genre,
        onRemove: () => toggleGenre(genre),
      });
    }
    if (ratingFilter !== 'Qualquer nota') {
      chips.push({
        key: `rating-${ratingFilter}`,
        label: `Nota ${ratingFilter}`,
        onRemove: () => setRatingFilter('Qualquer nota'),
      });
    }
    if (sortBy !== 'default') {
      chips.push({
        key: `sort-${sortBy}`,
        label: activeSortLabel,
        onRemove: () => setSortBy('default'),
      });
    }
    return chips;
  }, [
    activeSortLabel,
    effectiveSelectedGenres,
    effectiveSelectedServices,
    ratingFilter,
    sortBy,
    toggleGenre,
    toggleService,
  ]);

  useEffect(() => {
    prefetchDurations(results.slice(0, 14));
  }, [prefetchDurations, results]);

  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<MediaTitle>[] }) => {
      prefetchDurations(
        viewableItems
          .map((entry) => entry.item)
          .filter((item): item is MediaTitle => Boolean(item)),
      );
    },
    [prefetchDurations],
  );

  return {
    search,
    handleSearchChange,
    kindFilter,
    setKindFilter,
    genres,
    serviceNames,
    selectedServices: effectiveSelectedServices,
    setSelectedServices,
    toggleService,
    selectedGenres: effectiveSelectedGenres,
    setSelectedGenres,
    toggleGenre,
    ratingFilter,
    setRatingFilter,
    sortBy,
    setSortBy,
    clearAllFilters,
    activeServicesCount: activeServices.size,
    availableTitles,
    results,
    activeFilterChips,
    activeSheetFilterCount,
    hasActiveFilter,
    hasResettableFilters,
    isInitialCatalogLoading,
    isFetchingCatalog,
    searchLoading,
    searchError,
    pullRefreshing,
    handlePullRefresh,
    getDuration,
    handleViewableItemsChanged,
  };
}
