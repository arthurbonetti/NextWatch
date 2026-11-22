import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useFocusEffect } from 'expo-router';
import { ComponentProps, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/atoms/AppText';
import { FadeInBlock } from '@/components/atoms/FadeInBlock';
import { SpinningIcon } from '@/components/atoms/SpinningIcon';
import { UserAvatar } from '@/components/atoms/UserAvatar';
import { DrawHistoryCard } from '@/components/organisms/DrawHistoryCard';
import { EmptyStateCard } from '@/components/organisms/EmptyStateCard';
import { ScreenHeader } from '@/components/organisms/ScreenHeader';
import { Theme, ThemeMode } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';
import { useCatalog } from '@/hooks/useCatalog';
import { useDrawHistory } from '@/hooks/useDrawHistory';
import { useMyList } from '@/hooks/useMyList';
import { useProfile } from '@/hooks/useProfile';
import { useWatchedProgressIds } from '@/hooks/useSeriesProgress';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { formatCount } from '@/utils/format';
import { triggerSelectionHaptic } from '@/utils/haptics';
import { buildWatchedTitleIdsOrdered, computeMyListsCounts } from '@/utils/watchedProgress';

const PREVIEW_HISTORY_LIMIT = 3;

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

const THEME_OPTIONS: { id: ThemeMode; label: string; icon: MaterialIconName }[] = [
  { id: 'light', label: 'Claro', icon: 'light-mode' },
  { id: 'dark', label: 'Escuro', icon: 'dark-mode' },
  { id: 'system', label: 'Sistema', icon: 'brightness-auto' },
];

export default function ProfileTabScreen() {
  const insets = useSafeAreaInsets();
  const { colors, themeMode, resolvedMode, setThemeMode } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { user, token, signOut } = useAuth();
  const { profile, refreshProfile } = useProfile();
  const { subscriptions } = useSubscriptions();
  const { savedTitles, findSavedTitle, refreshMyList } = useMyList();
  const { titles, status, isFetchingCatalog, errorMessage, findTitle, refreshCatalog } = useCatalog();
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const isScrolled = event.nativeEvent.contentOffset.y > 6;
    setScrolled((prev) => (prev === isScrolled ? prev : isScrolled));
  }, []);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  const isRefreshingCatalog = status === 'loading' || isFetchingCatalog || isManualRefreshing;

  const handleRefreshCatalog = async () => {
    if (isRefreshingCatalog) return;
    setIsManualRefreshing(true);
    const startedAt = Date.now();
    try {
      await refreshCatalog();
    } finally {
      const remaining = Math.max(0, 650 - (Date.now() - startedAt));
      if (remaining === 0) {
        setIsManualRefreshing(false);
      } else {
        refreshTimerRef.current = setTimeout(() => {
          refreshTimerRef.current = null;
          setIsManualRefreshing(false);
        }, remaining);
      }
    }
  };
  const { history, refreshDrawHistory } = useDrawHistory();
  const { progressTitleIds, refreshProgressIds } = useWatchedProgressIds(user?.id ?? null, token);

  useFocusEffect(
    useCallback(() => {
      void refreshProfile();
      void refreshMyList({ minIntervalMs: 3000 });
      void refreshDrawHistory({ minIntervalMs: 3000 });
      void refreshProgressIds();
    }, [refreshDrawHistory, refreshMyList, refreshProfile, refreshProgressIds]),
  );

  const activeSubscriptions = useMemo(
    () => subscriptions.filter((subscription) => subscription.active),
    [subscriptions],
  );
  const monthlyTotal = useMemo(
    () => activeSubscriptions.reduce((total, subscription) => total + subscription.monthlyPrice, 0),
    [activeSubscriptions],
  );
  const watchedIds = useMemo(
    () => buildWatchedTitleIdsOrdered(history, progressTitleIds),
    [history, progressTitleIds],
  );
  const { watchedCount, totalCount: myListsCount } = useMemo(
    () =>
      computeMyListsCounts(
        savedTitles.map((title) => title.id),
        watchedIds,
      ),
    [savedTitles, watchedIds],
  );
  const previewHistory = useMemo(
    () => history.slice(0, PREVIEW_HISTORY_LIMIT),
    [history],
  );

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  const handleSelectTheme = (mode: ThemeMode) => {
    if (mode === themeMode) return;
    triggerSelectionHaptic();
    setThemeMode(mode);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader eyebrow="MEU PERFIL" title="Perfil" scrolled={scrolled} />
      <ScrollView
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.container, { paddingBottom: Math.max(124, 108 + insets.bottom) }]}
        showsVerticalScrollIndicator={false}>
        <FadeInBlock delay={0}>
          <View style={styles.profileCard}>
            <View style={styles.avatarWrap}>
              <UserAvatar
                size={78}
                name={profile?.name ?? user?.name}
                avatarType={profile?.avatarType}
                avatarPreset={profile?.avatarPreset}
                avatarUrl={profile?.avatarUrl}
              />
            </View>
            <AppText tipo="subtitulo" familia="editorial" peso="forte" style={styles.name}>{profile?.name ?? user?.name ?? 'Usuário'}</AppText>
            <AppText tipo="legenda" style={styles.muted}>{user?.email ?? ''}</AppText>
            <Pressable
              style={({ pressed }) => [styles.editProfileButton, pressed && styles.pressed]}
              onPress={() => router.push('/edit-profile')}
              accessibilityRole="button"
              accessibilityLabel="Editar perfil">
              <MaterialIcons name="edit" size={16} color={colors.accentLink} />
              <AppText tipo="legenda" peso="forte" style={styles.editProfileText}>Editar perfil</AppText>
            </Pressable>
          </View>
        </FadeInBlock>

        <FadeInBlock delay={35}>
          <AppText tipo="subtitulo" peso="forte" style={styles.sectionTitle}>Resumo da sua conta</AppText>
          <View style={styles.stats}>
            <View style={styles.stat}>
              <AppText tipo="subtitulo" peso="forte" tabular style={styles.number}>{activeSubscriptions.length}</AppText>
              <AppText tipo="legenda" style={styles.muted}>assinaturas</AppText>
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
        </FadeInBlock>

        <FadeInBlock delay={70}>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => router.push('/my-list')}
            accessibilityRole="button">
            <MaterialIcons name="bookmarks" size={22} color={colors.accentLink} />
            <AppText peso="forte" style={styles.rowText}>Minhas Listas</AppText>
            <AppText tipo="legenda" peso="forte" tabular style={styles.rowCount}>
              {myListsCount}
            </AppText>
            <MaterialIcons name="chevron-right" size={22} color={colors.textMuted} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => router.push('/subscriptions')}
            accessibilityRole="button">
            <MaterialIcons name="subscriptions" size={22} color={colors.accentLink} />
            <AppText peso="forte" style={styles.rowText}>Gerenciar assinaturas</AppText>
            <MaterialIcons name="chevron-right" size={22} color={colors.textMuted} />
          </Pressable>
        </FadeInBlock>

        <FadeInBlock delay={90}>
          <View style={styles.appearanceCard}>
            <View style={styles.appearanceHeader}>
              <View style={styles.appearanceIconBox}>
                <MaterialIcons
                  name={resolvedMode === 'dark' ? 'dark-mode' : 'light-mode'}
                  size={19}
                  color={colors.accentLink}
                />
              </View>
              <View style={styles.appearanceCopy}>
                <AppText peso="forte" style={styles.appearanceTitle}>Aparência</AppText>
                <AppText tipo="legenda" style={styles.muted}>
                  {themeMode === 'system'
                    ? `Seguindo o sistema (${resolvedMode === 'dark' ? 'Escuro' : 'Claro'})`
                    : themeMode === 'dark'
                      ? 'Tema escuro ativo'
                      : 'Tema claro ativo'}
                </AppText>
              </View>
            </View>

            <View style={styles.themeSegmented} accessibilityRole="radiogroup" accessibilityLabel="Selecionar tema do aplicativo">
              {THEME_OPTIONS.map((option) => {
                const selected = themeMode === option.id;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => handleSelectTheme(option.id)}
                    style={({ pressed }) => [
                      styles.themeOption,
                      selected && styles.themeOptionActive,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected, selected }}
                    accessibilityLabel={`Tema ${option.label}`}>
                    <MaterialIcons
                      name={option.icon}
                      size={16}
                      color={selected ? colors.chipSelectedIcon : colors.chipIcon}
                    />
                    <AppText
                      tipo="legenda"
                      peso="forte"
                      numberOfLines={1}
                      style={selected ? styles.themeOptionTextActive : styles.themeOptionText}>
                      {option.label}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </FadeInBlock>

        <FadeInBlock delay={105}>
          <View style={styles.historySection}>
            <View style={styles.historyHeader}>
              <View style={styles.historyHeaderCopy}>
                <AppText tipo="subtitulo" peso="forte" style={styles.historyTitle}>Histórico de sorteios</AppText>
                <AppText tipo="legenda" style={styles.muted}>
                  {history.length === 0
                    ? 'Seus últimos sorteios na Roleta'
                    : `${formatCount(history.length)} ${history.length === 1 ? 'sorteio registrado' : 'sorteios registrados'}`}
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
                  <MaterialIcons name="chevron-right" size={18} color={colors.accentLink} />
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
                      onPress={() => router.push({ pathname: '/title/[id]', params: { id: entry.tmdbId } })}
                    />
                  );
                })}
              </View>
            ) : (
              <EmptyStateCard
                compact
                icon="casino"
                title="Nenhum sorteio registrado"
                description="Gire a Roleta na tela inicial para registrar o que você assistiu, salvou ou pulou."
                actionLabel="Ir para a Roleta"
                onAction={() => router.push('/(tabs)')}
              />
            )}
          </View>
        </FadeInBlock>

        <FadeInBlock delay={140}>
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
                    ? `${formatCount(titles.length)} títulos sincronizados · disponibilidade no Brasil`
                    : status === 'needs-api-key'
                      ? 'Configure o segredo TMDB_API_TOKEN na Edge Function tmdb-proxy do Supabase para carregar títulos automaticamente.'
                      : errorMessage ?? 'Confira a conexão e tente novamente.'}
              </AppText>
            </View>
            <Pressable
              style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}
              onPress={() => { void handleRefreshCatalog(); }}
              disabled={isRefreshingCatalog}
              accessibilityRole="button"
              accessibilityLabel="Atualizar catálogo">
              <SpinningIcon
                name="refresh"
                size={20}
                color={colors.accentLink}
                spinning={isRefreshingCatalog}
              />
            </Pressable>
          </View>

          <View style={styles.accountDangerSection}>
            <View style={styles.sectionDivider} />
            <Pressable
              style={({ pressed }) => [styles.logoutCard, pressed && styles.pressed]}
              onPress={() => { void handleSignOut(); }}
              accessibilityRole="button">
              <View style={styles.logoutIconBox}>
                <MaterialIcons name="logout" size={20} color={colors.dangerText} />
              </View>
              <AppText peso="forte" style={styles.logoutText}>Sair da conta</AppText>
              <MaterialIcons name="chevron-right" size={22} color={colors.dangerText} />
            </Pressable>
          </View>

          <AppText tipo="legenda" style={styles.credits}>
            Pôsteres e metadados: The Movie Database (TMDB). Este produto utiliza a API do TMDB, mas não é endossado ou certificado pelo TMDB.
          </AppText>
        </FadeInBlock>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) => ({
  safeArea: { flex: 1, backgroundColor: theme.colors.bgPrimary },
  container: { width: '100%' as const, maxWidth: 640, alignSelf: 'center' as const, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 36 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  profileCard: { alignItems: 'center' as const, backgroundColor: theme.colors.bgSurface, borderRadius: 22, borderWidth: 1, borderColor: theme.colors.borderSubtle, paddingVertical: 22, paddingHorizontal: 20, marginBottom: 22 },
  avatarWrap: { marginBottom: 12 },
  editProfileButton: {
    minHeight: 42,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 7,
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: theme.colors.bgSurfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  editProfileText: { color: theme.colors.accentLink, fontSize: 13 },
  name: { color: theme.colors.textPrimary, fontSize: 22, lineHeight: 27, letterSpacing: -0.3, marginBottom: 3 },
  muted: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 18 },
  sectionTitle: { color: theme.colors.textPrimary, fontSize: 18, lineHeight: 23, marginBottom: 12 },
  stats: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-around' as const, backgroundColor: theme.colors.bgSurface, borderWidth: 1, borderColor: theme.colors.borderSubtle, borderRadius: 18, paddingVertical: 16, paddingHorizontal: 8, marginBottom: 20 },
  stat: { flex: 1, alignItems: 'center' as const },
  statDivider: { width: 1, height: 34, backgroundColor: theme.colors.borderSubtle },
  number: { color: theme.colors.textPrimary, textAlign: 'center' as const, fontSize: 18, lineHeight: 24, marginBottom: 2 },
  currencyPrefix: { color: theme.colors.textSecondary, fontSize: 12.5, lineHeight: 18 },
  row: { minHeight: 58, flexDirection: 'row' as const, alignItems: 'center' as const, backgroundColor: theme.colors.bgSurface, borderWidth: 1, borderColor: theme.colors.borderSubtle, borderRadius: 16, paddingHorizontal: 16, marginBottom: 10 },
  rowText: { color: theme.colors.textPrimary, flex: 1, fontSize: 15, lineHeight: 20, marginLeft: 12 },
  rowCount: { color: theme.colors.accentLink, backgroundColor: theme.colors.bgSurfaceAlt, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, fontSize: 12, marginRight: 6 },
  appearanceCard: {
    backgroundColor: theme.colors.bgSurface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    borderRadius: 16,
    padding: 14,
    marginTop: 4,
    marginBottom: 8,
    gap: 12,
  },
  appearanceHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  appearanceIconBox: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: theme.colors.bgSurfaceAlt,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  appearanceCopy: {
    flex: 1,
    gap: 1,
  },
  appearanceTitle: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    lineHeight: 20,
  },
  themeSegmented: {
    flexDirection: 'row' as const,
    gap: 6,
    padding: 4,
    borderRadius: 14,
    backgroundColor: theme.colors.bgSurfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  themeOption: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingHorizontal: 8,
  },
  themeOptionActive: {
    backgroundColor: theme.colors.chipSelectedBg,
  },
  themeOptionText: {
    color: theme.colors.chipText,
    fontSize: 12.5,
  },
  themeOptionTextActive: {
    color: theme.colors.chipSelectedText,
    fontSize: 12.5,
  },
  historySection: { marginTop: 14, marginBottom: 18 },
  historyHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: 10, marginBottom: 12 },
  historyHeaderCopy: { flex: 1 },
  historyTitle: { color: theme.colors.textPrimary, fontSize: 18, lineHeight: 23 },
  seeAllLinkBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 2, paddingVertical: 6, paddingLeft: 8 },
  seeAllText: { color: theme.colors.accentLink, fontSize: 14, lineHeight: 19 },
  historyList: { gap: 8 },
  catalogNotice: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bgSurfaceAlt,
    marginTop: 4,
  },
  catalogNoticeCopy: { flex: 1 },
  catalogNoticeTitle: { color: theme.colors.textPrimary, fontSize: 13.5, lineHeight: 18, marginBottom: 2 },
  catalogNoticeText: { color: theme.colors.textSecondary, fontSize: 12.5, lineHeight: 17 },
  refreshButton: {
    width: 44,
    height: 44,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: 12,
    backgroundColor: theme.colors.bgSurface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  accountDangerSection: { marginTop: 22 },
  sectionDivider: { height: 1, backgroundColor: theme.colors.borderSubtle, marginBottom: 18 },
  logoutCard: {
    minHeight: 58,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: theme.colors.bgSurface,
    borderWidth: 1,
    borderColor: theme.colors.dangerBorder,
    borderRadius: 16,
    paddingHorizontal: 14,
  },
  logoutIconBox: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: theme.colors.dangerIconBg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  logoutText: { color: theme.colors.dangerText, flex: 1, fontSize: 15, lineHeight: 20, marginLeft: 12 },
  credits: { color: theme.colors.textSecondary, fontSize: 12.5, lineHeight: 18, textAlign: 'center' as const, marginTop: 22 },
});
