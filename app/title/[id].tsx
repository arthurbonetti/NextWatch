import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/atoms/AppText';
import { ServiceLogo } from '@/components/atoms/ServiceLogo';
import { getArtworkUri, TitleArtwork } from '@/components/atoms/TitleArtwork';
import { getMetacriticScore, getTitleServices } from '@/constants/catalog';
import { useCatalog } from '@/contexts/CatalogContext';
import { fetchTitleDuration, getCachedTitleDuration } from '@/services/tmdb';

const SYNOPSIS_PREVIEW_LIMIT = 280;

export default function TitleDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { status, findTitle } = useCatalog();
  const title = findTitle(id);
  const [saved, setSaved] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [duration, setDuration] = useState(() => (title ? getCachedTitleDuration(title) : ''));

  useEffect(() => {
    setExpanded(false);
    if (!title) return;
    let active = true;
    setDuration(getCachedTitleDuration(title));
    void fetchTitleDuration(title).then((resolved) => {
      if (active) setDuration(resolved);
    });
    return () => {
      active = false;
    };
  }, [title]);

  if (!title) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.notFound}><MaterialIcons name="movie-filter" size={40} color="#d77c29" /><AppText tipo="subtitulo" peso="forte" style={styles.title}>{status === 'loading' ? 'Carregando título…' : 'Título não encontrado'}</AppText><Pressable onPress={() => router.back()}><AppText peso="forte" style={styles.link}>Voltar</AppText></Pressable></View>
      </SafeAreaView>
    );
  }

  const hasArtwork = getArtworkUri(title.id, 'backdrop', {
    posterPath: title.tmdbPosterPath,
    backdropPath: title.tmdbBackdropPath,
  }) !== null;
  const metacritic = getMetacriticScore(title);
  const isLongSynopsis = title.synopsis.length > SYNOPSIS_PREVIEW_LIMIT;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        scrollEnabled={isLongSynopsis && expanded}
        showsVerticalScrollIndicator={false}>
        <View style={styles.topbar}><Pressable onPress={() => router.back()} style={styles.iconButton} accessibilityLabel="Voltar"><MaterialIcons name="arrow-back" size={22} color="#182230" /></Pressable><AppText tipo="legenda" peso="forte" style={styles.eyebrow}>DETALHES</AppText><Pressable onPress={() => setSaved(!saved)} style={styles.iconButton} accessibilityLabel={saved ? 'Remover da lista' : 'Salvar na lista'}><MaterialIcons name={saved ? 'bookmark' : 'bookmark-border'} size={22} color="#e58c34" /></Pressable></View>
        <View style={[styles.poster, { backgroundColor: title.color }]}>
          <TitleArtwork id={title.id} variant="backdrop" posterPath={title.tmdbPosterPath} backdropPath={title.tmdbBackdropPath} />
          {!hasArtwork && <><MaterialIcons name={title.icon} size={64} color="rgba(255,255,255,0.9)" /><AppText tipo="legenda" peso="forte" style={styles.posterLabel}>{title.title.toUpperCase()}</AppText></>}
        </View>
        <AppText tipo="titulo" peso="forte" style={styles.title}>{title.title}</AppText>
        <AppText tipo="texto" style={styles.meta}>{title.year || 'Ano não informado'} · {title.kind} · {duration}</AppText>
        <View style={styles.ratingRow}>
          <View style={styles.ratingBadge}>
            <MaterialIcons name="star" size={16} color="#f3b43f" />
            <AppText peso="forte" style={styles.rating}>{title.imdbRating}</AppText>
            <AppText peso="forte" style={styles.imdb}>{title.ratingSource ?? 'IMDb'}</AppText>
          </View>
          {metacritic !== null && (
            <View style={[styles.metacriticBadge, metacritic >= 61 ? styles.mcGreen : metacritic >= 40 ? styles.mcYellow : styles.mcRed]}>
              <AppText peso="forte" style={styles.metacriticText}>{metacritic}</AppText>
              <AppText peso="forte" style={styles.metacriticLabel}>MC</AppText>
            </View>
          )}
          <View style={styles.provider}>{getTitleServices(title).map((serviceName) => <ServiceLogo key={serviceName} name={serviceName} size={38} />)}</View>
        </View>
        <AppText peso="medio" style={styles.genres}>{title.genres.join('  ·  ')}</AppText>
        <AppText tipo="subtitulo" peso="forte" style={styles.sectionTitle}>Sinopse</AppText>
        <AppText
          tipo="texto"
          style={[styles.description, isLongSynopsis && styles.descriptionWithToggle]}
          numberOfLines={isLongSynopsis && !expanded ? 4 : undefined}>
          {title.synopsis}
        </AppText>
        {isLongSynopsis && (
          <Pressable
            style={styles.expandButton}
            onPress={() => setExpanded((prev) => !prev)}
            accessibilityRole="button">
            <AppText tipo="legenda" peso="forte" style={styles.expandButtonText}>
              {expanded ? 'Mostrar menos' : 'Mostrar mais'}
            </AppText>
            <MaterialIcons
              name={expanded ? 'expand-less' : 'expand-more'}
              size={18}
              color="#d77c29"
            />
          </Pressable>
        )}
        <Pressable style={styles.primaryButton} onPress={() => setSaved(!saved)}><MaterialIcons name={saved ? 'check' : 'bookmark-add'} size={19} color="#182230" /><AppText peso="forte" style={styles.primaryText}>{saved ? 'Salvo na minha lista' : 'Salvar na minha lista'}</AppText></Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => router.back()}><AppText peso="forte" style={styles.secondaryText}>Voltar</AppText></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f5f0' },
  container: { padding: 16, paddingBottom: 20 },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  eyebrow: { color: '#e58c34', letterSpacing: 1.5 },
  iconButton: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#fffdf8', alignItems: 'center', justifyContent: 'center' },
  poster: { height: 195, borderRadius: 20, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20, marginBottom: 14, overflow: 'hidden' },
  posterLabel: { color: '#fffdf8', letterSpacing: 1.2, textAlign: 'center' },
  title: { color: '#182230', fontSize: 26, lineHeight: 32, marginBottom: 4 },
  meta: { color: '#7b7b78' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  ratingBadge: { height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 10, borderRadius: 11, backgroundColor: '#182230' },
  rating: { color: '#fffdf8', fontSize: 15, lineHeight: 18 },
  imdb: { color: '#f3b43f', fontSize: 10, lineHeight: 13, letterSpacing: 0.4 },
  metacriticBadge: { height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 10, borderRadius: 11 },
  mcGreen: { backgroundColor: '#2e8b57' },
  mcYellow: { backgroundColor: '#d49b27' },
  mcRed: { backgroundColor: '#c0392b' },
  metacriticText: { color: '#fffdf8', fontSize: 15, lineHeight: 18 },
  metacriticLabel: { color: 'rgba(255,253,248,0.9)', fontSize: 10, lineHeight: 13, letterSpacing: 0.4 },
  provider: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 'auto' },
  genres: { color: '#8d7a61', fontSize: 13, lineHeight: 18, letterSpacing: 0.2, marginTop: 10, marginBottom: 14 },
  sectionTitle: { color: '#182230', fontSize: 18, lineHeight: 22, marginBottom: 5 },
  description: { color: '#687078', lineHeight: 21, marginBottom: 20 },
  descriptionWithToggle: { marginBottom: 4 },
  expandButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 3, marginBottom: 14 },
  expandButtonText: { color: '#d77c29', fontSize: 13 },
  primaryButton: { minHeight: 48, borderRadius: 14, backgroundColor: '#f3b43f', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 },
  primaryText: { color: '#182230' },
  secondaryButton: { minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: '#d77c29' },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  link: { color: '#d77c29' },
});