import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Linking from 'expo-linking';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Share, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  interpolateColor,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/atoms/AppText';
import { BookmarkIcon } from '@/components/atoms/BookmarkIcon';
import { CollapsibleSection } from '@/components/atoms/CollapsibleSection';
import { ExpandableText } from '@/components/atoms/ExpandableText';
import { ServiceLogo } from '@/components/atoms/ServiceLogo';
import { RatingInfoSheet } from '@/components/organisms/RatingInfoSheet';
import { CastCarousel } from '@/components/organisms/TitleDetails/CastCarousel';
import { SeriesSeasonsSection } from '@/components/organisms/TitleDetails/SeriesSeasonsSection';
import { SimilarTitlesCarousel } from '@/components/organisms/TitleDetails/SimilarTitlesCarousel';
import { StreamingAvailabilitySection } from '@/components/organisms/TitleDetails/StreamingAvailabilitySection';
import { TitleDetailsSkeleton } from '@/components/organisms/TitleDetails/TitleDetailsSkeleton';
import { TitleHero } from '@/components/organisms/TitleDetails/TitleHero';
import {
  formatAverageRating,
  getGenreIcon,
  getMetacriticScore,
  getTitleServices,
  isSerialTitle as checkIsSerialTitle,
  MediaTitle,
} from '@/constants/catalog';
import { openStreamingService } from '@/constants/subscriptions';
import { resolveTitleAccentColor, Theme, THEME, withAlpha } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';
import {
  useCatalog,
  useSeasonEpisodes,
  useTitleById,
  useTitleDetails,
} from '@/hooks/useCatalog';
import { useMyList } from '@/hooks/useMyList';
import { useSeriesProgress } from '@/hooks/useSeriesProgress';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { formatCount } from '@/utils/format';
import { triggerLightImpactHaptic, triggerSelectionHaptic, triggerSuccessHaptic } from '@/utils/haptics';

