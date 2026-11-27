import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, View } from 'react-native';
import Animated, {
  Easing,
  FadeOutLeft,
  LinearTransition,
  useReducedMotion,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/atoms/AppText';
import { FadeInBlock } from '@/components/atoms/FadeInBlock';
import { EmptyStateCard } from '@/components/organisms/EmptyStateCard';
import { MediaTitleCard } from '@/components/organisms/MediaTitleCard';
import { ScreenHeader } from '@/components/organisms/ScreenHeader';
import { WatchedTitleCard } from '@/components/organisms/WatchedTitleCard';
import { Theme, withAlpha } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';
import { useTitlesByIds, useTitlesDurations } from '@/hooks/useCatalog';
import { DrawHistoryEntry, useDrawHistory } from '@/hooks/useDrawHistory';
import { useMyList } from '@/hooks/useMyList';
import { useWatchedProgressIds } from '@/hooks/useSeriesProgress';
import { useTitleRatingSummaries } from '@/hooks/useTitleRatingSummary';
import { triggerSelectionHaptic } from '@/utils/haptics';
import { buildWatchedTitleIdsOrdered } from '@/utils/watchedProgress';

type ListsTab = 'fila' | 'assistidos';

export default function MyListScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { user, token, authReady, isPasswordRecovery } = useAuth();
  const { savedTitles, storageReady, findSavedTitle, removeFromMyList, refreshMyList } = useMyList();
  const { history, storageReady: historyReady, refreshDrawHistory } = useDrawHistory();
  const { progressTitleIds, progressByTitleId, progressReady, refreshProgressIds } =
    useWatchedProgressIds(user?.id ?? null, token);

  const [activeTab, setActiveTab] = useState<ListsTab>('fila');
  const [scrolled, setScrolled] = useState(false);
  const { getDuration } = useTitlesDurations(savedTitles);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const isScrolled = event.nativeEvent.contentOffset.y > 6;
    setScrolled((prev) => (prev === isScrolled ? prev : isScrolled));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshMyList();
      void refreshProgressIds();
      void refreshDrawHistory({ minIntervalMs: 3000 });
    }, [refreshDrawHistory, refreshMyList, refreshProgressIds]),
  );

  const drawWatchedById = useMemo(() => {
    const map = new Map<string, DrawHistoryEntry>();
    for (const entry of history) {
      if (entry.acao === 'assistiu' && !map.has(entry.tmdbId)) {
        map.set(entry.tmdbId, entry);
      }
    }
    return map;
  }, [history]);

  const watchedIds = useMemo(
    () => buildWatchedTitleIdsOrdered(history, progressTitleIds),
    [history, progressTitleIds],
  );

  const listTitleIds = useMemo(
    () => [...savedTitles.map((item) => item.id), ...watchedIds],
    [savedTitles, watchedIds],
  );
  const { getSummary } = useTitleRatingSummaries(listTitleIds);

  const { resolveTitle: resolveWatchedTitle } = useTitlesByIds(watchedIds, {
    enabled: activeTab === 'assistidos',
    resolveKnown: findSavedTitle,
  });

  const openTitleById = useCallback((id: string) => {
    router.push({ pathname: '/title/[id]', params: { id } });
  }, []);

  if (!authReady) return null;
  if (isPasswordRecovery) return <Redirect href="/(auth)/reset-password" />;
  if (!user) return <Redirect href="/(auth)/login" />;

  const handleSelectTab = (tab: ListsTab) => {
    if (tab === activeTab) return;
    triggerSelectionHaptic();
    setActiveTab(tab);
  };

  const tabBarNode = (
    <View style={styles.tabBar} accessibilityRole="tablist">
      {(
        [
          { id: 'fila', label: 'Fila', icon: 'bookmark', count: savedTitles.length },
          {
            id: 'assistidos',
            label: 'Assistidos',
            icon: 'check-circle',
            count: watchedIds.length,
          },
        ] as const
      ).map((tab) => {
        const selected = activeTab === tab.id;
        return (
          <Pressable
            key={tab.id}
            style={({ pressed }) => [
              styles.tabButton,
              selected && styles.tabButtonActive,
              pressed && styles.pressed,
            ]}
            onPress={() => handleSelectTab(tab.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={`${tab.label}, ${tab.count} ${tab.count === 1 ? 'obra' : 'obras'}`}>
            <MaterialIcons
              name={tab.icon}
              size={16}
              color={selected ? colors.chipSelectedIcon : colors.chipText}
            />
            <AppText
              tipo="legenda"
              peso="forte"
              style={selected ? styles.tabTextActive : styles.tabText}>
              {tab.label}
            </AppText>
            <View style={[styles.tabCountPill, selected && styles.tabCountPillActive]}>
              <AppText
                tipo="legenda"
                peso="forte"
                tabular
                style={selected ? styles.tabCountTextActive : styles.tabCountText}>
                {tab.count}
              </AppText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader
        eyebrow="SUA COLEÇÃO"
        title="Minhas Listas"
        showBack
        fallbackHref="/(tabs)/profile"
        bottomSlot={tabBarNode}
        scrolled={scrolled}
      />
      <ScrollView
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.container,
          { paddingBottom: Math.max(36, insets.bottom + 16) },
        ]}
        showsVerticalScrollIndicator={false}>

        {activeTab === 'fila' ? (
          <>
            <View>
              {savedTitles.map((title, index) => (
                <Animated.View
                  key={title.id}
                  layout={
                    reducedMotion
                      ? undefined
                      : LinearTransition.duration(240).easing(Easing.bezier(0.22, 1, 0.36, 1))
                  }
                  exiting={
                    reducedMotion
                      ? undefined
                      : FadeOutLeft.duration(200).easing(Easing.out(Easing.cubic))
                  }>
                  <FadeInBlock delay={Math.min(index + 1, 7) * 30}>
                    <MediaTitleCard
                      title={title}
                      duration={getDuration(title)}
                      userRatingSummary={getSummary(title.id)}
                      onOpen={() => openTitleById(title.id)}
                      actionIcon="bookmark"
                      actionLabel={`Remover ${title.title} da fila`}
                      onAction={() => removeFromMyList(title.id)}
                      actionButtonStyle={styles.savedBadgeButton}
                      actionIconColor={colors.savedActiveIcon}
                    />
                  </FadeInBlock>
                </Animated.View>
              ))}
            </View>

            {savedTitles.length === 0 && storageReady && (
              <FadeInBlock delay={120}>
                <EmptyStateCard
                  icon="bookmark-border"
                  iconColor={colors.accentLink}
                  title="Sua fila está vazia"
                  description={'Toque em "Salvar" nos detalhes de qualquer filme, série ou anime para guardá-lo aqui.'}
                  actionLabel="Explorar títulos"
                  actionIcon="search"
                  onAction={() => router.push('/(tabs)/explore')}
                />
              </FadeInBlock>
            )}
          </>
        ) : (
          <>
            <View>
              {watchedIds.map((id, index) => {
                const resolved = resolveWatchedTitle(id);
                return (
                  <FadeInBlock key={id} delay={Math.min(index + 1, 7) * 30}>
                    <WatchedTitleCard
                      id={id}
                      title={resolved}
                      drawEntry={drawWatchedById.get(id)}
                      progressMap={progressByTitleId[id]}
                      userRatingSummary={getSummary(id)}
                      onOpen={openTitleById}
                    />
                  </FadeInBlock>
                );
              })}
            </View>

            {watchedIds.length === 0 && progressReady && historyReady && (
              <FadeInBlock delay={120}>
                <EmptyStateCard
                  icon="check-circle-outline"
                  iconColor={colors.successText}
                  title="Nenhuma obra assistida"
                  description="Marque filmes como assistidos ou acompanhe episódios nos detalhes das séries para ver seu progresso aqui."
                  actionLabel="Explorar títulos"
                  actionIcon="search"
                  onAction={() => router.push('/(tabs)/explore')}
                />
              </FadeInBlock>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) => ({
  safeArea: { flex: 1, backgroundColor: theme.colors.bgPrimary },
  container: {
    width: '100%' as const,
    maxWidth: 640,
    alignSelf: 'center' as const,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 36,
  },
  pressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  tabBar: {
    flexDirection: 'row' as const,
    gap: 4,
    padding: 4,
    borderRadius: 15,
    backgroundColor: theme.colors.bgSurfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  tabButton: {
    flex: 1,
    minHeight: theme.touchTarget.min,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    borderRadius: 11,
    paddingHorizontal: 10,
  },
  tabButtonActive: {
    backgroundColor: theme.colors.chipSelectedBg,
  },
  tabText: { color: theme.colors.chipText, fontSize: 13.5 },
  tabTextActive: { color: theme.colors.chipSelectedText, fontSize: 13.5 },
  tabCountPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 9,
    backgroundColor: theme.isDark
      ? withAlpha(theme.colors.textPrimary, 0.1)
      : withAlpha(theme.colors.navy, 0.08),
  },
  tabCountPillActive: {
    backgroundColor: theme.isDark
      ? withAlpha(theme.colors.textOnAccent, 0.16)
      : theme.colors.cardOverlaySubtle,
  },
  tabCountText: { color: theme.colors.chipText, fontSize: 11.5 },
  tabCountTextActive: {
    color: theme.isDark ? theme.colors.chipSelectedText : theme.colors.accentPrimary,
    fontSize: 11.5,
  },
  savedBadgeButton: {
    backgroundColor: theme.colors.savedActiveBg,
    borderWidth: 1,
    borderColor: theme.colors.savedActiveBorder,
  },
});
