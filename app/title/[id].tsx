import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Linking from 'expo-linking';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';
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
import { resolveTitleAccentColor, THEME, withAlpha } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useCatalog } from '@/contexts/CatalogContext';
import { useMyList } from '@/contexts/MyListContext';
import { useSubscriptions } from '@/contexts/SubscriptionsContext';
import { useSeriesProgress } from '@/hooks/useSeriesProgress';
import {
  fetchRichTitleDetails,
  fetchTitleById,
  fetchTvSeasonEpisodes,
  findCachedRelatedTitle,
  getCachedRichTitleDetails,
  getCachedTitleDuration,
  getCachedTvSeasonEpisodes,
} from '@/services/tmdb';
import type { EpisodeSummary, RichTitleDetails } from '@/types/media';
import { formatCount } from '@/utils/format';
import { triggerLightImpactHaptic, triggerSelectionHaptic, triggerSuccessHaptic } from '@/utils/haptics';

export default function TitleDetailsScreen() {
  const { user, token, authReady } = useAuth();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { status, findTitle } = useCatalog();
  const { isSaved, toggleSavedTitle, findSavedTitle, storageReady } = useMyList();
  const { subscriptions } = useSubscriptions();

  const normalizedId = Array.isArray(id) ? id[0] ?? '' : id ?? '';
  const [savedSnapshot, setSavedSnapshot] = useState<MediaTitle | null>(null);
  const [resolvedFallback, setResolvedFallback] = useState<{
    id: string;
    title: MediaTitle | null;
    done: boolean;
  }>({ id: '', title: null, done: false });

  const liveTitle = normalizedId
    ? (findTitle(normalizedId) ?? findSavedTitle(normalizedId) ?? findCachedRelatedTitle(normalizedId))
    : undefined;
  const fallbackTitle =
    resolvedFallback.id === normalizedId ? (resolvedFallback.title ?? undefined) : undefined;
  const title =
    liveTitle ?? (savedSnapshot?.id === normalizedId ? savedSnapshot : undefined) ?? fallbackTitle;
  const resolvingFallback = Boolean(
    normalizedId && !title && (resolvedFallback.id !== normalizedId || !resolvedFallback.done),
  );
  const saved = title ? isSaved(title.id) : false;

  const [richState, setRichState] = useState<{
    id: string;
    details: RichTitleDetails | null;
    error: string | null;
    done: boolean;
  }>({
    id: '',
    details: null,
    error: null,
    done: false,
  });
  const [richRetryNonce, setRichRetryNonce] = useState(0);
  const [seasonSelection, setSeasonSelection] = useState<{
    titleId: string;
    seasonNumber: number | null;
  }>({ titleId: '', seasonNumber: null });
  const [episodesState, setEpisodesState] = useState<{
    titleId: string;
    bySeason: Partial<Record<number, EpisodeSummary[]>>;
    errorBySeason: Partial<Record<number, string | null>>;
  }>({
    titleId: '',
    bySeason: {},
    errorBySeason: {},
  });
  const [seasonRetryNonce, setSeasonRetryNonce] = useState(0);
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [ratingInfoVisible, setRatingInfoVisible] = useState(false);
  const [streamingDrawerOpen, setStreamingDrawerOpen] = useState(false);
  const drawNonceRef = useRef(0);

  const seriesProgress = useSeriesProgress(user?.id ?? null, title?.id ?? '', token);

  const scrollY = useSharedValue(0);
  const saveProgress = useSharedValue(saved ? 1 : 0);
  const drawerChevronRotation = useSharedValue(0);

  const cachedRichDetails = title ? getCachedRichTitleDetails(title.id) : null;
  const richDetails =
    cachedRichDetails ?? (title && richState.id === title.id ? richState.details : null);
  const loadingRichDetails = Boolean(
    title && !cachedRichDetails && (richState.id !== title.id || !richState.done),
  );
  const richDetailsError =
    title && !cachedRichDetails && richState.id === title.id && richState.done
      ? richState.error
      : null;

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

  const episodesBySeason = useMemo(() => {
    const base: Partial<Record<number, EpisodeSummary[]>> =
      episodesState.titleId === titleId ? { ...episodesState.bySeason } : {};
    if (titleId && richSeasons) {
      for (const season of richSeasons) {
        if (!base[season.seasonNumber]) {
          const cached = getCachedTvSeasonEpisodes(titleId, season.seasonNumber);
          if (cached) {
            base[season.seasonNumber] = cached;
          }
        }
      }
    }
    return base;
  }, [episodesState.bySeason, episodesState.titleId, richSeasons, titleId]);

  const seasonEpisodesError =
    expandedSeason !== null && episodesState.titleId === titleId
      ? (episodesState.errorBySeason[expandedSeason] ?? null)
      : null;

  const loadingSeasonNumber =
    expandedSeason !== null &&
    title &&
    checkIsSerialTitle(title) &&
    !episodesBySeason[expandedSeason] &&
    !seasonEpisodesError
      ? expandedSeason
      : null;

  useEffect(() => {
    if (!normalizedId || liveTitle || savedSnapshot?.id === normalizedId) return;

    let cancelled = false;
    void fetchTitleById(normalizedId).then((fetched) => {
      if (cancelled) return;
      setResolvedFallback({ id: normalizedId, title: fetched, done: true });
    });

    return () => {
      cancelled = true;
    };
  }, [liveTitle, normalizedId, savedSnapshot?.id]);

  useEffect(() => {
    if (!title) return;
    if (getCachedRichTitleDetails(title.id)) return;

    let cancelled = false;
    void fetchRichTitleDetails(title, { throwOnError: true })
      .then((details) => {
        if (cancelled) return;
        setRichState({ id: title.id, details, error: null, done: true });
      })
      .catch(() => {
        if (cancelled) return;
        setRichState({
          id: title.id,
          details: null,
          error: 'Não foi possível carregar detalhes adicionais no momento.',
          done: true,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [richRetryNonce, title]);

  useEffect(() => {
    if (!title || !checkIsSerialTitle(title) || expandedSeason === null) return;
    if (getCachedTvSeasonEpisodes(title.id, expandedSeason)) return;

    let cancelled = false;
    const targetTitleId = title.id;
    const targetSeason = expandedSeason;

    void fetchTvSeasonEpisodes(targetTitleId, targetSeason, { throwOnError: true })
      .then((list) => {
        if (cancelled) return;
        setEpisodesState((prev) => {
          const sameTitle = prev.titleId === targetTitleId;
          return {
            titleId: targetTitleId,
            bySeason: sameTitle ? { ...prev.bySeason, [targetSeason]: list } : { [targetSeason]: list },
            errorBySeason: sameTitle ? { ...prev.errorBySeason, [targetSeason]: null } : {},
          };
        });
      })
      .catch(() => {
        if (cancelled) return;
        setEpisodesState((prev) => {
          const sameTitle = prev.titleId === targetTitleId;
          return {
            titleId: targetTitleId,
            bySeason: sameTitle ? prev.bySeason : {},
            errorBySeason: sameTitle
              ? { ...prev.errorBySeason, [targetSeason]: 'Não foi possível carregar os episódios.' }
              : { [targetSeason]: 'Não foi possível carregar os episódios.' },
          };
        });
      });

    return () => {
      cancelled = true;
    };
  }, [expandedSeason, seasonRetryNonce, title]);

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
      setEpisodesState((prev) => {
        if (prev.titleId !== titleId) return prev;
        return {
          ...prev,
          errorBySeason: { ...prev.errorBySeason, [seasonNumber]: null },
        };
      });
      setSeasonSelection({ titleId, seasonNumber });
      setSeasonRetryNonce((prev) => prev + 1);
    },
    [titleId],
  );

  const handleRetryRichDetails = useCallback(() => {
    setRichState({ id: '', details: null, error: null, done: false });
    setRichRetryNonce((prev) => prev + 1);
  }, []);

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
      [THEME.colors.bgSubtle, THEME.colors.navy],
    ),
    borderColor: interpolateColor(
      saveProgress.get(),
      [0, 1],
      [THEME.colors.borderMedium, THEME.colors.navy],
    ),
  }));

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
          <MaterialIcons name="movie-filter" size={40} color={THEME.colors.accentDeep} />
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
  const accentColor = resolveTitleAccentColor(title.color);
  const cachedDuration = getCachedTitleDuration(title);
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
              <MaterialIcons name="star" size={16} color={THEME.colors.gold} />
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
                color={THEME.colors.textOnNavyMuted}
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
                      backgroundColor: THEME.colors.bgCard,
                    },
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Sortear títulos do gênero ${genre}`}>
                  <MaterialIcons
                    name={getGenreIcon(genre)}
                    size={14}
                    color={THEME.colors.accentText}
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
              fadeColor={THEME.colors.bgCanvas}
              textStyle={styles.synopsisText}
              expandAccessibilityLabel="Mostrar mais da sinopse"
              collapseAccessibilityLabel="Mostrar menos da sinopse"
              buttonStyle={styles.expandButton}
              buttonTextStyle={styles.expandButtonText}
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
                  movieWatched && { borderColor: withAlpha(THEME.colors.successText, 0.42) },
                ]}>
                <View style={styles.movieProgressTrack}>
                  <View
                    style={[
                      styles.movieProgressFill,
                      {
                        width: movieWatched ? '100%' : '0%',
                        backgroundColor: movieWatched ? THEME.colors.successText : accentColor,
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
                            backgroundColor: withAlpha(accentColor, 0.14),
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
                      color={movieWatched ? THEME.colors.successText : THEME.colors.textPrimary}
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
              <MaterialIcons name="error-outline" size={20} color={THEME.colors.accentText} />
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
                    <MaterialIcons name="open-in-new" size={13} color={THEME.colors.textMuted} />
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
                color={THEME.colors.gold}
                inactiveColor={THEME.colors.textPrimary}
                badgeColor={THEME.colors.gold}
                badgeBorderColor={THEME.colors.navy}
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
              <MaterialIcons name="play-circle-filled" size={21} color={THEME.colors.navy} />
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
                <MaterialIcons name="chevron-right" size={20} color={THEME.colors.navy} />
              </Animated.View>
            ) : (
              <MaterialIcons name="open-in-new" size={16} color={THEME.colors.navy} />
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.colors.bgCanvas,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  body: {
    paddingHorizontal: THEME.spacing.lg,
    paddingTop: THEME.spacing.md,
    gap: THEME.spacing.lg,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: THEME.spacing.sm,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: THEME.colors.navy,
    borderRadius: THEME.radius.sm,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  ratingValue: {
    color: THEME.colors.textOnNavy,
    fontSize: 15,
  },
  ratingSource: {
    color: THEME.colors.gold,
    fontSize: 11,
    letterSpacing: 0.4,
  },
  votesInlineText: {
    color: THEME.colors.textOnNavyMuted,
    fontSize: 12,
  },
  ratingInfoIcon: {
    marginLeft: 2,
  },
  metacriticBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: THEME.radius.sm,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  mcGreen: {
    backgroundColor: THEME.colors.mcGreen,
  },
  mcYellow: {
    backgroundColor: THEME.colors.mcYellow,
  },
  mcRed: {
    backgroundColor: THEME.colors.mcRed,
  },
  metacriticScore: {
    color: THEME.colors.textOnNavy,
    fontSize: 14,
  },
  metacriticLabel: {
    color: THEME.colors.textOnNavy,
    fontSize: 10,
    opacity: 0.9,
  },
  genresWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: THEME.spacing.sm,
  },
  genreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: THEME.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  genreChipText: {
    color: THEME.colors.textPrimary,
    fontSize: 12.5,
  },
  synopsisSection: {
    gap: THEME.spacing.xs,
  },
  sectionTitle: {
    color: THEME.colors.textPrimary,
    fontSize: 16,
    marginBottom: 2,
  },
  synopsisText: {
    color: THEME.colors.textStrongBody,
    fontSize: 15,
    lineHeight: 23,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 3,
    paddingVertical: 4,
    marginTop: THEME.spacing.xs,
  },
  expandButtonText: {
    color: THEME.colors.accentText,
    fontSize: 13,
  },
  movieProgressSection: {
    gap: THEME.spacing.sm,
  },
  movieProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: THEME.spacing.sm,
  },
  movieProgressPercent: {
    color: THEME.colors.textSecondary,
    fontSize: 12.5,
  },
  movieProgressCard: {
    backgroundColor: THEME.colors.bgCard,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    padding: THEME.spacing.md,
    gap: THEME.spacing.sm,
  },
  movieProgressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.colors.bgSubtle,
    overflow: 'hidden',
  },
  movieProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  movieProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: THEME.spacing.sm,
  },
  movieProgressHint: {
    flex: 1,
    color: THEME.colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  movieMarkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: THEME.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  movieMarkButtonDone: {
    backgroundColor: THEME.colors.bgSuccess,
    borderColor: THEME.colors.borderSuccess,
  },
  movieMarkText: {
    color: THEME.colors.textPrimary,
    fontSize: 12,
  },
  movieMarkTextDone: {
    color: THEME.colors.successText,
  },
  fixedFooter: {
    borderTopWidth: 1,
    borderTopColor: THEME.colors.borderLight,
    backgroundColor: THEME.colors.bgCard,
    paddingHorizontal: THEME.spacing.lg,
    paddingTop: THEME.spacing.sm,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  streamingDrawerSpacer: {
    paddingBottom: THEME.spacing.sm,
  },
  streamingDrawer: {
    backgroundColor: THEME.colors.bgSubtle,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    padding: THEME.spacing.sm,
    gap: THEME.spacing.xs,
  },
  drawerTitle: {
    color: THEME.colors.textSecondary,
    fontSize: 11.5,
  },
  drawerButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: THEME.spacing.xs,
  },
  drawerServiceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: THEME.colors.bgCard,
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    borderColor: THEME.colors.borderMedium,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  drawerServiceName: {
    color: THEME.colors.textPrimary,
    fontSize: 12.5,
  },
  footerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
  },
  saveButtonShell: {
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    minHeight: 48,
  },
  saveButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: THEME.spacing.md,
    minHeight: 48,
  },
  saveButtonText: {
    color: THEME.colors.textPrimary,
    fontSize: 13.5,
  },
  saveButtonTextActive: {
    color: THEME.colors.textOnNavy,
  },
  watchPrimaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: THEME.spacing.md,
  },
  watchPrimaryText: {
    color: THEME.colors.navy,
    fontSize: 14.5,
    flexShrink: 1,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  notFoundTitle: {
    color: THEME.colors.textPrimary,
    textAlign: 'center',
  },
  link: {
    color: THEME.colors.accentText,
    fontSize: 14,
  },
  richErrorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: THEME.colors.bgCard,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    padding: THEME.spacing.md,
  },
  richErrorText: {
    flex: 1,
    color: THEME.colors.textSecondary,
    fontSize: 12.5,
  },
  richRetryButton: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: THEME.radius.pill,
    backgroundColor: THEME.colors.bgHighlight,
    borderWidth: 1,
    borderColor: THEME.colors.borderWarm,
  },
  richRetryText: {
    color: THEME.colors.accentText,
    fontSize: 12,
  },
});
