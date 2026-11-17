import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/atoms/AppText';
import { DrawHistoryCard } from '@/components/organisms/DrawHistoryCard';
import { useAuth } from '@/contexts/AuthContext';
import { useCatalog } from '@/contexts/CatalogContext';
import { useDrawHistory } from '@/contexts/DrawHistoryContext';
import { useMyList } from '@/contexts/MyListContext';
import { useSubscriptions } from '@/contexts/SubscriptionsContext';

const PREVIEW_HISTORY_LIMIT = 3;
const countFormat = new Intl.NumberFormat('pt-BR');

export default function ProfileTabScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const { subscriptions } = useSubscriptions();
  const { savedTitles, findSavedTitle, refreshMyList } = useMyList();
  const { titles, status, errorMessage, findTitle, refreshCatalog } = useCatalog();
  const { history, refreshDrawHistory } = useDrawHistory();

  useFocusEffect(
    useCallback(() => {
      void refreshMyList({ minIntervalMs: 3000 });
      void refreshDrawHistory({ minIntervalMs: 3000 });
    }, [refreshDrawHistory, refreshMyList]),
  );

  const activeSubscriptions = useMemo(
    () => subscriptions.filter((subscription) => subscription.active),
    [subscriptions],
  );
  const monthlyTotal = useMemo(
    () => activeSubscriptions.reduce((total, subscription) => total + subscription.monthlyPrice, 0),
    [activeSubscriptions],
  );
  const watchedCount = useMemo(
    () => history.filter((entry) => entry.acao === 'assistiu').length,
    [history],
  );
  const previewHistory = useMemo(
    () => history.slice(0, PREVIEW_HISTORY_LIMIT),
    [history],
  );
  const initials = user?.name.trim().charAt(0).toLocaleUpperCase() ?? '?';

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: Math.max(108, 92 + insets.bottom) }]} showsVerticalScrollIndicator={false}>
        <AppText tipo="legenda" peso="forte" style={styles.eyebrow}>MEU PERFIL</AppText>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <AppText peso="forte" style={styles.avatarText}>{initials}</AppText>
          </View>
          <AppText tipo="subtitulo" familia="editorial" peso="forte" style={styles.name}>{user?.name ?? 'Usuário'}</AppText>
          <AppText tipo="legenda" style={styles.muted}>{user?.email ?? ''}</AppText>
        </View>

        <AppText tipo="subtitulo" peso="forte" style={styles.sectionTitle}>Resumo da sua conta</AppText>
        <View style={styles.stats}>
          <View style={styles.stat}>
            <AppText tipo="subtitulo" peso="forte" tabular style={styles.number}>{activeSubscriptions.length}</AppText>
            <AppText tipo="legenda" style={styles.muted}>ativas</AppText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <AppText tipo="subtitulo" peso="forte" tabular style={styles.number}>{watchedCount}</AppText>
            <AppText tipo="legenda" style={styles.muted}>assistidos</AppText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <AppText tipo="subtitulo" peso="forte" tabular style={styles.number}>
              <AppText tipo="legenda" peso="semiforte" style={styles.currencyPrefix}>R$ </AppText>
              {monthlyTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </AppText>
            <AppText tipo="legenda" style={styles.muted}>por mês</AppText>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          onPress={() => router.push('/my-list')}
          accessibilityRole="button">
          <MaterialIcons name="bookmark" size={22} color="#a3520d" />
          <AppText peso="forte" style={styles.rowText}>Minha Lista</AppText>
          <AppText tipo="legenda" peso="forte" tabular style={styles.rowCount}>
            {savedTitles.length}
          </AppText>
          <MaterialIcons name="chevron-right" size={22} color="#7b7b78" />
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          onPress={() => router.push('/subscriptions')}
          accessibilityRole="button">
          <MaterialIcons name="subscriptions" size={22} color="#a3520d" />
          <AppText peso="forte" style={styles.rowText}>Gerenciar assinaturas</AppText>
          <MaterialIcons name="chevron-right" size={22} color="#7b7b78" />
        </Pressable>

        <View style={styles.historySection}>
          <View style={styles.historyHeader}>
            <View style={styles.historyHeaderCopy}>
              <AppText tipo="subtitulo" peso="forte" style={styles.historyTitle}>Histórico de sorteios</AppText>
              <AppText tipo="legenda" style={styles.muted}>
                {history.length === 0
                  ? 'Seus últimos sorteios na Roleta'
                  : `${countFormat.format(history.length)} ${history.length === 1 ? 'sorteio registrado' : 'sorteios registrados'}`}
              </AppText>
            </View>
            {history.length > 0 && (
              <Pressable
                style={({ pressed }) => [styles.seeAllLinkBtn, pressed && styles.pressed]}
                onPress={() => router.push('/draw-history')}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Ver todo o histórico de sorteios">
                <AppText tipo="legenda" peso="forte" style={styles.seeAllText}>Ver tudo</AppText>
                <MaterialIcons name="chevron-right" size={18} color="#a3520d" />
              </Pressable>
            )}
          </View>

          {previewHistory.length > 0 ? (
            <View style={styles.historyList}>
              {previewHistory.map((entry) => {
                const resolved = findTitle(entry.tmdbId) ?? findSavedTitle(entry.tmdbId);
                return (
                  <DrawHistoryCard
                    key={entry.id}
                    entry={entry}
                    resolvedTitle={resolved}
                    onPress={resolved ? () => router.push({ pathname: '/title/[id]', params: { id: resolved.id } }) : undefined}
                  />
                );
              })}
            </View>
          ) : (
            <View style={styles.historyEmptyCard}>
              <View style={styles.historyEmptyIcon}>
                <MaterialIcons name="casino" size={22} color="#a3520d" />
              </View>
              <AppText peso="forte" style={styles.historyEmptyTitle}>
                Nenhum sorteio registrado
              </AppText>
              <AppText tipo="legenda" style={styles.historyEmptyText}>
                Gire a Roleta na tela inicial para registrar o que você assistiu, salvou ou pulou.
              </AppText>
              <Pressable
                style={({ pressed }) => [styles.historyEmptyCta, pressed && styles.pressed]}
                onPress={() => router.push('/(tabs)')}
                accessibilityRole="button">
                <AppText tipo="legenda" peso="forte" style={styles.historyEmptyCtaText}>Ir para a Roleta</AppText>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.catalogNotice}>
          <View style={styles.catalogNoticeCopy}>
            <AppText tipo="legenda" peso="forte" style={styles.catalogNoticeTitle}>
              {status === 'loading'
                ? 'Carregando catálogo completo…'
                : status === 'ready'
                  ? 'Catálogo conectado ao TMDB'
                  : status === 'needs-api-key'
                    ? 'Catálogo de demonstração'
                    : 'Falha ao atualizar catálogo'}
            </AppText>
            <AppText tipo="legenda" style={styles.catalogNoticeText}>
              {status === 'loading'
                ? 'Buscando filmes, séries e animes nos seus serviços ativos.'
                : status === 'ready'
                  ? `${countFormat.format(titles.length)} títulos sincronizados · disponibilidade no Brasil`
                  : status === 'needs-api-key'
                    ? 'Configure o Supabase ou EXPO_PUBLIC_TMDB_API_KEY para carregar títulos automaticamente.'
                    : errorMessage ?? 'Confira a conexão e tente novamente.'}
            </AppText>
          </View>
          <Pressable
            style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}
            onPress={() => { void refreshCatalog(); }}
            disabled={status === 'loading'}
            accessibilityRole="button"
            accessibilityLabel="Atualizar catálogo">
            <MaterialIcons name="refresh" size={20} color={status === 'loading' ? '#aaa59b' : '#a3520d'} />
          </Pressable>
        </View>

        <View style={styles.accountDangerSection}>
          <View style={styles.sectionDivider} />
          <Pressable
            style={({ pressed }) => [styles.logoutCard, pressed && styles.pressed]}
            onPress={() => { void handleSignOut(); }}
            accessibilityRole="button">
            <View style={styles.logoutIconBox}>
              <MaterialIcons name="logout" size={20} color="#c0392b" />
            </View>
            <AppText peso="forte" style={styles.logoutText}>Sair da conta</AppText>
            <MaterialIcons name="chevron-right" size={22} color="#c0392b" />
          </Pressable>
        </View>

        <AppText tipo="legenda" style={styles.credits}>
          Pôsteres e metadados: The Movie Database (TMDB). Este produto utiliza a API do TMDB, mas não é endossado ou certificado pelo TMDB.
        </AppText>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f5f0' },
  container: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  eyebrow: { color: '#e58c34', letterSpacing: 1.5, marginBottom: 14 },
  profileCard: { alignItems: 'center', backgroundColor: '#fffdf8', borderRadius: 22, borderWidth: 1, borderColor: '#e8e2d5', paddingVertical: 22, paddingHorizontal: 20, marginBottom: 22 },
  avatar: { width: 74, height: 74, borderRadius: 37, backgroundColor: '#182230', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { color: '#f3b43f', fontSize: 28 },
  name: { color: '#182230', fontSize: 22, lineHeight: 27, letterSpacing: -0.3, marginBottom: 3 },
  muted: { color: '#5e5c57', fontSize: 13, lineHeight: 18 },
  sectionTitle: { color: '#182230', fontSize: 18, lineHeight: 23, marginBottom: 12 },
  stats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: '#fffdf8', borderWidth: 1, borderColor: '#e8e2d5', borderRadius: 18, paddingVertical: 16, paddingHorizontal: 8, marginBottom: 20 },
  stat: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 34, backgroundColor: '#e8e2d5' },
  number: { color: '#182230', textAlign: 'center', fontSize: 18, lineHeight: 24, marginBottom: 2 },
  currencyPrefix: { color: '#657078', fontSize: 12.5, lineHeight: 18 },
  row: { minHeight: 58, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fffdf8', borderWidth: 1, borderColor: '#e8e2d5', borderRadius: 16, paddingHorizontal: 16, marginBottom: 10 },
  rowText: { color: '#182230', flex: 1, fontSize: 15, lineHeight: 20, marginLeft: 12 },
  rowCount: { color: '#8b5827', backgroundColor: '#f1e8d7', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, fontSize: 12, marginRight: 6 },
  historySection: { marginTop: 14, marginBottom: 18 },
  historyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 },
  historyHeaderCopy: { flex: 1 },
  historyTitle: { color: '#182230', fontSize: 18, lineHeight: 23 },
  seeAllLinkBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 6, paddingLeft: 8 },
  seeAllText: { color: '#a3520d', fontSize: 14, lineHeight: 19 },
  historyList: { gap: 8 },
  historyEmptyCard: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e8e2d5',
    backgroundColor: '#fffdf8',
  },
  historyEmptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#f1e8d7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  historyEmptyTitle: { color: '#182230', fontSize: 15, marginBottom: 4 },
  historyEmptyText: { color: '#5e5c57', fontSize: 13, lineHeight: 18, textAlign: 'center' },
  historyEmptyCta: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: '#f3b43f',
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  historyEmptyCtaText: { color: '#182230', fontSize: 13 },
  catalogNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5dac3',
    backgroundColor: '#f1e8d7',
    marginTop: 4,
  },
  catalogNoticeCopy: { flex: 1 },
  catalogNoticeTitle: { color: '#8b5827', fontSize: 13.5, lineHeight: 18, marginBottom: 2 },
  catalogNoticeText: { color: '#63594a', fontSize: 12.5, lineHeight: 17 },
  refreshButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#fffdf8',
  },
  accountDangerSection: { marginTop: 22 },
  sectionDivider: { height: 1, backgroundColor: '#e8e2d5', marginBottom: 18 },
  logoutCard: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffdf8',
    borderWidth: 1,
    borderColor: '#f1d6d3',
    borderRadius: 16,
    paddingHorizontal: 14,
  },
  logoutIconBox: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: '#fdecea',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: { color: '#c0392b', flex: 1, fontSize: 15, lineHeight: 20, marginLeft: 12 },
  credits: { color: '#6b5943', fontSize: 12.5, lineHeight: 18, textAlign: 'center', marginTop: 22 },
});
