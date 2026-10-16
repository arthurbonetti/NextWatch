import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/atoms/AppText';
import { ServiceLogo } from '@/components/atoms/ServiceLogo';
import { getArtworkUri, TitleArtwork } from '@/components/atoms/TitleArtwork';
import { CATALOG, MediaKind, MediaTitle } from '@/constants/catalog';
import { useSubscriptions } from '@/contexts/SubscriptionsContext';

type TypeFilter = 'Quero ver' | 'Assistidos' | 'Todos';
type RatingFilter = 'Qualquer nota' | '7+' | '8+';

const genres = ['Todos', ...Array.from(new Set(CATALOG.flatMap((title) => title.genres)))];

export default function ExploreScreen() {
  const { subscriptions } = useSubscriptions();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('Quero ver');
  const [kindFilter, setKindFilter] = useState<'Todos' | MediaKind>('Todos');
  const [genreFilter, setGenreFilter] = useState('Todos');
  const [serviceFilter, setServiceFilter] = useState('Todos');
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('Qualquer nota');
  const [watchedIds, setWatchedIds] = useState<string[]>([]);
  const [filtersVisible, setFiltersVisible] = useState(false);

  const activeServices = useMemo(() => new Set(subscriptions.filter((item) => item.active).map((item) => item.provider)), [subscriptions]);
  const availableTitles = useMemo(() => CATALOG.filter((title) => activeServices.has(title.service)), [activeServices]);
  const serviceNames = useMemo(() => ['Todos', ...Array.from(new Set(availableTitles.map((title) => title.service)))], [availableTitles]);
  const activeFilterCount = Number(kindFilter !== 'Todos')
    + Number(genreFilter !== 'Todos')
    + Number(serviceFilter !== 'Todos')
    + Number(ratingFilter !== 'Qualquer nota');

  const results = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return availableTitles.filter((title) => {
      const matchesQuery = query.length === 0
        || title.title.toLocaleLowerCase().includes(query)
        || title.genres.some((genre) => genre.toLocaleLowerCase().includes(query))
        || title.service.toLocaleLowerCase().includes(query);
      const matchesType = typeFilter === 'Todos'
        || (typeFilter === 'Assistidos' ? watchedIds.includes(title.id) : !watchedIds.includes(title.id));
      const matchesKind = kindFilter === 'Todos' || title.kind === kindFilter;
      const matchesGenre = genreFilter === 'Todos' || title.genres.includes(genreFilter);
      const matchesService = serviceFilter === 'Todos' || title.service === serviceFilter;
      const rating = Number(title.imdbRating.replace(',', '.'));
      const matchesRating = ratingFilter === 'Qualquer nota' || rating >= Number(ratingFilter.replace('+', ''));
      return matchesQuery && matchesType && matchesKind && matchesGenre && matchesService && matchesRating;
    });
  }, [availableTitles, genreFilter, kindFilter, ratingFilter, search, serviceFilter, typeFilter, watchedIds]);

  const toggleWatched = (id: string) => setWatchedIds((current) =>
    current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
  );
  const openTitle = (title: MediaTitle) => router.push({ pathname: '/title/[id]', params: { id: title.id } });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <AppText tipo="legenda" peso="forte" style={styles.eyebrow}>CATÁLOGO</AppText>
            <AppText tipo="titulo" peso="forte" style={styles.title}>Explore títulos</AppText>
          </View>
          <Pressable style={styles.filterButton} onPress={() => setFiltersVisible((value) => !value)} accessibilityRole="button" accessibilityLabel="Abrir filtros">
            <MaterialIcons name="tune" size={20} color="#182230" />
            {activeFilterCount > 0 && <View style={styles.filterCount}><AppText style={styles.filterCountText}>{activeFilterCount}</AppText></View>}
          </Pressable>
        </View>

        <View style={styles.searchBox}>
          <MaterialIcons name="search" size={21} color="#8b8a84" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar filme, série ou gênero"
            placeholderTextColor="#9a9993"
            style={styles.searchInput}
            returnKeyType="search"
            accessibilityLabel="Pesquisar títulos"
          />
          {search.length > 0 && <Pressable onPress={() => setSearch('')} accessibilityLabel="Limpar busca"><MaterialIcons name="close" size={18} color="#8b8a84" /></Pressable>}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickFilters}>
          {(['Quero ver', 'Assistidos', 'Todos'] as TypeFilter[]).map((filter) => (
            <Pressable key={filter} onPress={() => setTypeFilter(filter)} style={[styles.quickChip, typeFilter === filter && styles.quickChipActive]}>
              <AppText tipo="legenda" peso="forte" style={typeFilter === filter ? styles.quickTextActive : styles.quickText}>{filter}</AppText>
            </Pressable>
          ))}
          <View style={styles.quickDivider} />
          {(['Todos', 'Filme', 'Série'] as const).map((filter) => (
            <Pressable key={filter} onPress={() => setKindFilter(filter)} style={[styles.quickChip, kindFilter === filter && styles.quickChipActive]}>
              <AppText tipo="legenda" peso="forte" style={kindFilter === filter ? styles.quickTextActive : styles.quickText}>{filter === 'Todos' ? 'Tipo' : filter === 'Filme' ? 'Filmes' : 'Séries'}</AppText>
            </Pressable>
          ))}
        </ScrollView>

        {filtersVisible && <View style={styles.filterPanel}>
          <View style={styles.filterPanelHeader}>
            <AppText tipo="legenda" peso="forte" style={styles.filterLabel}>GÊNERO</AppText>
            {activeFilterCount > 0 && <Pressable onPress={() => { setKindFilter('Todos'); setGenreFilter('Todos'); setServiceFilter('Todos'); setRatingFilter('Qualquer nota'); }}><AppText tipo="legenda" peso="forte" style={styles.clearFilters}>Limpar filtros</AppText></Pressable>}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>
            {genres.map((genre) => <Pressable key={genre} onPress={() => setGenreFilter(genre)} style={[styles.filterChip, genreFilter === genre && styles.filterChipActive]}><AppText tipo="legenda" peso="forte" style={genreFilter === genre ? styles.filterChipTextActive : styles.filterChipText}>{genre}</AppText></Pressable>)}
          </ScrollView>
          <AppText tipo="legenda" peso="forte" style={[styles.filterLabel, styles.secondFilterLabel]}>STREAMING</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>
            {serviceNames.map((service) => <Pressable key={service} onPress={() => setServiceFilter(service)} style={[styles.filterChip, serviceFilter === service && styles.filterChipActive]}><AppText tipo="legenda" peso="forte" style={serviceFilter === service ? styles.filterChipTextActive : styles.filterChipText}>{service}</AppText></Pressable>)}
          </ScrollView>
          <AppText tipo="legenda" peso="forte" style={[styles.filterLabel, styles.secondFilterLabel]}>NOTA IMDb</AppText>
          <View style={styles.filterChips}>{(['Qualquer nota', '7+', '8+'] as RatingFilter[]).map((rating) => <Pressable key={rating} onPress={() => setRatingFilter(rating)} style={[styles.filterChip, ratingFilter === rating && styles.filterChipActive]}><AppText tipo="legenda" peso="forte" style={ratingFilter === rating ? styles.filterChipTextActive : styles.filterChipText}>{rating}</AppText></Pressable>)}</View>
        </View>}

        <View style={styles.resultsHeader}>
          <View>
            <AppText tipo="subtitulo" peso="forte" style={styles.resultsTitle}>{search.trim() ? 'Resultados da busca' : typeFilter === 'Assistidos' ? 'Assistidos' : 'Títulos para assistir'}</AppText>
            <AppText tipo="legenda" style={styles.resultsSubtitle}>{results.length} {results.length === 1 ? 'título' : 'títulos'} · seus streamings ativos</AppText>
          </View>
          <MaterialIcons name="sort" size={21} color="#8b8a84" />
        </View>

        {results.length > 0 ? results.map((title) => <ExploreResultCard key={title.id} title={title} watched={watchedIds.includes(title.id)} onOpen={() => openTitle(title)} onToggleWatched={() => toggleWatched(title.id)} />) : <View style={styles.emptyState}>
          <View style={styles.emptyIcon}><MaterialIcons name={activeServices.size > 0 ? 'search-off' : 'subscriptions'} size={26} color="#d77c29" /></View>
          <AppText tipo="subtitulo" peso="forte" style={styles.emptyTitle}>{activeServices.size > 0 ? 'Nenhum título encontrado' : 'Adicione um streaming'}</AppText>
          <AppText tipo="legenda" style={styles.emptyText}>{activeServices.size > 0 ? 'Experimente outro termo ou remova alguns filtros.' : 'Os títulos dos seus serviços ativos aparecem aqui.'}</AppText>
          {activeServices.size === 0 && <Pressable style={styles.emptyAction} onPress={() => router.push('/(tabs)/tab3')}><AppText tipo="legenda" peso="forte" style={styles.emptyActionText}>Gerenciar assinaturas</AppText></Pressable>}
        </View>}
      </ScrollView>
    </SafeAreaView>
  );
}

