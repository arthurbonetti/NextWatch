import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, NativeScrollEvent, NativeSyntheticEvent, Pressable, RefreshControl, ScrollView, TextInput, View, type ViewToken } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedModalShell } from '@/components/atoms/AnimatedModalShell';
import { AppText } from '@/components/atoms/AppText';
import { BottomFadeScrim } from '@/components/atoms/BottomFadeScrim';
import { FadeInBlock } from '@/components/atoms/FadeInBlock';
import { FilterChip } from '@/components/atoms/FilterChip';
import { ServiceLogo } from '@/components/atoms/ServiceLogo';
import { StreamingChip } from '@/components/atoms/StreamingChip';
import { EmptyStateCard } from '@/components/organisms/EmptyStateCard';
import { MediaTitleCard } from '@/components/organisms/MediaTitleCard';
import { ScreenHeader } from '@/components/organisms/ScreenHeader';
import {
  getAllGenres,
  getGenreIcon,
  getTitleAverageRating,
  getTitleServices,
  MaterialIconName,
  matchesSearchQuery,
  MediaKind,
  MediaTitle,
  rankTitlesBySearchRelevance,
} from '@/constants/catalog';
import { Theme } from '@/constants/theme';
import { FONT_FAMILIES } from '@/constants/typography';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';
import { useCatalog, useCatalogSearch, useTitleDurationPrefetch } from '@/hooks/useCatalog';
import { useMyList } from '@/hooks/useMyList';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { formatCount } from '@/utils/format';

type RatingFilter = 'Qualquer nota' | '6+' | '7+' | '8+';
type SortOption = 'default' | 'rating' | 'year' | 'title';

const SORT_OPTIONS: { value: SortOption; label: string; icon: MaterialIconName }[] = [
  { value: 'default', label: 'Mais populares', icon: 'trending-up' },
  { value: 'rating', label: 'Maior nota', icon: 'star' },
  { value: 'year', label: 'Mais recentes', icon: 'schedule' },
  { value: 'title', label: 'A–Z', icon: 'sort-by-alpha' },
];

const COLLAPSED_GENRE_COUNT = 7;

