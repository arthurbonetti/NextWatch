import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/atoms/AppIcon';
import { AppText } from '@/components/atoms/AppText';
import { FadeInBlock } from '@/components/atoms/FadeInBlock';
import { ServiceLogo } from '@/components/atoms/ServiceLogo';
import { EmptyStateCard } from '@/components/organisms/EmptyStateCard';
import { ExploreFiltersModal } from '@/components/organisms/ExploreFiltersModal';
import { MediaTitleCard } from '@/components/organisms/MediaTitleCard';
import { ScreenHeader } from '@/components/organisms/ScreenHeader';
import { Theme } from '@/constants/theme';
import { FONT_FAMILIES } from '@/constants/typography';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';
import { useExploreCatalog } from '@/hooks/useExploreCatalog';
import { useMyList } from '@/hooks/useMyList';
import type { MediaTitle } from '@/types/media';
import { formatCount } from '@/utils/format';

export default function ExploreScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { isSaved, toggleSavedTitle, refreshMyList } = useMyList();

  useFocusEffect(
    useCallback(() => {
      void refreshMyList({ minIntervalMs: 5000 });
    }, [refreshMyList]),
  );

  const explore = useExploreCatalog();
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const isScrolled = event.nativeEvent.contentOffset.y > 6;
    setScrolled((prev) => (prev === isScrolled ? prev : isScrolled));
  }, []);

  const openTitle = useCallback(
    (title: MediaTitle) => router.push({ pathname: '/title/[id]', params: { id: title.id } }),
    [],
  );

  const renderTitleItem = useCallback(
    ({ item, index }: { item: MediaTitle; index: number }) => {
      const saved = isSaved(item.id);
      return (
        <FadeInBlock delay={Math.min(index, 6) * 30}>
          <MediaTitleCard
            title={item}
            duration={explore.getDuration(item)}
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
    [
      colors.savedActiveIcon,
      colors.textSecondary,
      explore.getDuration,
      isSaved,
      openTitle,
      styles.savedButtonActive,
      toggleSavedTitle,
    ],
  );

  const stickyControls = (
    <View>
      <View style={styles.searchRow}>
        <View style={[styles.searchBox, searchFocused && styles.searchBoxFocused]}>
          <MaterialIcons
            name="search"
            size={21}
            color={searchFocused ? colors.accentLink : colors.textMuted}
          />
          <TextInput
            value={explore.search}
            onChangeText={explore.handleSearchChange}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Buscar filme, série ou gênero"
            placeholderTextColor={colors.textMuted}
            selectionColor={colors.accentLink}
            style={styles.searchInput}
            returnKeyType="search"
            accessibilityLabel="Pesquisar títulos"
          />
          {explore.search.length > 0 && (
            <Pressable
              onPress={() => explore.handleSearchChange('')}
              hitSlop={10}
              accessibilityLabel="Limpar busca">
              <AppIcon name="close" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.filterButton,
            explore.activeSheetFilterCount > 0 && styles.filterButtonActive,
            pressed && styles.pressed,
          ]}
          onPress={() => setFiltersVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={
            explore.activeSheetFilterCount > 0
              ? `Abrir filtros (${explore.activeSheetFilterCount} ${explore.activeSheetFilterCount === 1 ? 'ativo' : 'ativos'})`
              : 'Abrir filtros e ordenação'
          }>
          <AppIcon
            name="tune"
            size={21}
            color={explore.activeSheetFilterCount > 0 ? colors.savedActiveText : colors.textPrimary}
          />
          {explore.activeSheetFilterCount > 0 && (
            <View style={styles.filterCount}>
              <AppText peso="forte" tabular style={styles.filterCountText}>
                {explore.activeSheetFilterCount}
              </AppText>
            </View>
          )}
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.quickFilters}>
        {(['Todos', 'Filme', 'Série', 'Anime'] as const).map((filter) => (
          <Pressable
            key={filter}
            onPress={() => explore.setKindFilter(filter)}
            style={({ pressed }) => [
              styles.quickChip,
              explore.kindFilter === filter && styles.quickChipActive,
              pressed && styles.pressed,
            ]}>
            <AppText
              tipo="legenda"
              peso="forte"
              style={explore.kindFilter === filter ? styles.quickTextActive : styles.quickText}>
              {filter === 'Todos'
                ? 'Todos'
                : filter === 'Filme'
                  ? 'Filmes'
                  : filter === 'Série'
                    ? 'Séries'
                    : 'Animes'}
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
        data={explore.results}
        keyExtractor={(item) => item.id}
        renderItem={renderTitleItem}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.container,
          { paddingBottom: Math.max(124, 108 + insets.bottom) },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={5}
        onViewableItemsChanged={explore.handleViewableItemsChanged}
        refreshControl={
          <RefreshControl
            refreshing={explore.pullRefreshing}
            onRefresh={() => {
              void explore.handlePullRefresh();
            }}
            tintColor={colors.accentLink}
            colors={[colors.accentLink, colors.accentPrimary]}
            progressBackgroundColor={colors.bgSurface}
          />
        }
        ListHeaderComponent={
          <View>
            <FadeInBlock delay={0}>
              {explore.activeFilterChips.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.activeChipsRow}>
                  {explore.activeFilterChips.map((chip) => (
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
                  {explore.activeFilterChips.length > 1 && (
                    <Pressable
                      onPress={explore.clearAllFilters}
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
                    {explore.search.trim() ? 'Resultados da busca' : 'Títulos para assistir'}
                  </AppText>
                  <AppText tipo="legenda" tabular style={styles.resultsSubtitle}>
                    {explore.searchLoading
                      ? 'Pesquisando no catálogo online…'
                      : explore.isInitialCatalogLoading
                        ? 'Carregando catálogo…'
                        : explore.hasActiveFilter
                          ? `${formatCount(explore.results.length)} de ${formatCount(explore.availableTitles.length)} títulos`
                          : explore.isFetchingCatalog
                            ? `${formatCount(explore.availableTitles.length)} ${explore.availableTitles.length === 1 ? 'título disponível' : 'títulos disponíveis'} · carregando mais…`
                            : `${formatCount(explore.availableTitles.length)} ${explore.availableTitles.length === 1 ? 'título disponível' : 'títulos disponíveis'}`}
                  </AppText>
                </View>
              </View>

              {explore.searchError && (
                <AppText tipo="legenda" style={styles.searchError}>
                  {explore.searchError}
                </AppText>
              )}
            </FadeInBlock>
          </View>
        }
        ListEmptyComponent={
          <FadeInBlock delay={60}>
            {explore.isInitialCatalogLoading ? (
              <EmptyStateCard
                icon="autorenew"
                spinIcon
                title="Carregando catálogo…"
                description="Buscando os primeiros títulos dos seus streamings ativos."
                style={styles.emptyState}
              />
            ) : (
              <EmptyStateCard
                icon={explore.activeServicesCount > 0 ? 'search-off' : 'subscriptions'}
                title={
                  explore.activeServicesCount > 0
                    ? 'Nenhum título encontrado'
                    : 'Adicione um streaming'
                }
                description={
                  explore.activeServicesCount > 0
                    ? 'Experimente outro termo ou remova alguns filtros.'
                    : 'Os títulos dos seus serviços ativos aparecem aqui.'
                }
                actionLabel={
                  explore.activeServicesCount === 0
                    ? 'Gerenciar assinaturas'
                    : explore.hasResettableFilters
                      ? 'Limpar filtros'
                      : undefined
                }
                onAction={
                  explore.activeServicesCount === 0
                    ? () => router.push('/subscriptions')
                    : explore.hasResettableFilters
                      ? explore.clearAllFilters
                      : undefined
                }
                style={styles.emptyState}
              />
            )}
          </FadeInBlock>
        }
      />

      <ExploreFiltersModal
        visible={filtersVisible}
        onClose={() => setFiltersVisible(false)}
        search={explore.search}
        sortBy={explore.sortBy}
        onChangeSortBy={explore.setSortBy}
        serviceNames={explore.serviceNames}
        selectedServices={explore.selectedServices}
        onClearServices={() => explore.setSelectedServices([])}
        onToggleService={explore.toggleService}
        genres={explore.genres}
        selectedGenres={explore.selectedGenres}
        onClearGenres={() => explore.setSelectedGenres([])}
        onToggleGenre={explore.toggleGenre}
        ratingFilter={explore.ratingFilter}
        onChangeRatingFilter={explore.setRatingFilter}
        resultsCount={explore.results.length}
        hasResettableFilters={explore.hasResettableFilters}
        onClearAllFilters={explore.clearAllFilters}
      />
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) => ({
  safeArea: { flex: 1, backgroundColor: theme.colors.bgPrimary },
  container: {
    width: '100%' as const,
    maxWidth: 640,
    alignSelf: 'center' as const,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 34,
  },
  pressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  searchRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    marginBottom: 10,
    overflow: 'visible' as const,
  },
  searchBox: {
    flex: 1,
    minHeight: 50,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 9,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bgSurface,
  },
  searchBoxFocused: { borderColor: theme.colors.borderFocused },
  searchInput: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontFamily: FONT_FAMILIES.sans.regular,
    fontSize: 16,
    lineHeight: 22,
    paddingVertical: 10,
  },
  filterButton: {
    width: 50,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bgSurface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'visible' as const,
  },
  filterButtonActive: {
    borderColor: theme.colors.savedActiveBorder,
    backgroundColor: theme.colors.savedActiveBg,
  },
  filterCount: {
    position: 'absolute' as const,
    top: -6,
    right: -6,
    zIndex: 2,
    minWidth: 21,
    height: 21,
    paddingHorizontal: 5,
    borderRadius: 10.5,
    borderWidth: 2,
    borderColor: theme.colors.bgPrimary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.colors.accentPrimary,
  },
  filterCountText: { color: theme.colors.textOnAccent, fontSize: 10.5, lineHeight: 13 },
  quickFilters: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingBottom: 2,
  },
  quickChip: {
    borderWidth: 1,
    borderColor: theme.colors.chipBorder,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.colors.chipBg,
  },
  quickChipActive: {
    borderColor: theme.colors.chipSelectedBorder,
    backgroundColor: theme.colors.chipSelectedBg,
  },
  quickText: { color: theme.colors.chipText, fontSize: 13 },
  quickTextActive: { color: theme.colors.chipSelectedText, fontSize: 13 },
  activeChipsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 7,
    paddingBottom: 14,
  },
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
  resultsHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    gap: 10,
    marginTop: 4,
    marginBottom: 12,
  },
  resultsHeaderCopy: { flex: 1 },
  resultsTitle: { color: theme.colors.textPrimary, fontSize: 18, lineHeight: 23 },
  resultsSubtitle: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 2 },
  searchError: { color: theme.colors.dangerText, marginBottom: 8 },
  savedButtonActive: {
    backgroundColor: theme.colors.savedActiveBg,
    borderWidth: 1,
    borderColor: theme.colors.savedActiveBorder,
  },
  emptyState: { marginTop: 10 },
});