export default function TitleDetailsScreen() {
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { user, token, authReady } = useAuth();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { status, findTitle } = useCatalog();
  const { isSaved, toggleSavedTitle, findSavedTitle, storageReady } = useMyList();
  const { subscriptions } = useSubscriptions();

  const normalizedId = Array.isArray(id) ? id[0] ?? '' : id ?? '';
  const [savedSnapshot, setSavedSnapshot] = useState<MediaTitle | null>(null);

  const liveTitle = normalizedId
    ? (findTitle(normalizedId) ?? findSavedTitle(normalizedId))
    : undefined;
  const titleByIdQuery = useTitleById(
    normalizedId,
    Boolean(normalizedId && !liveTitle && savedSnapshot?.id !== normalizedId),
  );
  const fallbackTitle = titleByIdQuery.data ?? undefined;
  const title =
    liveTitle ?? (savedSnapshot?.id === normalizedId ? savedSnapshot : undefined) ?? fallbackTitle;
  const resolvingFallback = Boolean(
    normalizedId && !title && (titleByIdQuery.isLoading || titleByIdQuery.isFetching),
  );
  const saved = title ? isSaved(title.id) : false;

  const [seasonSelection, setSeasonSelection] = useState<{
    titleId: string;
    seasonNumber: number | null;
  }>({ titleId: '', seasonNumber: null });
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [ratingInfoVisible, setRatingInfoVisible] = useState(false);
  const [streamingDrawerOpen, setStreamingDrawerOpen] = useState(false);
  const drawNonceRef = useRef(0);

  const seriesProgress = useSeriesProgress(user?.id ?? null, title?.id ?? '', token);

  const scrollY = useSharedValue(0);
  const saveProgress = useSharedValue(saved ? 1 : 0);
  const drawerChevronRotation = useSharedValue(0);

  const saveInactiveBg = colors.bgSurfaceAlt;
  const saveActiveBg = isDark ? colors.savedActiveBg : colors.navy;
  const saveInactiveBorder = colors.borderSubtle;
  const saveActiveBorder = isDark ? colors.savedActiveBorder : colors.navy;

  const {
    details: richDetails,
    cachedDuration,
    isLoading: loadingRichDetails,
    error: richDetailsError,
    refetch: refetchRichDetails,
  } = useTitleDetails(title);

  const titleId = title?.id ?? '';
  const richSeasons = richDetails?.seasons;
  const expandedSeason = useMemo(() => {
    if (!titleId) return null;
    if (seasonSelection.titleId === titleId) {
      return seasonSelection.seasonNumber;
    }
    if (richSeasons && richSeasons.length === 1) {
      return richSeasons[0]!.seasonNumber;
    }
    return null;
  }, [richSeasons, seasonSelection.seasonNumber, seasonSelection.titleId, titleId]);

  const {
    episodesBySeason,
    isLoading: loadingActiveSeasonEpisodes,
    error: activeSeasonError,
    refetch: refetchSeasonEpisodes,
  } = useSeasonEpisodes(
    titleId,
    expandedSeason,
    Boolean(title && checkIsSerialTitle(title)),
    richSeasons,
  );

  const seasonEpisodesError = expandedSeason !== null ? activeSeasonError : null;

  const loadingSeasonNumber =
    expandedSeason !== null &&
    title &&
    checkIsSerialTitle(title) &&
    loadingActiveSeasonEpisodes
      ? expandedSeason
      : null;

  const handleToggleExpandSeason = useCallback(
    (seasonNumber: number) => {
      if (!titleId) return;
      setSeasonSelection({
        titleId,
        seasonNumber: expandedSeason === seasonNumber ? null : seasonNumber,
      });
    },
    [expandedSeason, titleId],
  );

  const handleRetrySeasonEpisodes = useCallback(
    (seasonNumber: number) => {
      if (!titleId) return;
      setSeasonSelection({ titleId, seasonNumber });
      void refetchSeasonEpisodes();
    },
    [refetchSeasonEpisodes, titleId],
  );

  const handleRetryRichDetails = useCallback(() => {
    void refetchRichDetails();
  }, [refetchRichDetails]);

  useEffect(() => {
    saveProgress.set(
      reducedMotion
        ? saved
          ? 1
          : 0
        : withTiming(saved ? 1 : 0, { duration: 180, easing: Easing.out(Easing.cubic) }),
    );
  }, [reducedMotion, saveProgress, saved]);

  useEffect(() => {
    drawerChevronRotation.set(
      reducedMotion
        ? streamingDrawerOpen
          ? 90
          : 0
        : withTiming(streamingDrawerOpen ? 90 : 0, {
            duration: 240,
            easing: Easing.bezier(0.22, 1, 0.36, 1),
          }),
    );
  }, [drawerChevronRotation, reducedMotion, streamingDrawerOpen]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.set(event.contentOffset.y);
    },
  });

  const saveButtonAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      saveProgress.get(),
      [0, 1],
      [saveInactiveBg, saveActiveBg],
    ),
    borderColor: interpolateColor(
      saveProgress.get(),
      [0, 1],
      [saveInactiveBorder, saveActiveBorder],
    ),
  }), [saveInactiveBg, saveActiveBg, saveInactiveBorder, saveActiveBorder]);

  const drawerChevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${drawerChevronRotation.get()}deg` }],
  }));

  const activeProviderNames = useMemo(
    () => new Set(subscriptions.filter((sub) => sub.active).map((sub) => sub.provider)),
    [subscriptions],
  );

  const allServices = useMemo(() => {
    if (!title) return [];
    const base = getTitleServices(title);
    const enriched = richDetails?.providers ?? [];
    const merged = [...base];
    for (const provider of enriched) {
      if (!merged.includes(provider)) {
        merged.push(provider);
      }
    }
    return merged;
  }, [richDetails?.providers, title]);

  const subscribedServices = useMemo(
    () => allServices.filter((service) => activeProviderNames.has(service)),
    [activeProviderNames, allServices],
  );

  const watchOptions = subscribedServices.length > 0 ? subscribedServices : allServices;

  if (!authReady) return null;
  if (!user) return <Redirect href="/(auth)/login" />;

  if (!title) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.notFound}>
          <MaterialIcons name="movie-filter" size={40} color={colors.accentLink} />
          <AppText tipo="subtitulo" peso="forte" style={styles.notFoundTitle}>
            {status === 'loading' || !storageReady || resolvingFallback
              ? 'Carregando título…'
              : 'Título não encontrado'}
          </AppText>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/tab2'))}
            accessibilityRole="button">
            <AppText peso="forte" style={styles.link}>
              Voltar
            </AppText>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isSerialTitle = checkIsSerialTitle(title);
  const accentColor = resolveTitleAccentColor(title.color, isDark);
  const rawDuration = richDetails?.duration ?? cachedDuration ?? title.duration;
  const safeDuration =
    rawDuration && rawDuration !== 'Duração não informada' && rawDuration !== title.kind
      ? rawDuration
      : isSerialTitle
        ? '1 temporada'
        : 'Filme';

  const metacritic = getMetacriticScore(title);
  const voteCount = richDetails?.voteCount ?? title.voteCount ?? null;
  const formattedVotes = typeof voteCount === 'number' && voteCount > 0 ? formatCount(voteCount) : null;
  const synopsisText = title.synopsis.trim() || 'Sinopse indisponível para este título no momento.';
  // shortcut: reuses season 0 / ep 1 in user_series_progress for movies; split into its own column only if partial movie timestamps are ever added
  const movieWatched = !isSerialTitle && seriesProgress.isEpisodeWatched(0, 1);
  const hasMultipleWatchOptions = watchOptions.length > 1;
  const primaryWatchService = watchOptions[0] ?? null;

  const handleToggleSaved = () => {
    const nextSaved = !saved;
    if (nextSaved) {
      triggerLightImpactHaptic();
    } else {
      triggerSelectionHaptic();
    }
    setSavedSnapshot(title);
    toggleSavedTitle(title);
  };

  const handleShare = () => {
    triggerSelectionHaptic();
    const ratingText = formatAverageRating(title);
    void Share.share({
      message: `Estou pensando em assistir ${title.title} (${title.year}) — ${ratingText}★ no NextWatch!`,
      title: title.title,
    }).catch(() => {});
  };

  const handleWatchTrailer = () => {
    if (!richDetails?.trailerUrl) return;
    triggerSelectionHaptic();
    void Linking.openURL(richDetails.trailerUrl).catch(() => {});
  };

  const handleOpenService = (serviceName: string) => {
    triggerSuccessHaptic();
    setStreamingDrawerOpen(false);
    void openStreamingService(serviceName, title.title);
  };

  const handlePrimaryWatchPress = () => {
    if (hasMultipleWatchOptions) {
      triggerSelectionHaptic();
      setStreamingDrawerOpen((prev) => !prev);
      return;
    }
    if (primaryWatchService) {
      handleOpenService(primaryWatchService);
      return;
    }
    const query = encodeURIComponent(`onde assistir ${title.title} ${title.year}`);
    void Linking.openURL(`https://www.google.com/search?q=${query}`).catch(() => {});
  };

  const handlePressGenre = (genre: string) => {
    triggerSelectionHaptic();
    drawNonceRef.current += 1;
    router.navigate({
      pathname: '/(tabs)',
      params: {
        drawGenre: genre,
        drawKind: title.kind,
        drawNonce: `${title.id}-${drawNonceRef.current}`,
      },
    });
  };

  const handleDrawSimilar = () => {
    triggerSelectionHaptic();
    drawNonceRef.current += 1;
    const primaryGenre = title.genres[0];
    router.navigate({
      pathname: '/(tabs)',
      params: {
        ...(primaryGenre ? { drawGenre: primaryGenre } : {}),
        drawKind: title.kind,
        autoSpin: '1',
        drawNonce: `${title.id}-sim-${drawNonceRef.current}`,
      },
    });
  };

  const handleSelectSimilar = (item: MediaTitle) => {
    triggerSelectionHaptic();
    router.push(`/title/${item.id}`);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 112 + Math.max(insets.bottom, THEME.spacing.md) },
        ]}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}>
        <TitleHero
          title={title}
          durationLabel={safeDuration}
          episodeDuration={richDetails?.episodeDuration}
          statusLabel={richDetails?.statusLabel}
          certification={richDetails?.certification}
          trailerUrl={richDetails?.trailerUrl}
          accentColor={accentColor}
          scrollY={scrollY}
          topInset={insets.top}
          onShare={handleShare}
          onWatchTrailer={handleWatchTrailer}
        />

        <View style={styles.body}>
          <View style={styles.ratingRow}>
            <Pressable
              onPress={() => {
                triggerSelectionHaptic();
                setRatingInfoVisible(true);
              }}
              style={({ pressed }) => [styles.ratingBadge, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`Nota ${formatAverageRating(title)}${formattedVotes ? `, ${formattedVotes} votos` : ''}. Toque para ver fontes.`}>
              <MaterialIcons name="star" size={16} color={colors.accentPrimary} />
              <AppText peso="forte" tabular style={styles.ratingValue}>
                {formatAverageRating(title)}
              </AppText>
              <AppText tipo="legenda" peso="forte" style={styles.ratingSource}>
                {title.ratingSource ?? 'TMDB'}
              </AppText>
              {formattedVotes && (
                <AppText tipo="legenda" tabular style={styles.votesInlineText}>
                  · {formattedVotes} votos
                </AppText>
              )}
              <MaterialIcons
                name="info-outline"
                size={15}
                color={colors.textOnNavyMuted}
                style={styles.ratingInfoIcon}
              />
            </Pressable>

            {metacritic !== null && (
              <Pressable
                onPress={() => {
                  triggerSelectionHaptic();
                  setRatingInfoVisible(true);
                }}
                style={({ pressed }) => [
                  styles.metacriticBadge,
                  metacritic >= 61
                    ? styles.mcGreen
                    : metacritic >= 40
                      ? styles.mcYellow
                      : styles.mcRed,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Metacritic ${metacritic} de 100`}>
                <AppText peso="forte" tabular style={styles.metacriticScore}>
                  {metacritic}
                </AppText>
                <AppText tipo="legenda" peso="forte" style={styles.metacriticLabel}>
                  MC
                </AppText>
              </Pressable>
            )}
          </View>

          {title.genres.length > 0 && (
            <View style={styles.genresWrap}>
              {title.genres.map((genre) => (
                <Pressable
                  key={genre}
                  onPress={() => handlePressGenre(genre)}
                  style={({ pressed }) => [
                    styles.genreChip,
                    {
                      borderColor: withAlpha(accentColor, 0.34),
                      backgroundColor: colors.bgSurface,
                    },
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Sortear títulos do gênero ${genre}`}>
                  <MaterialIcons
                    name={getGenreIcon(genre)}
                    size={14}
                    color={colors.accentLink}
                  />
                  <AppText tipo="legenda" peso="forte" style={styles.genreChipText}>
                    {genre}
                  </AppText>
                </Pressable>
              ))}
            </View>
          )}

          <View style={styles.synopsisSection}>
            <AppText tipo="subtitulo" peso="forte" style={styles.sectionTitle}>
              Sinopse
            </AppText>

            <ExpandableText
              key={title.id}
              text={synopsisText}
              expanded={synopsisExpanded}
              onToggle={() => {
                triggerSelectionHaptic();
                setSynopsisExpanded((prev) => !prev);
              }}
              collapsedLines={4}
              fadeColor={colors.bgPrimary}
              textStyle={styles.synopsisText}
              expandAccessibilityLabel="Mostrar mais da sinopse"
              collapseAccessibilityLabel="Mostrar menos da sinopse"
              buttonStyle={styles.expandButton}
              buttonTextStyle={styles.expandButtonText}
              chevronColor={colors.accentLink}
              chevronSize={17}
            />
          </View>

          <StreamingAvailabilitySection
            services={allServices}
            subscriptions={subscriptions}
            accentColor={accentColor}
            onPressService={handleOpenService}
          />

          {!isSerialTitle && (
            <View style={styles.movieProgressSection}>
              <View style={styles.movieProgressHeader}>
                <AppText tipo="subtitulo" peso="forte" style={styles.sectionTitle}>
                  Progresso
                </AppText>
                <AppText tipo="legenda" peso="forte" style={styles.movieProgressPercent}>
                  {movieWatched ? '100%' : '0%'}
                </AppText>
              </View>

              <View
                style={[
                  styles.movieProgressCard,
                  movieWatched && { borderColor: withAlpha(colors.successText, 0.42) },
                ]}>
                <View style={styles.movieProgressTrack}>
                  <View
                    style={[
                      styles.movieProgressFill,
                      {
                        width: movieWatched ? '100%' : '0%',
                        backgroundColor: movieWatched ? colors.successText : accentColor,
                      },
                    ]}
                  />
                </View>

                <View style={styles.movieProgressRow}>
                  <AppText tipo="legenda" style={styles.movieProgressHint}>
                    {movieWatched
                      ? 'Você já assistiu a este filme.'
                      : 'Ainda não marcado como assistido.'}
                  </AppText>
                  <Pressable
                    onPress={() => {
                      if (movieWatched) {
                        triggerSelectionHaptic();
                      } else {
                        triggerSuccessHaptic();
                      }
                      seriesProgress.toggleEpisode(0, 1);
                    }}
                    style={({ pressed }) => [
                      styles.movieMarkButton,
                      movieWatched
                        ? styles.movieMarkButtonDone
                        : {
                            backgroundColor: withAlpha(accentColor, isDark ? 0.18 : 0.14),
                            borderColor: withAlpha(accentColor, 0.35),
                          },
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ checked: movieWatched }}
                    accessibilityLabel={
                      movieWatched
                        ? `Desmarcar ${title.title} como assistido`
                        : `Marcar ${title.title} como assistido`
                    }>
                    <MaterialIcons
                      name={movieWatched ? 'check-circle' : 'radio-button-unchecked'}
                      size={16}
                      color={movieWatched ? colors.successText : colors.textPrimary}
                    />
                    <AppText
                      tipo="legenda"
                      peso="forte"
                      style={[
                        styles.movieMarkText,
                        movieWatched && styles.movieMarkTextDone,
                      ]}>
                      {movieWatched ? 'Assistido' : 'Marcar'}
                    </AppText>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {loadingRichDetails ? (
            <TitleDetailsSkeleton />
          ) : richDetailsError ? (
            <View style={styles.richErrorCard}>
              <MaterialIcons name="error-outline" size={20} color={colors.accentLink} />
              <AppText tipo="legenda" style={styles.richErrorText}>
                {richDetailsError}
              </AppText>
              <Pressable
                onPress={handleRetryRichDetails}
                style={({ pressed }) => [styles.richRetryButton, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Tentar carregar detalhes novamente">
                <AppText tipo="legenda" peso="forte" style={styles.richRetryText}>
                  Tentar novamente
                </AppText>
              </Pressable>
            </View>
          ) : (
            <>
              {isSerialTitle && richDetails && richDetails.seasons.length > 0 && (
                <SeriesSeasonsSection
                  seasons={richDetails.seasons}
                  accentColor={accentColor}
                  expandedSeason={expandedSeason}
                  episodesBySeason={episodesBySeason}
                  loadingSeasonNumber={loadingSeasonNumber}
                  seasonEpisodesError={seasonEpisodesError}
                  onToggleExpandSeason={handleToggleExpandSeason}
                  onRetrySeasonEpisodes={handleRetrySeasonEpisodes}
                  totalWatchedEpisodes={seriesProgress.totalWatchedEpisodes}
                  isEpisodeWatched={seriesProgress.isEpisodeWatched}
                  getSeasonWatchedCount={seriesProgress.getSeasonWatchedCount}
                  isSeasonCompleted={seriesProgress.isSeasonCompleted}
                  onToggleEpisode={seriesProgress.toggleEpisode}
                  onToggleSeason={seriesProgress.toggleSeason}
                />
              )}

              {richDetails && richDetails.cast.length > 0 && (
                <CastCarousel cast={richDetails.cast} />
              )}

              <SimilarTitlesCarousel
                titles={richDetails?.similarTitles ?? []}
                accentColor={accentColor}
                onSelectTitle={handleSelectSimilar}
                onDrawSimilar={handleDrawSimilar}
              />
            </>
          )}
        </View>
      </Animated.ScrollView>

      <View
        style={[
          styles.fixedFooter,
          { paddingBottom: Math.max(insets.bottom, THEME.spacing.md) },
        ]}>
        <CollapsibleSection
          key={`footer-drawer-${title.id}`}
          expanded={streamingDrawerOpen && hasMultipleWatchOptions}
          slideOffset={8}
          openDuration={240}
          closeDuration={190}
          contentContainerStyle={styles.streamingDrawerSpacer}>
          <View style={styles.streamingDrawer}>
            <AppText tipo="legenda" peso="forte" style={styles.drawerTitle}>
              Escolha onde abrir
            </AppText>
            <View style={styles.drawerButtonsRow}>
              {watchOptions.map((serviceName, index) => (
                <Animated.View
                  key={serviceName}
                  entering={
                    reducedMotion
                      ? undefined
                      : FadeIn.delay(Math.min(index, 4) * 30).duration(170)
                  }>
                  <Pressable
                    onPress={() => handleOpenService(serviceName)}
                    style={({ pressed }) => [styles.drawerServiceChip, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={`Assistir no ${serviceName}`}>
                    <ServiceLogo name={serviceName} size={22} />
                    <AppText tipo="legenda" peso="forte" style={styles.drawerServiceName}>
                      {serviceName}
                    </AppText>
                    <MaterialIcons name="open-in-new" size={13} color={colors.textMuted} />
                  </Pressable>
                </Animated.View>
              ))}
            </View>
          </View>
        </CollapsibleSection>

        <View style={styles.footerActionsRow}>
          <Animated.View style={[styles.saveButtonShell, saveButtonAnimatedStyle]}>
            <Pressable
              onPress={handleToggleSaved}
              style={({ pressed }) => [styles.saveButtonInner, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={saved ? 'Remover da sua fila' : 'Salvar na sua fila'}>
              <BookmarkIcon
                saved={saved}
                itemKey={title.id}
                size={20}
                color={colors.savedActiveIcon}
                inactiveColor={colors.textPrimary}
                badgeColor={colors.accentPrimary}
                badgeBorderColor={isDark ? colors.savedActiveBg : colors.navy}
              />
              <AppText
                tipo="legenda"
                peso="forte"
                style={[styles.saveButtonText, saved && styles.saveButtonTextActive]}
                numberOfLines={1}>
                {saved ? 'Na sua Fila' : 'Salvar'}
              </AppText>
            </Pressable>
          </Animated.View>

          <Pressable
            onPress={handlePrimaryWatchPress}
            style={({ pressed }) => [
              styles.watchPrimaryButton,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              hasMultipleWatchOptions
                ? 'Assistir em um dos seus streamings'
                : primaryWatchService
                  ? `Assistir no ${primaryWatchService}`
                  : 'Buscar onde assistir'
            }>
            {!hasMultipleWatchOptions && primaryWatchService ? (
              <ServiceLogo name={primaryWatchService} size={22} />
            ) : (
              <MaterialIcons name="play-circle-filled" size={21} color={colors.textOnAccent} />
            )}
            <AppText tipo="texto" peso="forte" style={styles.watchPrimaryText} numberOfLines={1}>
              {hasMultipleWatchOptions
                ? 'Assistir em streaming'
                : primaryWatchService
                  ? `Assistir no ${primaryWatchService}`
                  : 'Buscar onde assistir'}
            </AppText>
            {hasMultipleWatchOptions ? (
              <Animated.View style={drawerChevronStyle}>
                <MaterialIcons name="chevron-right" size={20} color={colors.textOnAccent} />
              </Animated.View>
            ) : (
              <MaterialIcons name="open-in-new" size={16} color={colors.textOnAccent} />
            )}
          </Pressable>
        </View>
      </View>

      <RatingInfoSheet
        visible={ratingInfoVisible}
        title={title}
        voteCount={voteCount}
        onClose={() => setRatingInfoVisible(false)}
      />
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) => ({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    width: '100%' as const,
    maxWidth: 640,
    alignSelf: 'center' as const,
  },
  body: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    gap: theme.spacing.lg,
  },
  ratingRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.sm,
  },
  ratingBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    backgroundColor: theme.colors.heroBg,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  ratingValue: {
    color: theme.colors.textOnNavy,
    fontSize: 15,
  },
  ratingSource: {
    color: theme.colors.accentPrimary,
    fontSize: 11,
    letterSpacing: 0.4,
  },
  votesInlineText: {
    color: theme.colors.textOnNavyMuted,
    fontSize: 12,
  },
  ratingInfoIcon: {
    marginLeft: 2,
  },
  metacriticBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  mcGreen: {
    backgroundColor: theme.colors.mcGreen,
  },
  mcYellow: {
    backgroundColor: theme.colors.mcYellow,
  },
  mcRed: {
    backgroundColor: theme.colors.mcRed,
  },
  metacriticScore: {
    color: theme.colors.textOnNavy,
    fontSize: 14,
  },
  metacriticLabel: {
    color: theme.colors.textOnNavy,
    fontSize: 10,
    opacity: 0.9,
  },
  genresWrap: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.sm,
  },
  genreChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  genreChipText: {
    color: theme.colors.textPrimary,
    fontSize: 12.5,
  },
  synopsisSection: {
    gap: theme.spacing.xs,
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    marginBottom: 2,
  },
  synopsisText: {
    color: theme.colors.textStrongBody,
    fontSize: 15,
    lineHeight: 23,
  },
  expandButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    alignSelf: 'flex-start' as const,
    gap: 3,
    paddingVertical: 4,
    marginTop: theme.spacing.xs,
  },
  expandButtonText: {
    color: theme.colors.accentLink,
    fontSize: 13,
  },
  movieProgressSection: {
    gap: theme.spacing.sm,
  },
  movieProgressHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.sm,
  },
  movieProgressPercent: {
    color: theme.colors.textSecondary,
    fontSize: 12.5,
  },
  movieProgressCard: {
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  movieProgressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.bgSurfaceAlt,
    overflow: 'hidden' as const,
  },
  movieProgressFill: {
    height: '100%' as const,
    borderRadius: 4,
  },
  movieProgressRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.sm,
  },
  movieProgressHint: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  movieMarkButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  movieMarkButtonDone: {
    backgroundColor: theme.colors.bgSuccess,
    borderColor: theme.colors.borderSuccess,
  },
  movieMarkText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
  },
  movieMarkTextDone: {
    color: theme.colors.successText,
  },
  fixedFooter: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bgSurface,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    width: '100%' as const,
    maxWidth: 640,
    alignSelf: 'center' as const,
  },
  streamingDrawerSpacer: {
    paddingBottom: theme.spacing.sm,
  },
  streamingDrawer: {
    backgroundColor: theme.colors.bgSurfaceAlt,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    padding: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  drawerTitle: {
    color: theme.colors.textSecondary,
    fontSize: 11.5,
  },
  drawerButtonsRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.xs,
  },
  drawerServiceChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 7,
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  drawerServiceName: {
    color: theme.colors.textPrimary,
    fontSize: 12.5,
  },
  footerActionsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
  },
  saveButtonShell: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    minHeight: 48,
  },
  saveButtonInner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingHorizontal: theme.spacing.md,
    minHeight: 48,
  },
  saveButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 13.5,
  },
  saveButtonTextActive: {
    color: theme.isDark ? theme.colors.savedActiveText : theme.colors.textOnNavy,
  },
  watchPrimaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accentPrimary,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    paddingHorizontal: theme.spacing.md,
  },
  watchPrimaryText: {
    color: theme.colors.textOnAccent,
    fontSize: 14.5,
    flexShrink: 1,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  notFound: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 14,
  },
  notFoundTitle: {
    color: theme.colors.textPrimary,
    textAlign: 'center' as const,
  },
  link: {
    color: theme.colors.accentLink,
    fontSize: 14,
  },
  richErrorCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    padding: theme.spacing.md,
  },
  richErrorText: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: 12.5,
  },
  richRetryButton: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.savedActiveBg,
    borderWidth: 1,
    borderColor: theme.colors.savedActiveBorder,
  },
  richRetryText: {
    color: theme.colors.savedActiveText,
    fontSize: 12,
  },
});