export default function ExploreScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { titles, status: catalogStatus, isFetchingCatalog, refreshCatalog } = useCatalog();
  const { isSaved, toggleSavedTitle, refreshMyList } = useMyList();

  useFocusEffect(
    useCallback(() => {
      void refreshMyList({ minIntervalMs: 5000 });
    }, [refreshMyList]),
  );
  const { subscriptions, storageReady } = useSubscriptions();
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<'Todos' | MediaKind>('Todos');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [showAllGenres, setShowAllGenres] = useState(false);
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('Qualquer nota');
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { prefetchDurations, getDuration } = useTitleDurationPrefetch();

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const isScrolled = event.nativeEvent.contentOffset.y > 6;
    setScrolled((prev) => (prev === isScrolled ? prev : isScrolled));
  }, []);

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

  const activeServices = useMemo(() => new Set(subscriptions.filter((item) => item.active).map((item) => item.provider)), [subscriptions]);
  const availableTitles = useMemo(() => titles.filter((title) =>
    getTitleServices(title).some((service) => activeServices.has(service))
  ), [activeServices, titles]);
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

  const visibleGenres = useMemo(() => {
    if (showAllGenres || genres.length <= COLLAPSED_GENRE_COUNT) return genres;
    const base = genres.slice(0, COLLAPSED_GENRE_COUNT);
    const extrasSelected = effectiveSelectedGenres.filter((genre) => !base.includes(genre));
    return [...base, ...extrasSelected];
  }, [effectiveSelectedGenres, genres, showAllGenres]);

  const toggleService = useCallback((service: string) => {
    setSelectedServices((current) =>
      current.includes(service) ? current.filter((item) => item !== service) : [...current, service],
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
    const localMatched = rawQuery.length > 0
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
      const matchesRating = ratingFilter === 'Qualquer nota' || rating >= Number(ratingFilter.replace('+', ''));
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
  }, [availableTitles, effectiveSelectedGenres, effectiveSelectedServices, kindFilter, ratingFilter, remoteResults, remoteSearchMatched, search, sortBy]);

  const activeSortLabel = sortBy === 'default' && search.trim().length > 0
    ? 'Relevância'
    : SORT_OPTIONS.find((opt) => opt.value === sortBy)?.label ?? 'Mais populares';

  const activeFilterChips = useMemo(() => {
    const chips: { key: string; label: string; service?: string; onRemove: () => void }[] = [];
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
  }, [activeSortLabel, effectiveSelectedGenres, effectiveSelectedServices, ratingFilter, sortBy, toggleGenre, toggleService]);

  const openTitle = useCallback((title: MediaTitle) => router.push({ pathname: '/title/[id]', params: { id: title.id } }), []);

  useEffect(() => {
    prefetchDurations(results.slice(0, 14));
  }, [prefetchDurations, results]);

  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<MediaTitle>[] }) => {
      prefetchDurations(
        viewableItems.map((entry) => entry.item).filter((item): item is MediaTitle => Boolean(item)),
      );
    },
    [prefetchDurations],
  );

  const renderTitleItem = useCallback(
    ({ item, index }: { item: MediaTitle; index: number }) => {
      const saved = isSaved(item.id);
      return (
        <FadeInBlock delay={Math.min(index, 6) * 30}>
          <MediaTitleCard
            title={item}
            duration={getDuration(item)}
            onOpen={() => openTitle(item)}
            actionIcon={saved ? 'bookmark' : 'bookmark-add'}
            actionLabel={saved ? 'Remover da minha lista' : 'Salvar na minha lista'}
            onAction={() => toggleSavedTitle(item)}
            actionButtonStyle={saved ? styles.savedButtonActive : undefined}
            actionIconColor={saved ? colors.savedActiveIcon : colors.textSecondary}
            imagePriority={index === 0 ? 'high' : 'normal'}
          />
        </FadeInBlock>
      );
    },
    [colors.savedActiveIcon, colors.textSecondary, getDuration, isSaved, openTitle, styles.savedButtonActive, toggleSavedTitle],
  );

  const stickyControls = (
    <View>
      <View style={styles.searchRow}>
        <View style={[styles.searchBox, searchFocused && styles.searchBoxFocused]}>
          <MaterialIcons name="search" size={21} color={searchFocused ? colors.accentLink : colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={handleSearchChange}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Buscar filme, série ou gênero"
            placeholderTextColor={colors.textMuted}
            selectionColor={colors.accentLink}
            style={styles.searchInput}
            returnKeyType="search"
            accessibilityLabel="Pesquisar títulos"
          />
          {search.length > 0 && (
            <Pressable onPress={() => handleSearchChange('')} hitSlop={10} accessibilityLabel="Limpar busca">
              <MaterialIcons name="close" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.filterButton,
            activeSheetFilterCount > 0 && styles.filterButtonActive,
            pressed && styles.pressed,
          ]}
          onPress={() => setFiltersVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={
            activeSheetFilterCount > 0
              ? `Abrir filtros (${activeSheetFilterCount} ${activeSheetFilterCount === 1 ? 'ativo' : 'ativos'})`
              : 'Abrir filtros e ordenação'
          }>
          <MaterialIcons name="tune" size={21} color={activeSheetFilterCount > 0 ? colors.savedActiveText : colors.textPrimary} />
          {activeSheetFilterCount > 0 && (
            <View style={styles.filterCount}>
              <AppText peso="forte" tabular style={styles.filterCountText}>
                {activeSheetFilterCount}
              </AppText>
            </View>
          )}
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickFilters}>
        {(['Todos', 'Filme', 'Série', 'Anime'] as const).map((filter) => (
          <Pressable
            key={filter}
            onPress={() => setKindFilter(filter)}
            style={({ pressed }) => [
              styles.quickChip,
              kindFilter === filter && styles.quickChipActive,
              pressed && styles.pressed,
            ]}>
            <AppText tipo="legenda" peso="forte" style={kindFilter === filter ? styles.quickTextActive : styles.quickText}>
              {filter === 'Todos' ? 'Todos' : filter === 'Filme' ? 'Filmes' : filter === 'Série' ? 'Séries' : 'Animes'}
            </AppText>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader
        eyebrow="CATÁLOGO"
        title="Explore títulos"
        bottomSlot={stickyControls}
        scrolled={scrolled}
      />
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={renderTitleItem}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.container, { paddingBottom: Math.max(124, 108 + insets.bottom) }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={5}
        onViewableItemsChanged={handleViewableItemsChanged}
        refreshControl={
          <RefreshControl
            refreshing={pullRefreshing}
            onRefresh={() => { void handlePullRefresh(); }}
            tintColor={colors.accentLink}
            colors={[colors.accentLink, colors.accentPrimary]}
            progressBackgroundColor={colors.bgSurface}
          />
        }
        ListHeaderComponent={
          <View>
            <FadeInBlock delay={0}>
              {activeFilterChips.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeChipsRow}>
                  {activeFilterChips.map((chip) => (
                    <Pressable
                      key={chip.key}
                      onPress={chip.onRemove}
                      style={({ pressed }) => [styles.activeFilterChip, pressed && styles.pressed]}
                      accessibilityRole="button"
                      accessibilityLabel={`Remover filtro ${chip.label}`}>
                      {chip.service && <ServiceLogo name={chip.service} size={14} />}
                      <AppText tipo="legenda" peso="forte" style={styles.activeFilterChipText}>
                        {chip.label}
                      </AppText>
                      <MaterialIcons name="close" size={14} color={colors.savedActiveText} />
                    </Pressable>
                  ))}
                  {activeFilterChips.length > 1 && (
                    <Pressable
                      onPress={clearAllFilters}
                      style={({ pressed }) => [styles.clearAllChip, pressed && styles.pressed]}
                      accessibilityRole="button"
                      accessibilityLabel="Limpar todos os filtros">
                      <AppText tipo="legenda" peso="forte" style={styles.clearAllChipText}>
                        Limpar tudo
                      </AppText>
                    </Pressable>
                  )}
                </ScrollView>
              )}

              <View style={styles.resultsHeader}>
                <View style={styles.resultsHeaderCopy}>
                  <AppText tipo="subtitulo" peso="forte" style={styles.resultsTitle}>
                    {search.trim() ? 'Resultados da busca' : 'Títulos para assistir'}
                  </AppText>
                  <AppText tipo="legenda" tabular style={styles.resultsSubtitle}>
                    {searchLoading
                      ? 'Pesquisando no catálogo online…'
                      : isInitialCatalogLoading
                        ? 'Carregando catálogo…'
                        : hasActiveFilter
                          ? `${formatCount(results.length)} de ${formatCount(availableTitles.length)} títulos`
                          : isFetchingCatalog
                            ? `${formatCount(availableTitles.length)} ${availableTitles.length === 1 ? 'título disponível' : 'títulos disponíveis'} · carregando mais…`
                            : `${formatCount(availableTitles.length)} ${availableTitles.length === 1 ? 'título disponível' : 'títulos disponíveis'}`}
                  </AppText>
                </View>
              </View>

              {searchError && <AppText tipo="legenda" style={styles.searchError}>{searchError}</AppText>}
            </FadeInBlock>
          </View>
        }
        ListEmptyComponent={
          <FadeInBlock delay={60}>
            {isInitialCatalogLoading ? (
              <EmptyStateCard
                icon="autorenew"
                spinIcon
                title="Carregando catálogo…"
                description="Buscando os primeiros títulos dos seus streamings ativos."
                style={styles.emptyState}
              />
            ) : (
              <EmptyStateCard
                icon={activeServices.size > 0 ? 'search-off' : 'subscriptions'}
                title={activeServices.size > 0 ? 'Nenhum título encontrado' : 'Adicione um streaming'}
                description={activeServices.size > 0 ? 'Experimente outro termo ou remova alguns filtros.' : 'Os títulos dos seus serviços ativos aparecem aqui.'}
                actionLabel={activeServices.size === 0 ? 'Gerenciar assinaturas' : hasResettableFilters ? 'Limpar filtros' : undefined}
                onAction={activeServices.size === 0 ? () => router.push('/subscriptions') : hasResettableFilters ? clearAllFilters : undefined}
                style={styles.emptyState}
              />
            )}
          </FadeInBlock>
        }
      />

      <AnimatedModalShell
        visible={filtersVisible}
        onClose={() => setFiltersVisible(false)}
        variant="sheet"
        expandableSheet
        backdropAccessibilityLabel="Fechar filtros">
        <View style={styles.sheetHeader}>
              <View>
                <AppText tipo="legenda" peso="forte" style={styles.sheetEyebrow}>REFINAR CATÁLOGO</AppText>
                <AppText tipo="subtitulo" familia="editorial" peso="forte" style={styles.sheetTitle}>
                  Filtros e ordenação
                </AppText>
              </View>
              <View style={styles.sheetHeaderActions}>
                <Pressable
                  hitSlop={6}
                  disabled={!hasResettableFilters}
                  onPress={clearAllFilters}
                  style={({ pressed }) => [
                    styles.clearHeaderBtn,
                    !hasResettableFilters && styles.clearHeaderBtnDisabled,
                    pressed && hasResettableFilters && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !hasResettableFilters }}
                  accessibilityLabel="Limpar filtros">
                  <AppText
                    tipo="legenda"
                    peso="forte"
                    style={[
                      styles.clearFilters,
                      !hasResettableFilters && styles.clearFiltersDisabled,
                    ]}>
                    Limpar
                  </AppText>
                </Pressable>
              </View>
            </View>

            <View style={styles.sheetScrollWrap}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                bounces={false}
                style={styles.sheetScroll}
                contentContainerStyle={styles.sheetScrollContent}>
                <AppText tipo="legenda" peso="forte" style={styles.filterLabel}>ORDENAÇÃO</AppText>
                <View style={styles.filterChips}>
                  {SORT_OPTIONS.map((option) => {
                    const selected = sortBy === option.value;
                    const optionLabel = option.value === 'default' && search.trim().length > 0 ? 'Relevância' : option.label;
                    return (
                      <FilterChip
                        key={option.value}
                        label={optionLabel}
                        icon={option.icon}
                        selected={selected}
                        onPress={() => setSortBy(option.value)}
                        accessibilityRole="radio"
                      />
                    );
                  })}
                </View>

                {serviceNames.length > 1 && (
                  <>
                    <View style={styles.sectionLabelRow}>
                      <AppText tipo="legenda" peso="forte" style={[styles.filterLabel, styles.secondFilterLabel]}>STREAMING</AppText>
                      <AppText tipo="legenda" style={styles.sectionHint}>Múltipla escolha</AppText>
                    </View>
                    <View style={styles.filterChips}>
                      <FilterChip
                        label="Meus streamings"
                        icon="subscriptions"
                        selected={effectiveSelectedServices.length === 0}
                        onPress={() => setSelectedServices([])}
                        accessibilityRole="checkbox"
                      />
                      {serviceNames.map((service) => (
                        <StreamingChip
                          key={service}
                          provider={service}
                          selected={effectiveSelectedServices.includes(service)}
                          onPress={() => toggleService(service)}
                          accessibilityRole="checkbox"
                        />
                      ))}
                    </View>
                  </>
                )}

                <View style={styles.sectionLabelRow}>
                  <AppText tipo="legenda" peso="forte" style={[styles.filterLabel, styles.secondFilterLabel]}>GÊNERO</AppText>
                  <AppText tipo="legenda" style={styles.sectionHint}>Combina selecionados</AppText>
                </View>
                <View style={styles.filterChips}>
                  <FilterChip
                    label="Todos"
                    icon="apps"
                    selected={effectiveSelectedGenres.length === 0}
                    onPress={() => setSelectedGenres([])}
                    accessibilityRole="checkbox"
                  />
                  {visibleGenres.map((genre) => (
                    <FilterChip
                      key={genre}
                      label={genre}
                      icon={getGenreIcon(genre)}
                      selected={effectiveSelectedGenres.includes(genre)}
                      onPress={() => toggleGenre(genre)}
                      accessibilityRole="checkbox"
                    />
                  ))}
                  {genres.length > COLLAPSED_GENRE_COUNT && (
                    <Pressable
                      onPress={() => setShowAllGenres((prev) => !prev)}
                      style={({ pressed }) => [styles.expandGenresChip, pressed && styles.pressed]}>
                      <AppText tipo="legenda" peso="forte" style={styles.expandGenresText}>
                        {showAllGenres ? 'Menos' : `Mais (+${genres.length - COLLAPSED_GENRE_COUNT})`}
                      </AppText>
                    </Pressable>
                  )}
                </View>

                <AppText tipo="legenda" peso="forte" style={[styles.filterLabel, styles.secondFilterLabel]}>NOTA MÍNIMA</AppText>
                <View style={styles.filterChips}>
                  {(['Qualquer nota', '6+', '7+', '8+'] as RatingFilter[]).map((rating) => (
                    <FilterChip
                      key={rating}
                      label={rating}
                      icon={rating === 'Qualquer nota' ? 'auto-awesome' : 'star'}
                      selected={ratingFilter === rating}
                      onPress={() => setRatingFilter(rating)}
                      accessibilityRole="radio"
                    />
                  ))}
                </View>
              </ScrollView>
              <BottomFadeScrim color={colors.bgSurface} height={30} style={styles.sheetScrollScrim} />
            </View>

            <Pressable
              disabled={results.length === 0}
              style={({ pressed }) => [
                styles.applyButton,
                results.length === 0 && styles.applyButtonDisabled,
                pressed && results.length > 0 && styles.pressed,
              ]}
              onPress={() => setFiltersVisible(false)}
              accessibilityRole="button"
              accessibilityState={{ disabled: results.length === 0 }}>
              <AppText peso="forte" style={[styles.applyButtonText, results.length === 0 && styles.applyButtonTextDisabled]}>
                {results.length === 0
                  ? 'Nenhum título encontrado'
                  : `Ver ${formatCount(results.length)} ${results.length === 1 ? 'título' : 'títulos'}`}
              </AppText>
            </Pressable>
            {results.length === 0 && hasResettableFilters && (
              <Pressable
                style={({ pressed }) => [styles.secondaryResetButton, pressed && styles.pressed]}
                onPress={clearAllFilters}
                accessibilityRole="button">
                <AppText tipo="legenda" peso="forte" style={styles.secondaryResetText}>
                  Limpar filtros
                </AppText>
              </Pressable>
            )}
      </AnimatedModalShell>
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) => ({
  safeArea: { flex: 1, backgroundColor: theme.colors.bgPrimary },
  container: { width: '100%' as const, maxWidth: 640, alignSelf: 'center' as const, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 34 },
  pressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  searchRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, marginBottom: 10, overflow: 'visible' as const },
  searchBox: { flex: 1, minHeight: 50, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 9, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.borderSubtle, backgroundColor: theme.colors.bgSurface },
  searchBoxFocused: { borderColor: theme.colors.borderFocused },
  searchInput: { flex: 1, color: theme.colors.textPrimary, fontFamily: FONT_FAMILIES.sans.regular, fontSize: 16, lineHeight: 22, paddingVertical: 10 },
  filterButton: { width: 50, height: 50, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.borderSubtle, backgroundColor: theme.colors.bgSurface, alignItems: 'center' as const, justifyContent: 'center' as const, overflow: 'visible' as const },
  filterButtonActive: { borderColor: theme.colors.savedActiveBorder, backgroundColor: theme.colors.savedActiveBg },
  filterCount: { position: 'absolute' as const, top: -6, right: -6, zIndex: 2, minWidth: 21, height: 21, paddingHorizontal: 5, borderRadius: 10.5, borderWidth: 2, borderColor: theme.colors.bgPrimary, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: theme.colors.accentPrimary },
  filterCountText: { color: theme.colors.textOnAccent, fontSize: 10.5, lineHeight: 13 },
  quickFilters: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingBottom: 2 },
  quickChip: { borderWidth: 1, borderColor: theme.colors.chipBorder, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: theme.colors.chipBg },
  quickChipActive: { borderColor: theme.colors.chipSelectedBorder, backgroundColor: theme.colors.chipSelectedBg },
  quickText: { color: theme.colors.chipText, fontSize: 13 },
  quickTextActive: { color: theme.colors.chipSelectedText, fontSize: 13 },
  activeChipsRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 7, paddingBottom: 14 },
  activeFilterChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.savedActiveBorder,
    backgroundColor: theme.colors.savedActiveBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  activeFilterChipText: { color: theme.colors.textPrimary, fontSize: 12.5 },
  clearAllChip: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bgSurface,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  clearAllChipText: { color: theme.colors.accentLink, fontSize: 12.5 },
  sectionLabelRow: { flexDirection: 'row' as const, alignItems: 'baseline' as const, justifyContent: 'space-between' as const, marginTop: 15, marginBottom: 8 },
  filterLabel: { color: theme.colors.textSecondary, fontSize: 12, letterSpacing: 1, marginBottom: 8 },
  secondFilterLabel: { marginTop: 15 },
  sectionHint: { color: theme.colors.textSecondary, fontSize: 12 },
  clearFilters: { color: theme.colors.accentLink, fontSize: 13 },
  clearFiltersDisabled: { color: theme.colors.buttonDisabledText },
  filterChips: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: theme.spacing.md },
  expandGenresChip: { minHeight: theme.touchTarget.min, justifyContent: 'center' as const, borderWidth: 1, borderColor: theme.colors.savedActiveBorder, borderRadius: theme.radius.pill, paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing.base, backgroundColor: theme.colors.savedActiveBg },
  expandGenresText: { color: theme.colors.accentLink, fontSize: 13 },
  resultsHeader: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, gap: 10, marginTop: 4, marginBottom: 12 },
  resultsHeaderCopy: { flex: 1 },
  resultsTitle: { color: theme.colors.textPrimary, fontSize: 18, lineHeight: 23 },
  resultsSubtitle: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 2 },
  sheetHeader: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginBottom: 14 },
  sheetEyebrow: { color: theme.colors.accentLink, letterSpacing: 1.3, marginBottom: 3 },
  sheetTitle: { color: theme.colors.textPrimary, fontSize: 20, lineHeight: 25, letterSpacing: -0.3 },
  sheetHeaderActions: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  clearHeaderBtn: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 12, backgroundColor: theme.colors.bgSurfaceAlt },
  clearHeaderBtnDisabled: { backgroundColor: theme.colors.buttonDisabledBg },
  sheetScrollWrap: { position: 'relative' as const, flexShrink: 1, marginBottom: 14 },
  sheetScroll: { flexShrink: 1 },
  sheetScrollContent: { paddingBottom: 32 },
  sheetScrollScrim: { position: 'absolute' as const, left: 0, right: 0, bottom: 0 },
  applyButton: { minHeight: 50, borderRadius: 14, backgroundColor: theme.colors.primaryButtonBg, borderWidth: 1, borderColor: theme.colors.primaryButtonBg, alignItems: 'center' as const, justifyContent: 'center' as const },
  applyButtonDisabled: { backgroundColor: theme.colors.buttonDisabledBg, borderColor: theme.colors.buttonDisabledBorder },
  applyButtonText: { color: theme.colors.primaryButtonText, fontSize: 14.5 },
  applyButtonTextDisabled: { color: theme.colors.buttonDisabledText },
  secondaryResetButton: { minHeight: 40, marginTop: 8, alignItems: 'center' as const, justifyContent: 'center' as const },
  secondaryResetText: { color: theme.colors.accentLink, fontSize: 13.5 },
  searchError: { color: theme.colors.dangerText, marginBottom: 8 },
  savedButtonActive: { backgroundColor: theme.colors.savedActiveBg, borderWidth: 1, borderColor: theme.colors.savedActiveBorder },
  emptyState: { marginTop: 10 },
});
