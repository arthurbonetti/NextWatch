import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/atoms/AppText';
import { BackButton } from '@/components/atoms/BackButton';
import { MediaTitleCard } from '@/components/organisms/MediaTitleCard';
import { MediaTitle } from '@/constants/catalog';
import { useAuth } from '@/contexts/AuthContext';
import { useMyList } from '@/contexts/MyListContext';

export default function MyListScreen() {
  const { user, authReady } = useAuth();
  const { savedTitles, storageReady, removeFromMyList, refreshMyList } = useMyList();

  useFocusEffect(
    useCallback(() => {
      void refreshMyList();
    }, [refreshMyList]),
  );

  if (!authReady) return null;
  if (!user) return <Redirect href="/(auth)/login" />;

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/tab3');
  };

  const openTitle = (title: MediaTitle) => {
    router.push({ pathname: '/title/[id]', params: { id: title.id } });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <BackButton onPress={handleBack} />
          <View style={styles.headerCopy}>
            <AppText tipo="legenda" peso="forte" style={styles.eyebrow}>SUA COLEÇÃO</AppText>
            <AppText tipo="titulo" peso="forte" style={styles.title}>Minha Lista</AppText>
          </View>
          <AppText tipo="legenda" peso="forte" tabular style={styles.countBadge}>
            {savedTitles.length} {savedTitles.length === 1 ? 'obra' : 'obras'}
          </AppText>
        </View>

        {savedTitles.length > 0 ? (
          <View>
            {savedTitles.map((title) => (
              <MediaTitleCard
                key={title.id}
                title={title}
                onOpen={() => openTitle(title)}
                actionIcon="bookmark"
                actionLabel={`Remover ${title.title} da minha lista`}
                onAction={() => removeFromMyList(title.id)}
                actionButtonStyle={styles.savedBadgeButton}
                actionIconColor="#e58c34"
              />
            ))}
          </View>
        ) : storageReady ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="bookmark-border" size={26} color="#d77c29" />
            </View>
            <AppText tipo="subtitulo" peso="forte" style={styles.emptyTitle}>
              Sua lista está vazia
            </AppText>
            <AppText tipo="legenda" style={styles.emptyDescription}>
              Toque em &quot;Salvar na minha lista&quot; nos detalhes de qualquer filme, série ou anime para guardá-lo aqui.
            </AppText>
            <Pressable
              style={({ pressed }) => [styles.emptyButton, pressed && styles.pressed]}
              onPress={() => router.push('/(tabs)/tab2')}
              accessibilityRole="button">
              <MaterialIcons name="search" size={18} color="#182230" />
              <AppText peso="forte" style={styles.emptyButtonText}>Explorar títulos</AppText>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f5f0' },
  container: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22 },
  headerCopy: { flex: 1 },
  eyebrow: { color: '#e58c34', letterSpacing: 1.5, marginBottom: 3 },
  title: { color: '#182230', fontSize: 25, lineHeight: 30, letterSpacing: -0.4 },
  countBadge: { color: '#565d63', backgroundColor: '#fffdf8', borderWidth: 1, borderColor: '#e8e2d5', borderRadius: 11, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13 },
  savedBadgeButton: { backgroundColor: '#fff2d8', borderWidth: 1, borderColor: '#e58c34' },
  emptyState: { alignItems: 'center', paddingHorizontal: 26, paddingVertical: 36, borderRadius: 18, borderWidth: 1, borderColor: '#e8e2d5', backgroundColor: '#fffdf8' },
  emptyIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#f1e8d7', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { color: '#182230', fontSize: 17, lineHeight: 22 },
  emptyDescription: { color: '#5e5c57', textAlign: 'center', fontSize: 13, lineHeight: 19, marginTop: 6 },
  emptyButton: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 13, paddingHorizontal: 18, paddingVertical: 11, backgroundColor: '#f3b43f', marginTop: 16 },
  emptyButtonText: { color: '#182230', fontSize: 13 },
});
