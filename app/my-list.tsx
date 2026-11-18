import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/atoms/AppText';
import { BackButton } from '@/components/atoms/BackButton';
import { EmptyStateCard } from '@/components/organisms/EmptyStateCard';
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

  const openTitle = (title: MediaTitle) => {
    router.push({ pathname: '/title/[id]', params: { id: title.id } });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <BackButton fallbackHref="/(tabs)/tab3" />
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
          <EmptyStateCard
            icon="bookmark-border"
            iconColor="#d77c29"
            title="Sua lista está vazia"
            description={'Toque em "Salvar na minha lista" nos detalhes de qualquer filme, série ou anime para guardá-lo aqui.'}
            actionLabel="Explorar títulos"
            actionIcon="search"
            onAction={() => router.push('/(tabs)/tab2')}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f5f0' },
  container: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22 },
  headerCopy: { flex: 1 },
  eyebrow: { color: '#e58c34', letterSpacing: 1.5, marginBottom: 3 },
  title: { color: '#182230', fontSize: 25, lineHeight: 30, letterSpacing: -0.4 },
  countBadge: { color: '#565d63', backgroundColor: '#fffdf8', borderWidth: 1, borderColor: '#e8e2d5', borderRadius: 11, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13 },
  savedBadgeButton: { backgroundColor: '#fff2d8', borderWidth: 1, borderColor: '#e58c34' },
});
