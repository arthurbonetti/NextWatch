import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/atoms/AppText';
import { BackButton } from '@/components/atoms/BackButton';
import { BookmarkIcon } from '@/components/atoms/BookmarkIcon';
import { getArtworkUri, TitleArtwork } from '@/components/atoms/TitleArtwork';
import { TitleDetailsBody } from '@/components/organisms/TitleDetailsBody';
import { MediaTitle } from '@/constants/catalog';
import { useAuth } from '@/contexts/AuthContext';
import { useCatalog } from '@/contexts/CatalogContext';
import { useMyList } from '@/contexts/MyListContext';

export default function TitleDetailsScreen() {
  const { user, authReady } = useAuth();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const { status, findTitle } = useCatalog();
  const { isSaved, toggleSavedTitle, findSavedTitle } = useMyList();
  const normalizedId = Array.isArray(id) ? id[0] ?? '' : id ?? '';
  const [savedSnapshot, setSavedSnapshot] = useState<MediaTitle | null>(null);
  const liveTitle = normalizedId ? (findTitle(normalizedId) ?? findSavedTitle(normalizedId)) : undefined;
  const title = liveTitle ?? (savedSnapshot?.id === normalizedId ? savedSnapshot : undefined);
  const saved = title ? isSaved(title.id) : false;
  const [scrollEnabled, setScrollEnabled] = useState(false);

  if (!authReady) return null;
  if (!user) return <Redirect href="/(auth)/login" />;

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/tab2');
  };

  if (!title) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.notFound}><MaterialIcons name="movie-filter" size={40} color="#d77c29" /><AppText tipo="subtitulo" peso="forte" style={styles.title}>{status === 'loading' ? 'Carregando título…' : 'Título não encontrado'}</AppText><Pressable onPress={handleBack}><AppText peso="forte" style={styles.link}>Voltar</AppText></Pressable></View>
      </SafeAreaView>
    );
  }

  const handleToggleSaved = () => {
    setSavedSnapshot(title);
    toggleSavedTitle(title);
  };

  const hasArtwork = getArtworkUri(title.id, 'backdrop', {
    posterPath: title.tmdbPosterPath,
    backdropPath: title.tmdbBackdropPath,
  }) !== null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        scrollEnabled={scrollEnabled}
        showsVerticalScrollIndicator={false}>
        <View style={styles.topbar}>
          <BackButton onPress={handleBack} />
          <AppText tipo="legenda" peso="forte" style={styles.eyebrow}>DETALHES</AppText>
          <Pressable
            onPress={handleToggleSaved}
            hitSlop={6}
            style={({ pressed }) => [styles.iconButton, saved && styles.iconButtonSaved, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={saved ? 'Remover da lista' : 'Salvar na lista'}>
            <BookmarkIcon saved={saved} itemKey={title.id} size={22} color="#e58c34" />
          </Pressable>
        </View>
        <View style={[styles.poster, { backgroundColor: title.color }]}>
          <TitleArtwork id={title.id} variant="backdrop" posterPath={title.tmdbPosterPath} backdropPath={title.tmdbBackdropPath} />
          {!hasArtwork && <><MaterialIcons name={title.icon} size={64} color="rgba(255,255,255,0.9)" /><AppText tipo="legenda" peso="forte" style={styles.posterLabel}>{title.title.toUpperCase()}</AppText></>}
        </View>
        <TitleDetailsBody title={title} pillBackgroundColor="#fffdf8" onScrollEnabledChange={setScrollEnabled} />
        <Pressable
          style={({ pressed }) => [styles.primaryButton, saved && styles.primaryButtonSaved, pressed && styles.pressed]}
          onPress={handleToggleSaved}
          accessibilityRole="button">
          <MaterialIcons name={saved ? 'check' : 'bookmark-add'} size={19} color={saved ? '#f3b43f' : '#182230'} />
          <AppText peso="forte" style={[styles.primaryText, saved && styles.primaryTextSaved]}>
            {saved ? 'Salvo na minha lista' : 'Salvar na minha lista'}
          </AppText>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f5f0' },
  container: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 },
  pressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  eyebrow: { color: '#e58c34', letterSpacing: 1.5 },
  iconButton: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: '#e8e2d5', backgroundColor: '#fffdf8', alignItems: 'center', justifyContent: 'center' },
  iconButtonSaved: { borderColor: '#e58c34', backgroundColor: '#fff2d8' },
  poster: { height: 195, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(24,34,48,0.08)', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20, marginBottom: 14, overflow: 'hidden' },
  posterLabel: { color: '#fffdf8', letterSpacing: 1.2, textAlign: 'center' },
  title: { color: '#182230', fontSize: 26, lineHeight: 32, marginBottom: 4 },
  primaryButton: { minHeight: 50, borderRadius: 14, backgroundColor: '#f3b43f', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryButtonSaved: { backgroundColor: '#182230' },
  primaryText: { color: '#182230' },
  primaryTextSaved: { color: '#fffdf8' },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  link: { color: '#d77c29' },
});