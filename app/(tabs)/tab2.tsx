import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/atoms/AppText';
import { MediaTitleCard } from '@/components/organisms/MediaTitleCard';
import { GENRES, getTitleAverageRating, getTitleServices, matchesSearchQuery, MediaKind, MediaTitle, rankTitlesBySearchRelevance } from '@/constants/catalog';
import { FONT_FAMILIES } from '@/constants/typography';
import { useCatalog } from '@/contexts/CatalogContext';
import { useMyList } from '@/contexts/MyListContext';
import { useSubscriptions } from '@/contexts/SubscriptionsContext';

type TypeFilter = 'Quero ver' | 'Assistidos' | 'Todos';
type RatingFilter = 'Qualquer nota' | '7+' | '8+';

const countFormat = new Intl.NumberFormat('pt-BR');

export default function ExploreScreen() {
  const { titles, status, errorMessage, refreshCatalog, searchTitles } = useCatalog();
  const { isSaved, toggleSavedTitle } = useMyList();
  const { subscriptions } = useSubscriptions();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('Quero ver');
  const [kindFilter, setKindFilter] = useState<'Todos' | MediaKind>('Todos');
  const [genreFilter, setGenreFilter] = useState('Todos');
  const [serviceFilter, setServiceFilter] = useState('Todos');
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('Qualquer nota');
  const [watchedIds] = useState<string[]>([]);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [remoteResults, setRemoteResults] = useState<MediaTitle[] | null>(null);
  const [remoteQuery, setRemoteQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchErrorQuery, setSearchErrorQuery] = useState('');
  const searchRequestRef = useRef(0);

  const activeServices = useMemo(() => new Set(subscriptions.filter((item) => item.active).map((item) => item.provider)), [subscriptions]);
  const watchedSet = useMemo(() => new Set(watchedIds), [watchedIds]);
  const availableTitles = useMemo(() => titles.filter((title) =>
    getTitleServices(title).some((service) => activeServices.has(service))
  ), [activeServices, titles]);

  useEffect(() => {
    const query = search.trim();
    const requestId = ++searchRequestRef.current;
    if (query.length < 2) {
      return;
    }

    const timer = setTimeout(() => {
      setSearchLoading(true);
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
            setSearchErrorQuery(query.toLocaleLowerCase());
          }
        })
        .finally(() => {
          if (searchRequestRef.current === requestId) setSearchLoading(false);
        });
    }, 350);

    return () => clearTimeout(timer);
  }, [search, searchTitles]);

  const genres = useMemo(
    () => ['Todos', ...Array.from(new Set([...GENRES, ...titles.flatMap((title) => title.genres)]))],
    [titles],
  );
  const serviceNames = useMemo(
    () => ['Todos', ...Array.from(new Set(availableTitles.flatMap((title) => getTitleServices(title))))],
    [availableTitles],
  );
  const activeFilterCount = Number(kindFilter !== 'Todos')
    + Number(genreFilter !== 'Todos')
    + Number(serviceFilter !== 'Todos')
    + Number(ratingFilter !== 'Qualquer nota');

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
      const matchesType = typeFilter === 'Todos'
        || (typeFilter === 'Assistidos' ? watchedSet.has(title.id) : !watchedSet.has(title.id));
      const matchesKind = kindFilter === 'Todos' || title.kind === kindFilter;
      const matchesGenre = genreFilter === 'Todos' || title.genres.includes(genreFilter);
      const matchesService = serviceFilter === 'Todos' || getTitleServices(title).includes(serviceFilter);
      const rating = getTitleAverageRating(title);
      const matchesRating = ratingFilter === 'Qualquer nota' || rating >= Number(ratingFilter.replace('+', ''));
      return matchesType && matchesKind && matchesGenre && matchesService && matchesRating;
    });

    return rawQuery.length > 0 ? rankTitlesBySearchRelevance(filtered, rawQuery) : filtered;
  }, [availableTitles, genreFilter, kindFilter, ratingFilter, remoteQuery, remoteResults, search, serviceFilter, typeFilter, watchedSet]);

  const openTitle = useCallback((title: MediaTitle) => router.push({ pathname: '/title/[id]', params: { id: title.id } }), []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const saved = isSaved(item.id);
          return (
            <MediaTitleCard
              title={item}
              onOpen={() => openTitle(item)}
              actionIcon={saved ? 'bookmark' : 'bookmark-add'}
              actionLabel={saved ? 'Remover da minha lista' : 'Salvar na minha lista'}
              onAction={() => toggleSavedTitle(item)}
              actionButtonStyle={saved ? styles.savedButtonActive : undefined}
              actionIconColor={saved ? '#e58c34' : '#657078'}
            />
          );
        }}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={5}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <View>
                <AppText tipo="legenda" peso="forte" style={styles.eyebrow}>CATÁLOGO</AppText>
                <AppText tipo="titulo" peso="forte" style={styles.title}>Explore títulos</AppText>
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.filterButton,
                  filtersVisible && styles.filterButtonActive,
                  pressed && styles.pressed,
                ]}
                onPress={() => setFiltersVisible((value) => !value)}
                accessibilityRole="button"
                accessibilityLabel="Abrir filtros">
                <MaterialIcons name="tune" size={20} color="#182230" />
                {activeFilterCount > 0 && <View style={styles.filterCount}><AppText peso="forte" tabular style={styles.filterCountText}>{activeFilterCount}</AppText></View>}
              </Pressable>
            </View>

            <View style={styles.catalogNotice}>
              <View style={styles.catalogNoticeCopy}>
                <AppText tipo="legenda" peso="forte" style={styles.catalogNoticeTitle}>
                  {status === 'loading' ? 'Carregando catálogo completo…' : status === 'ready' ? 'Catálogo conectado ao TMDB' : status === 'needs-api-key' ? 'Catálogo de demonstração' : 'Falha ao atualizar catálogo'}
                </AppText>
                <AppText tipo="legenda" style={styles.catalogNoticeText}>
                  {status === 'loading'
                    ? 'Buscando todos os filmes, séries e animes nos seus serviços ativos.'
                    : status === 'ready'
                      ? 'Disponibilidade no Brasil · notas da comunidade TMDB'
                      : status === 'needs-api-key'
                        ? 'Configure EXPO_PUBLIC_TMDB_API_KEY para carregar títulos automaticamente.'
                        : errorMessage ?? 'Confira a conexão e tente novamente.'}
                </AppText>
              </View>
              <Pressable
                style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}
                onPress={() => { void refreshCatalog(); }}
                disabled={status === 'loading'}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Atualizar catálogo"
              >
                <MaterialIcons name="refresh" size={20} color={status === 'loading' ? '#aaa59b' : '#b66a24'} />
              </Pressable>
            </View>

            <View style={[styles.searchBox, searchFocused && styles.searchBoxFocused]}>
              <MaterialIcons name="search" size={21} color={searchFocused ? '#d77c29' : '#8b8a84'} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Buscar filme, série ou gênero"
                placeholderTextColor="#9a9993"
                selectionColor="#d77c29"
                style={styles.searchInput}
                returnKeyType="search"
                accessibilityLabel="Pesquisar títulos"
              />
              {search.length > 0 && (
                <Pressable onPress={() => setSearch('')} hitSlop={10} accessibilityLabel="Limpar busca">
                  <MaterialIcons name="close" size={18} color="#8b8a84" />
                </Pressable>
              )}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickFilters}>
              {(['Quero ver', 'Assistidos', 'Todos'] as TypeFilter[]).map((filter) => (
                <Pressable
                  key={filter}
                  onPress={() => setTypeFilter(filter)}
                  style={({ pressed }) => [
                    styles.quickChip,
                    typeFilter === filter && styles.quickChipActive,
                    pressed && styles.pressed,
                  ]}>
                  <AppText tipo="legenda" peso="forte" style={typeFilter === filter ? styles.quickTextActive : styles.quickText}>{filter}</AppText>
                </Pressable>
              ))}
              <View style={styles.quickDivider} />
              {(['Todos', 'Filme', 'Série', 'Anime'] as const).map((filter) => (
                <Pressable
                  key={filter}
                  onPress={() => setKindFilter(filter)}
                  style={({ pressed }) => [
                    styles.quickChip,
                    kindFilter === filter && styles.quickChipActive,
                    pressed && styles.pressed,
                  ]}>
                  <AppText tipo="legenda" peso="forte" style={kindFilter === filter ? styles.quickTextActive : styles.quickText}>{filter === 'Todos' ? 'Tipo' : filter === 'Filme' ? 'Filmes' : filter === 'Série' ? 'Séries' : 'Animes'}</AppText>
                </Pressable>
              ))}
            </ScrollView>

            {filtersVisible && <View style={styles.filterPanel}>
              <View style={styles.filterPanelHeader}>
                <AppText tipo="legenda" peso="forte" style={styles.filterLabel}>GÊNERO</AppText>
                {activeFilterCount > 0 && (
                  <Pressable
                    hitSlop={8}
                    onPress={() => { setKindFilter('Todos'); setGenreFilter('Todos'); setServiceFilter('Todos'); setRatingFilter('Qualquer nota'); }}>
                    <AppText tipo="legenda" peso="forte" style={styles.clearFilters}>Limpar filtros</AppText>
                  </Pressable>
                )}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>
                {genres.map((genre) => (
                  <Pressable
                    key={genre}
                    onPress={() => setGenreFilter(genre)}
                    style={({ pressed }) => [
                      styles.filterChip,
                      genreFilter === genre && styles.filterChipActive,
                      pressed && styles.pressed,
                    ]}>
                    <AppText tipo="legenda" peso="forte" style={genreFilter === genre ? styles.filterChipTextActive : styles.filterChipText}>{genre}</AppText>
                  </Pressable>
                ))}
              </ScrollView>
              <AppText tipo="legenda" peso="forte" style={[styles.filterLabel, styles.secondFilterLabel]}>STREAMING</AppText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>
                {serviceNames.map((service) => (
                  <Pressable
                    key={service}
                    onPress={() => setServiceFilter(service)}
                    style={({ pressed }) => [
                      styles.filterChip,
                      serviceFilter === service && styles.filterChipActive,
                      pressed && styles.pressed,
                    ]}>
                    <AppText tipo="legenda" peso="forte" style={serviceFilter === service ? styles.filterChipTextActive : styles.filterChipText}>{service}</AppText>
                  </Pressable>
                ))}
              </ScrollView>
              <AppText tipo="legenda" peso="forte" style={[styles.filterLabel, styles.secondFilterLabel]}>NOTA</AppText>
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
                    <AppText tipo="legenda" peso="forte" style={ratingFilter === rating ? styles.filterChipTextActive : styles.filterChipText}>{rating}</AppText>
                  </Pressable>
                ))}
              </View>
            </View>}

            <View style={styles.resultsHeader}>
              <View>
                <AppText tipo="subtitulo" peso="forte" style={styles.resultsTitle}>{search.trim() ? 'Resultados da busca' : typeFilter === 'Assistidos' ? 'Assistidos' : 'Títulos para assistir'}</AppText>
                <AppText tipo="legenda" tabular style={styles.resultsSubtitle}>
                  {searchLoading
                    ? 'Pesquisando no catálogo online…'
                    : status === 'ready'
                    ? `${countFormat.format(results.length)} de ${countFormat.format(availableTitles.length)} títulos disponíveis`
                    : `${countFormat.format(results.length)} ${results.length === 1 ? 'título' : 'títulos'} · seus streamings ativos`}
                </AppText>
              </View>
              <View style={styles.sortBadge}>
                <MaterialIcons name="auto-awesome" size={13} color="#d77c29" />
                <AppText tipo="legenda" peso="forte" style={styles.sortBadgeText}>
                  {search.trim() ? 'Relevância' : 'Catálogo BR'}
                </AppText>
              </View>
            </View>
            {searchError && searchErrorQuery === search.trim().toLocaleLowerCase() && <AppText tipo="legenda" style={styles.searchError}>{searchError}</AppText>}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}><MaterialIcons name={activeServices.size > 0 ? 'search-off' : 'subscriptions'} size={26} color="#d77c29" /></View>
            <AppText tipo="subtitulo" peso="forte" style={styles.emptyTitle}>{activeServices.size > 0 ? 'Nenhum título encontrado' : 'Adicione um streaming'}</AppText>
            <AppText tipo="legenda" style={styles.emptyText}>{activeServices.size > 0 ? 'Experimente outro termo ou remova alguns filtros.' : 'Os títulos dos seus serviços ativos aparecem aqui.'}</AppText>
            {activeServices.size === 0 && <Pressable style={({ pressed }) => [styles.emptyAction, pressed && styles.pressed]} onPress={() => router.push('/subscriptions')}><AppText tipo="legenda" peso="forte" style={styles.emptyActionText}>Gerenciar assinaturas</AppText></Pressable>}
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f5f0' },
  container: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 34 },
  pressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  eyebrow: { color: '#e58c34', letterSpacing: 1.5, marginBottom: 5 },
  title: { color: '#182230', fontSize: 25, lineHeight: 30 },
  filterButton: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: '#e8e2d5', backgroundColor: '#fffdf8', alignItems: 'center', justifyContent: 'center' },
  filterButtonActive: { borderColor: '#182230', backgroundColor: '#f1e8d7' },
  filterCount: { position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e58c34' },
  filterCountText: { color: '#fff', fontSize: 10, lineHeight: 14 },
  searchBox: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: '#e8e2d5', backgroundColor: '#fffdf8', marginBottom: 14 },
  searchBoxFocused: { borderColor: '#182230' },
  searchInput: { flex: 1, color: '#182230', fontFamily: FONT_FAMILIES.sans.regular, fontSize: 16, lineHeight: 22, paddingVertical: 10 },
  catalogNotice: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 14, borderWidth: 1, borderColor: '#e5dac3', backgroundColor: '#f1e8d7', marginBottom: 14 },
  catalogNoticeCopy: { flex: 1 },
  catalogNoticeTitle: { color: '#8b5827', fontSize: 13, lineHeight: 18, marginBottom: 2 },
  catalogNoticeText: { color: '#706555', fontSize: 12, lineHeight: 17 },
  refreshButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#fffdf8' },
  quickFilters: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 17 },
  quickChip: { borderWidth: 1, borderColor: '#ded8cd', borderRadius: 18, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: '#fffdf8' },
  quickChipActive: { borderColor: '#182230', backgroundColor: '#182230' },
  quickText: { color: '#6c6b67', fontSize: 12 },
  quickTextActive: { color: '#fffdf8', fontSize: 12 },
  quickDivider: { width: 1, height: 24, backgroundColor: '#ded8cd', marginHorizontal: 2 },
  filterPanel: { padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#e5dac3', backgroundColor: '#f1e8d7', marginBottom: 16 },
  filterPanelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filterLabel: { color: '#7b7b78', fontSize: 11, letterSpacing: 1, marginBottom: 8 },
  clearFilters: { color: '#d77c29', fontSize: 12, marginBottom: 8 },
  secondFilterLabel: { marginTop: 12 },
  filterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  filterChip: { borderWidth: 1, borderColor: '#ded8cd', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#fffdf8' },
  filterChipActive: { borderColor: '#182230', backgroundColor: '#182230' },
  filterChipText: { color: '#6c6b67', fontSize: 12 },
  filterChipTextActive: { color: '#fffdf8', fontSize: 12 },
  resultsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 3, marginBottom: 12 },
  resultsTitle: { color: '#182230', fontSize: 18, lineHeight: 23 },
  resultsSubtitle: { color: '#7b7b78', fontSize: 12, lineHeight: 17, marginTop: 2 },
  sortBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: '#f1e8d7' },
  sortBadgeText: { color: '#8b5827', fontSize: 12 },
  searchError: { color: '#c0392b', marginBottom: 8 },
  savedButtonActive: { backgroundColor: '#fff2d8', borderWidth: 1, borderColor: '#e58c34' },
  emptyState: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 36, borderRadius: 18, borderWidth: 1, borderColor: '#e8e2d5', backgroundColor: '#fffdf8', marginTop: 10 },
  emptyIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1e8d7', marginBottom: 11 },
  emptyTitle: { color: '#182230', fontSize: 16 },
  emptyText: { color: '#7b7b78', fontSize: 12, textAlign: 'center', marginTop: 5, lineHeight: 18 },
  emptyAction: { borderRadius: 12, backgroundColor: '#f3b43f', paddingHorizontal: 16, paddingVertical: 10, marginTop: 14 },
  emptyActionText: { color: '#182230', fontSize: 12 },
});
