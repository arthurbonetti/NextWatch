import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedModalShell } from '@/components/atoms/AnimatedModalShell';
import { AppText } from '@/components/atoms/AppText';
import { FadeInBlock } from '@/components/atoms/FadeInBlock';
import { ServiceLogo } from '@/components/atoms/ServiceLogo';
import { EmptyStateCard } from '@/components/organisms/EmptyStateCard';
import { MediaTitleCard } from '@/components/organisms/MediaTitleCard';
import {
  getAllGenres,
  getTitleAverageRating,
  getTitleServices,
  matchesSearchQuery,
  MediaKind,
  MediaTitle,
  rankTitlesBySearchRelevance,
} from '@/constants/catalog';
import { FONT_FAMILIES } from '@/constants/typography';
import { useCatalog } from '@/contexts/CatalogContext';
import { useMyList } from '@/contexts/MyListContext';
import { useSubscriptions } from '@/contexts/SubscriptionsContext';
import { formatCount } from '@/utils/format';

type RatingFilter = 'Qualquer nota' | '7+' | '8+';
type SortOption = 'default' | 'rating' | 'year' | 'title';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'default', label: 'Mais populares' },
  { value: 'rating', label: 'Maior nota' },
  { value: 'year', label: 'Mais recentes' },
  { value: 'title', label: 'A–Z' },
];

