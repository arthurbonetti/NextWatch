import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/atoms/AppText';
import { getArtworkUri, TitleArtwork } from '@/components/atoms/TitleArtwork';
import { TitleDetailsBody } from '@/components/organisms/TitleDetailsBody';
import { useCatalog } from '@/contexts/CatalogContext';

export default function TitleDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { status, findTitle } = useCatalog();
  const title = findTitle(id);
  const [saved, setSaved] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(false);

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        scrollEnabled={scrollEnabled}
        showsVerticalScrollIndicator={true}>
        <View style={styles.topbar}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Voltar">
            <MaterialIcons name="arrow-back" size={22} color="#182230" />
          </Pressable>
          <AppText tipo="legenda" peso="forte" style={styles.eyebrow}>DETALHES</AppText>
          <Pressable onPress={() => setSaved(!saved)} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={saved ? 'Remover da lista' : 'Salvar na lista'}>
            <MaterialIcons name={saved ? 'bookmark' : 'bookmark-border'} size={22} color="#e58c34" />
          </Pressable>
        </View>
        <View style={[styles.poster, { backgroundColor: title.color }]}>
          <TitleArtwork id={title.id} variant="backdrop" posterPath={title.tmdbPosterPath} backdropPath={title.tmdbBackdropPath} />
          {!hasArtwork && <><MaterialIcons name={title.icon} size={64} color="rgba(255,255,255,0.9)" /><AppText tipo="legenda" peso="forte" style={styles.posterLabel}>{title.title.toUpperCase()}</AppText></>}
        </View>
        <TitleDetailsBody title={title} pillBackgroundColor="#fffdf8" onScrollEnabledChange={setScrollEnabled} />
        <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} onPress={() => setSaved(!saved)} accessibilityRole="button">
          <MaterialIcons name={saved ? 'check' : 'bookmark-add'} size={19} color="#182230" />
          <AppText peso="forte" style={styles.primaryText}>{saved ? 'Salvo na minha lista' : 'Salvar na minha lista'}</AppText>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]} onPress={() => router.back()} accessibilityRole="button">
          <AppText peso="forte" style={styles.secondaryText}>Voltar ao catálogo</AppText>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f5f0' },
  container: { padding: 16, paddingBottom: 20 },
  pressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  eyebrow: { color: '#e58c34', letterSpacing: 1.5 },
  iconButton: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: '#e8e2d5', backgroundColor: '#fffdf8', alignItems: 'center', justifyContent: 'center' },
  poster: { height: 195, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(24,34,48,0.08)', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20, marginBottom: 14, overflow: 'hidden' },
  posterLabel: { color: '#fffdf8', letterSpacing: 1.2, textAlign: 'center' },
  title: { color: '#182230', fontSize: 26, lineHeight: 32, marginBottom: 4 },
  primaryButton: { minHeight: 50, borderRadius: 14, backgroundColor: '#f3b43f', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 },
  primaryText: { color: '#182230' },
  secondaryButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: '#d77c29' },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  link: { color: '#d77c29' },
});