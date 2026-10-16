import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/atoms/AppText';
import { CATALOG } from '@/constants/catalog';

export default function TitleDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const title = CATALOG.find((item) => item.id === id);
  const [saved, setSaved] = useState(false);

  if (!title) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.notFound}><MaterialIcons name="movie-filter" size={40} color="#d77c29" /><AppText tipo="subtitulo" peso="forte" style={styles.title}>Título não encontrado</AppText><Pressable onPress={() => router.back()}><AppText peso="forte" style={styles.link}>Voltar</AppText></Pressable></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.topbar}><Pressable onPress={() => router.back()} style={styles.iconButton} accessibilityLabel="Voltar"><MaterialIcons name="arrow-back" size={22} color="#182230" /></Pressable><AppText tipo="legenda" peso="forte" style={styles.eyebrow}>DETALHES</AppText><Pressable onPress={() => setSaved(!saved)} style={styles.iconButton} accessibilityLabel={saved ? 'Remover da lista' : 'Salvar na lista'}><MaterialIcons name={saved ? 'bookmark' : 'bookmark-border'} size={22} color="#e58c34" /></Pressable></View>
        <View style={[styles.poster, { backgroundColor: title.color }]}><MaterialIcons name={title.icon} size={64} color="rgba(255,255,255,0.9)" /><AppText tipo="legenda" peso="forte" style={styles.posterLabel}>{title.title.toUpperCase()}</AppText></View>
        <AppText tipo="titulo" peso="forte" style={styles.title}>{title.title}</AppText>
        <AppText tipo="texto" style={styles.meta}>{title.year} · {title.kind} · {title.duration}</AppText>
        <View style={styles.ratingRow}><MaterialIcons name="star" size={25} color="#e7a82e" /><AppText tipo="subtitulo" peso="forte" style={styles.rating}>{title.imdbRating}</AppText><AppText tipo="legenda" peso="forte" style={styles.imdb}>IMDb</AppText><View style={styles.provider}><MaterialIcons name="play-circle-outline" size={17} color="#f3b43f" /><AppText tipo="legenda" peso="forte" style={styles.providerText}>{title.service}</AppText></View></View>
        <View style={styles.tags}>{title.genres.map((genre) => <AppText key={genre} tipo="legenda" peso="forte" style={styles.tag}>{genre}</AppText>)}</View>
        <AppText tipo="subtitulo" peso="forte" style={styles.sectionTitle}>Sinopse</AppText><AppText tipo="texto" style={styles.description}>{title.synopsis}</AppText>
        <Pressable style={styles.primaryButton} onPress={() => setSaved(!saved)}><MaterialIcons name={saved ? 'check' : 'bookmark-add'} size={19} color="#182230" /><AppText peso="forte" style={styles.primaryText}>{saved ? 'Salvo na minha lista' : 'Salvar na minha lista'}</AppText></Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => router.back()}><AppText peso="forte" style={styles.secondaryText}>Voltar</AppText></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f5f0' },
  container: { padding: 20, paddingBottom: 32 },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  eyebrow: { color: '#e58c34', letterSpacing: 1.5 },
  iconButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#fffdf8', alignItems: 'center', justifyContent: 'center' },
  poster: { height: 245, borderRadius: 22, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 30, marginBottom: 22 },
  posterLabel: { color: '#fffdf8', letterSpacing: 1.2, textAlign: 'center' },
  title: { color: '#182230', fontSize: 28, lineHeight: 34, marginBottom: 6 },
  meta: { color: '#7b7b78' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 19 },
  rating: { color: '#182230', fontSize: 20, lineHeight: 25 },
  imdb: { color: '#74736f', marginLeft: 2 },
  provider: { flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 'auto', borderRadius: 12, backgroundColor: '#182230', paddingHorizontal: 11, paddingVertical: 8 },
  providerText: { color: '#fffdf8' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18, marginBottom: 26 },
  tag: { color: '#6b5a43', backgroundColor: '#f1e8d7', borderRadius: 15, paddingHorizontal: 11, paddingVertical: 7 },
  sectionTitle: { color: '#182230', fontSize: 19, lineHeight: 24, marginBottom: 8 },
  description: { color: '#687078', lineHeight: 22, marginBottom: 25 },
  primaryButton: { minHeight: 52, borderRadius: 14, backgroundColor: '#f3b43f', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10 },
  primaryText: { color: '#182230' },
  secondaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: '#d77c29' },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  link: { color: '#d77c29' },
});