import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Share } from 'react-native';

import {
  formatAverageRating,
  getMetacriticScore,
  getTitleServices,
  isSerialTitle as checkIsSerialTitle,
} from '@/constants/catalog';
import { useAuth } from '@/contexts/AuthContext';
import {
  useCatalog,
  useSeasonEpisodes,
  useTitleById,
  useTitleDetails,
} from '@/hooks/useCatalog';
import { useDrawHistory } from '@/hooks/useDrawHistory';
import { useMyList } from '@/hooks/useMyList';
import { usePersonalRating } from '@/hooks/usePersonalRating';
import { useSeriesProgress } from '@/hooks/useSeriesProgress';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { useTitleRatingSummary } from '@/hooks/useTitleRatingSummary';
import type { MediaTitle } from '@/types/media';
import { formatCount } from '@/utils/format';
import {
  triggerLightImpactHaptic,
  triggerSelectionHaptic,
  triggerSuccessHaptic,
} from '@/utils/haptics';
import { openStreamingService } from '@/utils/linking';
import {
  applyEpisodeToggle,
  applySeasonToggle,
  hasWatchedAnyPart,
  isSeriesCompleted,
} from '@/utils/watchedProgress';

/**
 * Encapsula a resolução de título, detalhes ricos, episódios, progresso, lista salva,
 * assinaturas e ações com feedback háptico para a tela de detalhes (`app/title/[id].tsx`).
 */