function ExploreResultCard({ title, watched, onOpen, onToggleWatched }: { title: MediaTitle; watched: boolean; onOpen: () => void; onToggleWatched: () => void }) {
  const hasArtwork = getArtworkUri(title.id, 'poster') !== null;
  return (
    <View style={styles.resultCard}>
      <Pressable style={[styles.poster, { backgroundColor: title.color }]} onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Abrir ${title.title}`}>
        <TitleArtwork id={title.id} variant="poster" />
        {!hasArtwork && <MaterialIcons name={title.icon} size={25} color="rgba(255,255,255,0.9)" />}
        <View style={[styles.posterRating, hasArtwork && styles.posterRatingCorner]}><MaterialIcons name="star" size={12} color="#f3b43f" /><AppText tipo="legenda" peso="forte" style={styles.posterRatingText}>{title.imdbRating}</AppText></View>
      </Pressable>
      <Pressable style={styles.resultCopy} onPress={onOpen} accessibilityRole="button">
        <AppText peso="forte" style={styles.resultTitle} numberOfLines={1}>{title.title}</AppText>
        <AppText tipo="legenda" style={styles.resultMeta}>{title.year} · {title.kind} · {title.duration}</AppText>
        <AppText tipo="legenda" style={styles.resultGenres} numberOfLines={1}>{title.genres.join(' · ')}</AppText>
        <View style={styles.serviceLine}><ServiceLogo name={title.service} size={14} /><AppText tipo="legenda" peso="forte" style={styles.serviceName}>{title.service}</AppText></View>
      </Pressable>
      <Pressable style={[styles.watchedButton, watched && styles.watchedButtonActive]} onPress={onToggleWatched} accessibilityRole="button" accessibilityLabel={watched ? 'Remover de assistidos' : 'Marcar como assistido'}>
        <MaterialIcons name={watched ? 'check' : 'visibility'} size={18} color={watched ? '#fffdf8' : '#657078'} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f5f0' },
  container: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 34 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  eyebrow: { color: '#e58c34', fontSize: 10, letterSpacing: 1.5, marginBottom: 4 },
  title: { color: '#182230', fontSize: 26, lineHeight: 32 },
  filterButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#fffdf8', alignItems: 'center', justifyContent: 'center' },
  filterCount: { position: 'absolute', top: -3, right: -3, minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e58c34' },
  filterCountText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  searchBox: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#fffdf8', marginBottom: 14 },
  searchInput: { flex: 1, color: '#182230', fontSize: 14, paddingVertical: 10 },
  quickFilters: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingBottom: 17 },
  quickChip: { borderWidth: 1, borderColor: '#ded8cd', borderRadius: 17, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fffdf8' },
  quickChipActive: { borderColor: '#182230', backgroundColor: '#182230' },
  quickText: { color: '#6c6b67', fontSize: 10 },
  quickTextActive: { color: '#fffdf8', fontSize: 10 },
  quickDivider: { width: 1, height: 24, backgroundColor: '#ded8cd', marginHorizontal: 2 },
  filterPanel: { padding: 13, borderRadius: 15, backgroundColor: '#f1e8d7', marginBottom: 16 },
  filterPanelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filterLabel: { color: '#7b7b78', fontSize: 9, letterSpacing: 0.9, marginBottom: 7 },
  clearFilters: { color: '#d77c29', fontSize: 9, marginBottom: 7 },
  secondFilterLabel: { marginTop: 10 },
  filterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  filterChip: { borderWidth: 1, borderColor: '#ded8cd', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#fffdf8' },
  filterChipActive: { borderColor: '#182230', backgroundColor: '#182230' },
  filterChipText: { color: '#6c6b67', fontSize: 9 },
  filterChipTextActive: { color: '#fffdf8', fontSize: 9 },
  resultsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 3, marginBottom: 12 },
  resultsTitle: { color: '#182230', fontSize: 18, lineHeight: 23 },
  resultsSubtitle: { color: '#7b7b78', fontSize: 10, marginTop: 2 },
  resultCard: { minHeight: 105, flexDirection: 'row', alignItems: 'center', padding: 9, borderRadius: 16, backgroundColor: '#fffdf8', marginBottom: 10 },
  poster: { width: 70, height: 87, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 7, overflow: 'hidden' },
  posterRatingCorner: { position: 'absolute', bottom: 5 },
  posterRating: { flexDirection: 'row', alignItems: 'center', gap: 2, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 2, backgroundColor: 'rgba(24,34,48,0.72)' },
  posterRatingText: { color: '#fffdf8', fontSize: 9 },
  resultCopy: { flex: 1, paddingHorizontal: 12, paddingVertical: 4 },
  resultTitle: { color: '#182230', fontSize: 13, marginBottom: 3 },
  resultMeta: { color: '#7b7b78', fontSize: 9 },
  resultGenres: { color: '#8d7a61', fontSize: 9, marginTop: 4 },
  serviceLine: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 7 },
  serviceName: { color: '#657078', fontSize: 9 },
  watchedButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1eee7' },
  watchedButtonActive: { backgroundColor: '#3e9b76' },
  emptyState: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 34, borderRadius: 17, backgroundColor: '#fffdf8', marginTop: 10 },
  emptyIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1e8d7', marginBottom: 11 },
  emptyTitle: { color: '#182230', fontSize: 14 },
  emptyText: { color: '#7b7b78', fontSize: 10, textAlign: 'center', marginTop: 5, lineHeight: 15 },
  emptyAction: { borderRadius: 11, backgroundColor: '#e58c34', paddingHorizontal: 14, paddingVertical: 9, marginTop: 13 },
  emptyActionText: { color: '#182230', fontSize: 10 },
});