const COLLAPSED_GENRE_COUNT = 7;

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const { titles, refreshCatalog, searchTitles } = useCatalog();
  const { isSaved, toggleSavedTitle, refreshMyList } = useMyList();

  useFocusEffect(
    useCallback(() => {
      void refreshMyList({ minIntervalMs: 5000 });
    }, [refreshMyList]),
  );
  const { subscriptions } = useSubscriptions();
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
  const [remoteResults, setRemoteResults] = useState<MediaTitle[] | null>(null);
  const [remoteQuery, setRemoteQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchRequestRef = useRef(0);

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

  const handleSearchChange = useCallback((nextSearch: string) => {
    setSearch(nextSearch);
    if (nextSearch.trim().length < 2) {
      searchRequestRef.current += 1;
      setSearchLoading(false);
      setRemoteResults(null);
      setRemoteQuery('');
      setSearchError(null);
    }
  }, []);

  useEffect(() => {
    const query = search.trim();
    if (query.length < 2) return;
    const requestId = ++searchRequestRef.current;

    const timer = setTimeout(() => {
      setSearchLoading(true);
      setSearchError(null);
      void searchTitles(query)
        .then((results) => {
          if (searchRequestRef.current === requestId) {
            setRemoteResults(results);
            setRemoteQuery(query.toLocaleLowerCase());
          }
        })
        .catch(() => {
          if (searchRequestRef.current === requestId) {
            setRemoteResults([]);
            setSearchError('Não foi possível pesquisar no catálogo online. Tente novamente.');
          }
        })
        .finally(() => {
          if (searchRequestRef.current === requestId) setSearchLoading(false);
        });
    }, 350);

    return () => clearTimeout(timer);
  }, [search, searchTitles]);

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
    const normalizedQuery = rawQuery.toLocaleLowerCase();
    const localMatched = rawQuery.length > 0
      ? availableTitles.filter((title) => matchesSearchQuery(title, rawQuery))
      : availableTitles;

    let sourceTitles: MediaTitle[] = localMatched;
    if (normalizedQuery.length >= 2 && remoteQuery === normalizedQuery && remoteResults) {
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
  }, [availableTitles, effectiveSelectedGenres, effectiveSelectedServices, kindFilter, ratingFilter, remoteQuery, remoteResults, search, sortBy]);

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

  const renderTitleItem = useCallback(
    ({ item, index }: { item: MediaTitle; index: number }) => {
      const saved = isSaved(item.id);
      return (
        <FadeInBlock delay={Math.min(index, 6) * 30}>
          <MediaTitleCard
            title={item}
            onOpen={() => openTitle(item)}
            actionIcon={saved ? 'bookmark' : 'bookmark-add'}
            actionLabel={saved ? 'Remover da minha lista' : 'Salvar na minha lista'}
            onAction={() => toggleSavedTitle(item)}
            actionButtonStyle={saved ? styles.savedButtonActive : undefined}
            actionIconColor={saved ? '#e58c34' : '#657078'}
          />
        </FadeInBlock>
      );
    },
    [isSaved, openTitle, toggleSavedTitle],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={renderTitleItem}
        contentContainerStyle={[styles.container, { paddingBottom: Math.max(108, 92 + insets.bottom) }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={5}
        refreshControl={
          <RefreshControl
            refreshing={pullRefreshing}
            onRefresh={() => { void handlePullRefresh(); }}
            tintColor="#a3520d"
            colors={['#a3520d', '#f3b43f']}
          />
        }
        ListHeaderComponent={
          <View>
            <FadeInBlock delay={0}>
              <View style={styles.header}>
                <AppText tipo="legenda" peso="forte" style={styles.eyebrow}>CATÁLOGO</AppText>
                <AppText tipo="titulo" peso="forte" style={styles.title}>Explore títulos</AppText>
              </View>

              <View style={styles.searchRow}>
                <View style={[styles.searchBox, searchFocused && styles.searchBoxFocused]}>
                  <MaterialIcons name="search" size={21} color={searchFocused ? '#a3520d' : '#8b8a84'} />
                  <TextInput
                    value={search}
                    onChangeText={handleSearchChange}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setSearchFocused(false)}
                    placeholder="Buscar filme, série ou gênero"
                    placeholderTextColor="#7a7973"
                    selectionColor="#a3520d"
                    style={styles.searchInput}
                    returnKeyType="search"
                    accessibilityLabel="Pesquisar títulos"
                  />
                  {search.length > 0 && (
                    <Pressable onPress={() => handleSearchChange('')} hitSlop={10} accessibilityLabel="Limpar busca">
                      <MaterialIcons name="close" size={18} color="#7a7973" />
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
                  <MaterialIcons name="tune" size={21} color={activeSheetFilterCount > 0 ? '#a3520d' : '#182230'} />
                  {activeSheetFilterCount > 0 && (
                    <View style={styles.filterCount}>
                      <AppText peso="forte" tabular style={styles.filterCountText}>
                        {activeSheetFilterCount}
                      </AppText>
                    </View>
                  )}
                </Pressable>
              </View>
            </FadeInBlock>

            <FadeInBlock delay={35}>
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
                      <MaterialIcons name="close" size={14} color="#a3520d" />
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
                      : hasActiveFilter
                        ? `${formatCount(results.length)} de ${formatCount(availableTitles.length)} títulos`
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
            <EmptyStateCard
              icon={activeServices.size > 0 ? 'search-off' : 'subscriptions'}
              title={activeServices.size > 0 ? 'Nenhum título encontrado' : 'Adicione um streaming'}
              description={activeServices.size > 0 ? 'Experimente outro termo ou remova alguns filtros.' : 'Os títulos dos seus serviços ativos aparecem aqui.'}
              actionLabel={activeServices.size === 0 ? 'Gerenciar assinaturas' : hasResettableFilters ? 'Limpar filtros' : undefined}
              onAction={activeServices.size === 0 ? () => router.push('/subscriptions') : hasResettableFilters ? clearAllFilters : undefined}
              style={styles.emptyState}
            />
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
                {hasResettableFilters && (
                  <Pressable
                    hitSlop={6}
                    onPress={clearAllFilters}
                    style={({ pressed }) => [styles.clearHeaderBtn, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel="Limpar filtros">
                    <AppText tipo="legenda" peso="forte" style={styles.clearFilters}>Limpar</AppText>
                  </Pressable>
                )}
              </View>
            </View>

            <ScrollView
              showsVerticalScrollIndicator
              bounces={false}
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetScrollContent}>
              <AppText tipo="legenda" peso="forte" style={styles.filterLabel}>ORDENAÇÃO</AppText>
              <View style={styles.filterChips}>
                {SORT_OPTIONS.map((option) => {
                  const selected = sortBy === option.value;
                  const optionLabel = option.value === 'default' && search.trim().length > 0 ? 'Relevância' : option.label;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => setSortBy(option.value)}
                      style={({ pressed }) => [
                        styles.filterChip,
                        selected && styles.filterChipActive,
                        pressed && styles.pressed,
                      ]}>
                      <AppText tipo="legenda" peso="forte" style={selected ? styles.filterChipTextActive : styles.filterChipText}>
                        {optionLabel}
                      </AppText>
                    </Pressable>
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
                    <Pressable
                      onPress={() => setSelectedServices([])}
                      style={({ pressed }) => [
                        styles.filterChip,
                        effectiveSelectedServices.length === 0 && styles.filterChipActive,
                        pressed && styles.pressed,
                      ]}>
                      <AppText tipo="legenda" peso="forte" style={effectiveSelectedServices.length === 0 ? styles.filterChipTextActive : styles.filterChipText}>
                        Meus streamings
                      </AppText>
                    </Pressable>
                    {serviceNames.map((service) => {
                      const selected = effectiveSelectedServices.includes(service);
                      return (
                        <Pressable
                          key={service}
                          onPress={() => toggleService(service)}
                          style={({ pressed }) => [
                            styles.filterChip,
                            selected && styles.filterChipActive,
                            pressed && styles.pressed,
                          ]}>
                          <View style={styles.chipInner}>
                            <ServiceLogo name={service} size={15} />
                            <AppText tipo="legenda" peso="forte" style={selected ? styles.filterChipTextActive : styles.filterChipText}>
                              {service}
                            </AppText>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}

              <View style={styles.sectionLabelRow}>
                <AppText tipo="legenda" peso="forte" style={[styles.filterLabel, styles.secondFilterLabel]}>GÊNERO</AppText>
                <AppText tipo="legenda" style={styles.sectionHint}>Combina selecionados</AppText>
              </View>
              <View style={styles.filterChips}>
                <Pressable
                  onPress={() => setSelectedGenres([])}
                  style={({ pressed }) => [
                    styles.filterChip,
                    effectiveSelectedGenres.length === 0 && styles.filterChipActive,
                    pressed && styles.pressed,
                  ]}>
                  <AppText tipo="legenda" peso="forte" style={effectiveSelectedGenres.length === 0 ? styles.filterChipTextActive : styles.filterChipText}>
                    Todos
                  </AppText>
                </Pressable>
                {visibleGenres.map((genre) => {
                  const selected = effectiveSelectedGenres.includes(genre);
                  return (
                    <Pressable
                      key={genre}
                      onPress={() => toggleGenre(genre)}
                      style={({ pressed }) => [
                        styles.filterChip,
                        selected && styles.filterChipActive,
                        pressed && styles.pressed,
                      ]}>
                      <AppText tipo="legenda" peso="forte" style={selected ? styles.filterChipTextActive : styles.filterChipText}>
                        {genre}
                      </AppText>
                    </Pressable>
                  );
                })}
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
                {(['Qualquer nota', '7+', '8+'] as RatingFilter[]).map((rating) => (
                  <Pressable
                    key={rating}
                    onPress={() => setRatingFilter(rating)}
                    style={({ pressed }) => [
                      styles.filterChip,
                      ratingFilter === rating && styles.filterChipActive,
                      pressed && styles.pressed,
                    ]}>
                    <AppText tipo="legenda" peso="forte" style={ratingFilter === rating ? styles.filterChipTextActive : styles.filterChipText}>
                      {rating}
                    </AppText>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

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

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f5f0' },
  container: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 34 },
  pressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  header: { marginBottom: 16 },
  eyebrow: { color: '#e58c34', letterSpacing: 1.5, marginBottom: 5 },
  title: { color: '#182230', fontSize: 25, lineHeight: 30 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14, overflow: 'visible' },
  searchBox: { flex: 1, minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: '#e8e2d5', backgroundColor: '#fffdf8' },
  searchBoxFocused: { borderColor: '#182230' },
  searchInput: { flex: 1, color: '#182230', fontFamily: FONT_FAMILIES.sans.regular, fontSize: 16, lineHeight: 22, paddingVertical: 10 },
  filterButton: { width: 50, height: 50, borderRadius: 14, borderWidth: 1, borderColor: '#e8e2d5', backgroundColor: '#fffdf8', alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  filterButtonActive: { borderColor: '#a3520d', backgroundColor: '#fff2d8' },
  filterCount: { position: 'absolute', top: -6, right: -6, zIndex: 2, minWidth: 21, height: 21, paddingHorizontal: 5, borderRadius: 10.5, borderWidth: 2, borderColor: '#f7f5f0', alignItems: 'center', justifyContent: 'center', backgroundColor: '#a3520d' },
  filterCountText: { color: '#fffdf8', fontSize: 10.5, lineHeight: 13 },
  quickFilters: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 12 },
  quickChip: { borderWidth: 1, borderColor: '#ded8cd', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fffdf8' },
  quickChipActive: { borderColor: '#182230', backgroundColor: '#182230' },
  chipInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  quickText: { color: '#5e5c57', fontSize: 13 },
  quickTextActive: { color: '#fffdf8', fontSize: 13 },
  activeChipsRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingBottom: 14 },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5dac3',
    backgroundColor: '#f1e8d7',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  activeFilterChipText: { color: '#182230', fontSize: 12.5 },
  clearAllChip: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5dac3',
    backgroundColor: '#fffdf8',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  clearAllChipText: { color: '#a3520d', fontSize: 12.5 },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 15, marginBottom: 8 },
  filterLabel: { color: '#5e5c57', fontSize: 12, letterSpacing: 1, marginBottom: 8 },
  secondFilterLabel: { marginTop: 15 },
  sectionHint: { color: '#5e5c57', fontSize: 12 },
  clearFilters: { color: '#a3520d', fontSize: 13 },
  filterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  filterChip: { borderWidth: 1, borderColor: '#ded8cd', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7.5, backgroundColor: '#fffdf8' },
  filterChipActive: { borderColor: '#182230', backgroundColor: '#182230' },
  filterChipText: { color: '#5e5c57', fontSize: 13 },
  filterChipTextActive: { color: '#fffdf8', fontSize: 13 },
  expandGenresChip: { borderWidth: 1, borderColor: '#e5dac3', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7.5, backgroundColor: '#f1e8d7' },
  expandGenresText: { color: '#a3520d', fontSize: 13 },
  resultsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 4, marginBottom: 12 },
  resultsHeaderCopy: { flex: 1 },
  resultsTitle: { color: '#182230', fontSize: 18, lineHeight: 23 },
  resultsSubtitle: { color: '#5e5c57', fontSize: 13, lineHeight: 18, marginTop: 2 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sheetEyebrow: { color: '#e58c34', letterSpacing: 1.3, marginBottom: 3 },
  sheetTitle: { color: '#182230', fontSize: 20, lineHeight: 25, letterSpacing: -0.3 },
  sheetHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  clearHeaderBtn: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 12, backgroundColor: '#f1eee7' },
  sheetScroll: { flexShrink: 1, marginBottom: 14 },
  sheetScrollContent: { paddingBottom: 6 },
  applyButton: { minHeight: 48, borderRadius: 14, backgroundColor: '#f3b43f', alignItems: 'center', justifyContent: 'center' },
  applyButtonDisabled: { backgroundColor: '#e8e2d5' },
  applyButtonText: { color: '#182230', fontSize: 14.5 },
  applyButtonTextDisabled: { color: '#5e5c57' },
  secondaryResetButton: { minHeight: 40, marginTop: 8, alignItems: 'center', justifyContent: 'center' },
  secondaryResetText: { color: '#a3520d', fontSize: 13.5 },
  searchError: { color: '#c0392b', marginBottom: 8 },
  savedButtonActive: { backgroundColor: '#fff2d8', borderWidth: 1, borderColor: '#e58c34' },
  emptyState: { marginTop: 10 },
});