export function useTitleDetailsController(rawId: string | string[] | undefined) {
  const { user, token, authReady, isPasswordRecovery } = useAuth();
  const { status, findTitle } = useCatalog();
  const { isSaved, toggleSavedTitle, removeFromMyList, findSavedTitle, storageReady } = useMyList();
  const { history } = useDrawHistory();
  const { subscriptions } = useSubscriptions();

  const normalizedId = Array.isArray(rawId) ? rawId[0] ?? '' : rawId ?? '';
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
  const [personalRatingVisible, setPersonalRatingVisible] = useState(false);
  const [streamingDrawerOpen, setStreamingDrawerOpen] = useState(false);
  const drawNonceRef = useRef(0);

  const seriesProgress = useSeriesProgress(user?.id ?? null, title?.id ?? '', token);
  const personalRating = usePersonalRating(user?.id ?? null, title?.id ?? '');
  const userRatingSummaryQuery = useTitleRatingSummary(title?.id ?? '');

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

  const isSerialTitle = title ? checkIsSerialTitle(title) : false;

  const {
    episodesBySeason,
    isLoading: loadingActiveSeasonEpisodes,
    error: activeSeasonError,
    refetch: refetchSeasonEpisodes,
  } = useSeasonEpisodes(titleId, expandedSeason, isSerialTitle, richSeasons);

  const seasonEpisodesError = expandedSeason !== null ? activeSeasonError : null;
  const loadingSeasonNumber =
    expandedSeason !== null && isSerialTitle && loadingActiveSeasonEpisodes
      ? expandedSeason
      : null;

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
  const hasMultipleWatchOptions = watchOptions.length > 1;
  const primaryWatchService = watchOptions[0] ?? null;

  const rawDuration = richDetails?.duration ?? cachedDuration ?? title?.duration;
  const safeDuration = title
    ? rawDuration && rawDuration !== 'Duração não informada' && rawDuration !== title.kind
      ? rawDuration
      : isSerialTitle
        ? '1 temporada'
        : 'Filme'
    : '';

  const metacritic = title ? getMetacriticScore(title) : null;
  const voteCount = richDetails?.voteCount ?? title?.voteCount ?? null;
  const formattedVotes =
    typeof voteCount === 'number' && voteCount > 0 ? formatCount(voteCount) : null;
  const synopsisText = title
    ? title.synopsis.trim() || 'Sinopse indisponível para este título no momento.'
    : '';
  // shortcut: reuses season 0 / ep 1 in user_series_progress for movies; split into its own column only if partial movie timestamps are ever added
  const movieWatched = Boolean(title && !isSerialTitle && seriesProgress.isEpisodeWatched(0, 1));
  const hasRouletteWatched = useMemo(
    () =>
      Boolean(
        titleId &&
          history.some((entry) => entry.tmdbId === titleId && entry.acao === 'assistiu'),
      ),
    [history, titleId],
  );
  const canRate = useMemo(
    () =>
      Boolean(
        title &&
          hasWatchedAnyPart({
            isSerial: isSerialTitle,
            progressMap: seriesProgress.progressMap,
            hasRouletteWatched,
          }),
      ),
    [hasRouletteWatched, isSerialTitle, seriesProgress.progressMap, title],
  );
  const watchRequirementHint = isSerialTitle
    ? 'Assista a pelo menos 1 episódio para avaliar.'
    : 'Marque o filme como assistido para avaliar.';

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

  const handleToggleEpisode = useCallback(
    (seasonNumber: number, episodeNumber: number) => {
      if (!titleId) return;
      const wasCompleted = Boolean(
        richSeasons && isSeriesCompleted(seriesProgress.progressMap, richSeasons),
      );
      const nextMap = applyEpisodeToggle(seriesProgress.progressMap, seasonNumber, episodeNumber);
      const nowCompleted = Boolean(richSeasons && isSeriesCompleted(nextMap, richSeasons));
      seriesProgress.toggleEpisode(seasonNumber, episodeNumber);
      if (!wasCompleted && nowCompleted) {
        if (saved) removeFromMyList(titleId);
        setPersonalRatingVisible(true);
      }
    },
    [removeFromMyList, richSeasons, saved, seriesProgress, titleId],
  );

  const handleToggleSeason = useCallback(
    (seasonNumber: number, episodeCount: number, episodeNumbers?: number[]) => {
      if (!titleId) return;
      const wasCompleted = Boolean(
        richSeasons && isSeriesCompleted(seriesProgress.progressMap, richSeasons),
      );
      const nextMap = applySeasonToggle(
        seriesProgress.progressMap,
        seasonNumber,
        episodeCount,
        episodeNumbers,
      );
      const nowCompleted = Boolean(richSeasons && isSeriesCompleted(nextMap, richSeasons));
      seriesProgress.toggleSeason(seasonNumber, episodeCount, episodeNumbers);
      if (!wasCompleted && nowCompleted) {
        if (saved) removeFromMyList(titleId);
        setPersonalRatingVisible(true);
      }
    },
    [removeFromMyList, richSeasons, saved, seriesProgress, titleId],
  );

  const handleToggleMovieWatched = useCallback(() => {
    if (!title) return;
    if (movieWatched) {
      triggerSelectionHaptic();
    } else {
      triggerSuccessHaptic();
    }
    const nextCompleted = !movieWatched;
    seriesProgress.toggleEpisode(0, 1);
    if (nextCompleted) {
      setPersonalRatingVisible(true);
      if (saved) removeFromMyList(title.id);
    }
  }, [movieWatched, removeFromMyList, saved, seriesProgress, title]);

  const handleToggleSaved = useCallback(() => {
    if (!title) return;
    const nextSaved = !saved;
    if (nextSaved) {
      triggerLightImpactHaptic();
    } else {
      triggerSelectionHaptic();
    }
    setSavedSnapshot(title);
    toggleSavedTitle(title);
  }, [saved, title, toggleSavedTitle]);

  const handleShare = useCallback(() => {
    if (!title) return;
    triggerSelectionHaptic();
    const ratingText = formatAverageRating(title);
    void Share.share({
      message: `Estou pensando em assistir ${title.title} (${title.year}) — ${ratingText}★ no NextWatch!`,
      title: title.title,
    }).catch(() => {});
  }, [title]);

  const handleWatchTrailer = useCallback(() => {
    if (!richDetails?.trailerUrl) return;
    triggerSelectionHaptic();
    void Linking.openURL(richDetails.trailerUrl).catch(() => {});
  }, [richDetails?.trailerUrl]);

  const handleOpenService = useCallback(
    (serviceName: string) => {
      if (!title) return;
      triggerSuccessHaptic();
      setStreamingDrawerOpen(false);
      void openStreamingService(serviceName, title.title);
    },
    [title],
  );

  const handlePrimaryWatchPress = useCallback(() => {
    if (!title) return;
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
  }, [handleOpenService, hasMultipleWatchOptions, primaryWatchService, title]);

  const handlePressGenre = useCallback(
    (genre: string) => {
      if (!title) return;
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
    },
    [title],
  );

  const handleDrawSimilar = useCallback(() => {
    if (!title) return;
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
  }, [title]);

  const handleSelectSimilar = useCallback((item: MediaTitle) => {
    triggerSelectionHaptic();
    router.push(`/title/${item.id}`);
  }, []);

  const handleToggleSynopsis = useCallback(() => {
    triggerSelectionHaptic();
    setSynopsisExpanded((prev) => !prev);
  }, []);

  const handleOpenRatingInfo = useCallback(() => {
    triggerSelectionHaptic();
    setRatingInfoVisible(true);
  }, []);

  const handleCloseRatingInfo = useCallback(() => {
    setRatingInfoVisible(false);
  }, []);

  const handleOpenPersonalRating = useCallback(() => {
    if (!canRate) return;
    triggerSelectionHaptic();
    setPersonalRatingVisible(true);
  }, [canRate]);

  const handleClosePersonalRating = useCallback(() => {
    setPersonalRatingVisible(false);
  }, []);

  const handleSavePersonalRating = useCallback((rating: number | null) => {
    personalRating.saveRating(rating);
  }, [personalRating]);

  return {
    user,
    authReady,
    isPasswordRecovery,
    catalogStatus: status,
    storageReady,
    resolvingFallback,
    title,
    saved,
    subscriptions,
    seriesProgress,
    richDetails,
    loadingRichDetails,
    richDetailsError,
    isSerialTitle,
    safeDuration,
    metacritic,
    voteCount,
    formattedVotes,
    synopsisText,
    synopsisExpanded,
    ratingInfoVisible,
    personalRatingVisible,
    streamingDrawerOpen,
    movieWatched,
    allServices,
    watchOptions,
    hasMultipleWatchOptions,
    primaryWatchService,
    expandedSeason,
    episodesBySeason,
    loadingSeasonNumber,
    seasonEpisodesError,
    personalRating: personalRating.rating,
    personalRatingReady: personalRating.ready,
    userRatingSummary: userRatingSummaryQuery.summary,
    canRate,
    watchRequirementHint,
    handleToggleExpandSeason,
    handleRetrySeasonEpisodes,
    handleRetryRichDetails,
    handleToggleEpisode,
    handleToggleSeason,
    handleToggleMovieWatched,
    handleToggleSaved,
    handleShare,
    handleWatchTrailer,
    handleOpenService,
    handlePrimaryWatchPress,
    handlePressGenre,
    handleDrawSimilar,
    handleSelectSimilar,
    handleToggleSynopsis,
    handleOpenRatingInfo,
    handleCloseRatingInfo,
    handleOpenPersonalRating,
    handleClosePersonalRating,
    handleSavePersonalRating,
  };
}
