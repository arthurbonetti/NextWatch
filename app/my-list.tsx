import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { memo, useCallback, useMemo, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeOutLeft,
  LinearTransition,
  useReducedMotion,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/atoms/AppText';
import { FadeInBlock } from '@/components/atoms/FadeInBlock';
import { TitleArtwork } from '@/components/atoms/TitleArtwork';
import { EmptyStateCard } from '@/components/organisms/EmptyStateCard';
import { MediaTitleCard } from '@/components/organisms/MediaTitleCard';
import { ScreenHeader } from '@/components/organisms/ScreenHeader';
import { isSerialTitle, MediaTitle } from '@/constants/catalog';
import { Theme, withAlpha } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';
import { useTitlesByIds, useTitlesDurations, useTitleTotalEpisodes } from '@/hooks/useCatalog';
import { DrawHistoryEntry, useDrawHistory } from '@/hooks/useDrawHistory';
import { useMyList } from '@/hooks/useMyList';
import { useWatchedProgressIds } from '@/hooks/useSeriesProgress';
import { triggerSelectionHaptic } from '@/utils/haptics';
import {
  buildWatchedTitleIdsOrdered,
  countWatchedSeriesEpisodes,
  SeriesProgressMap,
  summarizeWatchedProgress,
} from '@/utils/watchedProgress';

type ListsTab = 'fila' | 'assistidos';

type WatchedTitleCardProps = {
  id: string;
  title?: MediaTitle;
  drawEntry?: DrawHistoryEntry;
  progressMap?: SeriesProgressMap;
  onOpen: (id: string) => void;
};

const WatchedTitleCard = memo(function WatchedTitleCard({
  id,
  title,
  drawEntry,
  progressMap,
  onOpen,
}: WatchedTitleCardProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const isSerial = title
    ? isSerialTitle(title)
    : drawEntry?.kind === 'Série' ||
      (drawEntry?.kind === 'Anime' && !id.startsWith('tmdb-movie-')) ||
      id.startsWith('tmdb-tv-');

  const totalEpisodes = useTitleTotalEpisodes(title, isSerial);

  const summary = summarizeWatchedProgress({ isSerial, progressMap, totalEpisodes });
  const watchedEpisodesCount = countWatchedSeriesEpisodes(progressMap);
  const isFromRoulette = Boolean(drawEntry && drawEntry.acao === 'assistiu');
  const displayTitle = title?.title ?? drawEntry?.title ?? 'Carregando obra…';
  const displayKind = title?.kind ?? drawEntry?.kind;
  const displayMeta = title
    ? `${title.year || 'Ano não informado'} · ${title.kind}`
    : (displayKind ?? '');
  const posterPath = title?.tmdbPosterPath ?? drawEntry?.tmdbPosterPath;
  const backdropPath = title?.tmdbBackdropPath;
  const cardColor = title?.color ?? drawEntry?.color ?? colors.navyMuted;

  const completedLabel =
    isSerial && watchedEpisodesCount > 0
      ? `${totalEpisodes && totalEpisodes > 0 ? totalEpisodes : watchedEpisodesCount} ep.`
      : 'Assistido';
  const showRouletteTag = isFromRoulette && (!isSerial || watchedEpisodesCount === 0);

  return (
    <Pressable
      style={({ pressed }) => [styles.watchedCard, pressed && styles.pressed]}
      onPress={() => onOpen(id)}
      accessibilityRole="button"
      accessibilityLabel={`Abrir detalhes de ${displayTitle}, ${summary.completed ? completedLabel : summary.label}${!summary.completed && summary.percent !== null ? `, ${summary.percent}%` : ''}`}>
      <View style={[styles.watchedPoster, { backgroundColor: cardColor }]}>
        <Animated.View sharedTransitionTag={`title-poster-${id}`} style={StyleSheet.absoluteFill}>
          <TitleArtwork
            id={id}
            variant="poster"
            posterPath={posterPath}
            backdropPath={backdropPath}
            fallback={
              <MaterialIcons
                name={title?.icon ?? (isSerial ? 'live-tv' : 'movie')}
                size={22}
                color={colors.textOnNavy}
              />
            }
          />
        </Animated.View>
      </View>

      <View style={styles.watchedCopy}>
        <AppText peso="forte" style={styles.watchedTitle} numberOfLines={2}>
          {displayTitle}
        </AppText>
        {Boolean(displayMeta) && (
          <AppText tipo="legenda" tabular style={styles.watchedMeta} numberOfLines={1}>
            {displayMeta}
          </AppText>
        )}

        {summary.completed ? (
          <View style={styles.completedBadgesRow}>
            <View style={styles.completedBadge}>
              <MaterialIcons name="check" size={13} color={colors.badgeSuccessText} />
              <AppText tipo="legenda" peso="forte" tabular style={styles.completedBadgeText}>
                {completedLabel}
              </AppText>
            </View>
            {showRouletteTag && (
              <View style={styles.rouletteBadge}>
                <MaterialIcons name="casino" size={12} color={colors.badgeAccentText} />
                <AppText tipo="legenda" peso="forte" style={styles.rouletteBadgeText}>
                  Roleta
                </AppText>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.progressBlock}>
            <View style={styles.progressHeader}>
              <View style={styles.progressLabelRow}>
                <MaterialIcons
                  name="play-circle-outline"
                  size={14}
                  color={colors.accentLink}
                />
                <AppText
                  tipo="legenda"
                  peso="semiforte"
                  tabular
                  numberOfLines={1}
                  style={styles.progressLabel}>
                  {summary.label}
                </AppText>
              </View>
              {summary.percent !== null && (
                <AppText
                  tipo="legenda"
                  peso="forte"
                  tabular
                  style={styles.progressPercent}>
                  {summary.percent}%
                </AppText>
              )}
            </View>

            {summary.percent !== null && (
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${summary.percent}%`,
                      backgroundColor: colors.accentPrimary,
                    },
                  ]}
                />
              </View>
            )}
          </View>
        )}
      </View>

      <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
    </Pressable>
  );
});

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
        fallbackHref="/(tabs)/tab3"
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
                  onAction={() => router.push('/(tabs)/tab2')}
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
                  onAction={() => router.push('/(tabs)/tab2')}
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
  watchedCard: {
    minHeight: 104,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bgSurface,
    marginBottom: 10,
    gap: 12,
  },
  watchedPoster: {
    width: 64,
    height: 86,
    borderRadius: 11,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
  },
  watchedCopy: { flex: 1, paddingVertical: 2 },
  watchedTitle: {
    color: theme.colors.textPrimary,
    fontSize: 14.5,
    lineHeight: 19,
    marginBottom: 2,
  },
  watchedMeta: { color: theme.colors.textSecondary, fontSize: 12.5, lineHeight: 17 },
  completedBadgesRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginTop: 8,
  },
  completedBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.badgeSuccessBorder,
    backgroundColor: theme.colors.badgeSuccessBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  completedBadgeText: {
    color: theme.colors.badgeSuccessText,
    fontSize: 11.5,
  },
  rouletteBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.badgeAccentBorder,
    backgroundColor: theme.colors.badgeAccentBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  rouletteBadgeText: {
    color: theme.colors.badgeAccentText,
    fontSize: 11.5,
  },
  progressBlock: { marginTop: 9, gap: 5 },
  progressHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: 8,
  },
  progressLabelRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5, flex: 1 },
  progressLabel: { color: theme.colors.textSecondary, fontSize: 12 },
  progressPercent: { color: theme.colors.textPrimary, fontSize: 12 },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.bgSurfaceAlt,
    overflow: 'hidden' as const,
  },
  progressFill: { height: '100%' as const, borderRadius: 3 },
});
