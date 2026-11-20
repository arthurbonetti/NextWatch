import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

import {
  getDrawGenres,
  getTitleServices,
  isEligibleForDraw,
  type MediaTitle,
} from '@/constants/catalog';
import { useAuth } from '@/contexts/AuthContext';
import { useCatalog } from '@/contexts/CatalogContext';
import { useDrawHistory } from '@/contexts/DrawHistoryContext';
import { useMyList } from '@/contexts/MyListContext';
import { useSubscriptions } from '@/contexts/SubscriptionsContext';
import { type DrawKindFilter, usePersistedDrawFilters } from '@/hooks/usePersistedDrawFilters';
import { useWatchedProgressIds } from '@/hooks/useSeriesProgress';
import {
  fetchTitleDuration,
  fetchTitleTrailerUrl,
  getCachedTitleDuration,
  getCachedTitleTrailerUrl,
} from '@/services/tmdb';
import type { DrawAction } from '@/types/drawHistory';
import { quickSortByRandom } from '@/utils/quickSort';

export type DrawPhase = 'filtros' | 'sorteando' | 'resultado';

export type SpinSession = {
  winner: MediaTitle;
  candidates: MediaTitle[];
  eligibleCount: number;
  spinKey: number;
};

export type RouletteDeepLinkParams = {
  drawGenre?: string;
  drawKind?: string;
  autoSpin?: string;
  drawNonce?: string;
};

export function useRouletteFlow(params: RouletteDeepLinkParams) {
  const { drawGenre, drawKind, autoSpin, drawNonce } = params;
  const reducedMotion = useReducedMotion();
  const { user, token } = useAuth();
  const { titles, status: catalogStatus, isFetchingCatalog } = useCatalog();
  const { subscriptions, storageReady } = useSubscriptions();
  const { history, recordDrawAction, updateDrawAction } = useDrawHistory();
  const { isSaved, toggleSavedTitle } = useMyList();
  const { progressTitleIds, refreshProgressIds } = useWatchedProgressIds(
    user?.id ?? null,
    token,
  );

  const [drawModalVisible, setDrawModalVisible] = useState(false);
  const [phase, setPhase] = useState<DrawPhase>('filtros');
  const [incompleteConfirmVisible, setIncompleteConfirmVisible] = useState(false);
  const [lastDrawnId, setLastDrawnId] = useState<string | null>(null);
  const [spinSession, setSpinSession] = useState<SpinSession | null>(null);
  const [pendingAutoSpin, setPendingAutoSpin] = useState(false);
  const [winnerDetails, setWinnerDetails] = useState<{
    id: string;
    duration: string;
    trailerUrl: string | null;
  }>({
    id: '',
    duration: '',
    trailerUrl: null,
  });

  const drawEntryPromiseRef = useRef<Promise<string | null> | null>(null);
  const drawHandledRef = useRef(false);
  const handledDrawNonceRef = useRef<string | null>(null);

  const activeSubscriptions = useMemo(
    () => subscriptions.filter((subscription) => subscription.active),
    [subscriptions],
  );
  const activeServiceNames = useMemo(
    () => activeSubscriptions.map((subscription) => subscription.provider),
    [activeSubscriptions],
  );
  const activeServiceSet = useMemo(() => new Set(activeServiceNames), [activeServiceNames]);

  const {
    filters,
    enabledServices,
    setKind,
    toggleGenre,
    clearGenres,
    toggleService,
    setHideWatched,
    resetFilters,
    applyPreset,
  } = usePersistedDrawFilters(user?.id ?? null, activeServiceNames);

  const availableTitles = useMemo(
    () =>
      titles.filter((title) =>
        getTitleServices(title).some((service) => activeServiceSet.has(service)),
      ),
    [activeServiceSet, titles],
  );

  const eligibleTitles = useMemo(
    () => availableTitles.filter(isEligibleForDraw),
    [availableTitles],
  );

  const availableGenres = useMemo(() => getDrawGenres(eligibleTitles), [eligibleTitles]);

  const watchedTitleIds = useMemo(() => {
    const ids = new Set(
      history.filter((entry) => entry.acao === 'assistiu').map((entry) => entry.tmdbId),
    );
    for (const id of progressTitleIds) {
      ids.add(id);
    }
    return ids;
  }, [history, progressTitleIds]);

  const enabledServiceSet = useMemo(() => new Set(enabledServices), [enabledServices]);

  const drawCandidates = useMemo(() => {
    if (enabledServiceSet.size === 0) return [];
    return eligibleTitles.filter((title) => {
      const serviceMatches = getTitleServices(title).some((service) =>
        enabledServiceSet.has(service),
      );
      if (!serviceMatches) return false;
      const kindMatches = filters.kind === 'Todos' || title.kind === filters.kind;
      if (!kindMatches) return false;
      const genreMatches =
        filters.selectedGenres.length === 0 ||
        filters.selectedGenres.some((selectedGenre) => title.genres.includes(selectedGenre));
      if (!genreMatches) return false;
      if (filters.hideWatched && watchedTitleIds.has(title.id)) return false;
      return true;
    });
  }, [
    eligibleTitles,
    enabledServiceSet,
    filters.hideWatched,
    filters.kind,
    filters.selectedGenres,
    watchedTitleIds,
  ]);

  const featuredSample = eligibleTitles[0] ?? availableTitles[0] ?? titles[0] ?? null;

  const commitDrawAction = useCallback(
    (title: MediaTitle, action: DrawAction) => {
      drawHandledRef.current = true;
      const existingPromise = drawEntryPromiseRef.current;
      if (!existingPromise) {
        drawEntryPromiseRef.current = recordDrawAction(title, action);
        return;
      }
      void existingPromise.then((entryId) => {
        if (entryId) void updateDrawAction(entryId, action);
      });
    },
    [recordDrawAction, updateDrawAction],
  );

  const startDraw = useCallback(() => {
    if (drawCandidates.length === 0) return;

    const candidates =
      drawCandidates.length > 1
        ? drawCandidates.filter((title) => title.id !== lastDrawnId)
        : drawCandidates;
    const winner = quickSortByRandom(candidates)[0];
    if (!winner) return;

    drawEntryPromiseRef.current = null;
    drawHandledRef.current = false;
    setLastDrawnId(winner.id);
    setSpinSession((prev) => ({
      winner,
      candidates: drawCandidates,
      eligibleCount: drawCandidates.length,
      spinKey: (prev?.spinKey ?? 0) + 1,
    }));
    setPhase(reducedMotion ? 'resultado' : 'sorteando');
  }, [drawCandidates, lastDrawnId, reducedMotion]);

  const activeWinner = spinSession?.winner ?? null;

  useEffect(() => {
    if (!activeWinner) return;
    let active = true;

    void Promise.all([
      fetchTitleDuration(activeWinner),
      fetchTitleTrailerUrl(activeWinner),
    ]).then(([resolvedDuration, resolvedTrailer]) => {
      if (!active) return;
      setWinnerDetails({
        id: activeWinner.id,
        duration: resolvedDuration || activeWinner.duration,
        trailerUrl: resolvedTrailer,
      });
    });

    return () => {
      active = false;
    };
  }, [activeWinner]);

  useEffect(() => {
    if (!drawNonce || handledDrawNonceRef.current === drawNonce) return;
    handledDrawNonceRef.current = drawNonce;

    const validKinds: DrawKindFilter[] = ['Todos', 'Filme', 'Série', 'Anime'];
    const parsedKind = validKinds.includes(drawKind as DrawKindFilter)
      ? (drawKind as DrawKindFilter)
      : 'Todos';
    const genres = drawGenre ? [drawGenre] : [];
    const shouldAutoSpin = autoSpin === '1';

    const frame = requestAnimationFrame(() => {
      applyPreset({ kind: parsedKind, genres });
      setIncompleteConfirmVisible(false);
      setPhase('filtros');
      setSpinSession(null);
      setDrawModalVisible(true);
      if (shouldAutoSpin) {
        setPendingAutoSpin(true);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [applyPreset, autoSpin, drawGenre, drawKind, drawNonce]);

  useEffect(() => {
    if (!pendingAutoSpin || !drawModalVisible || drawCandidates.length === 0) return;

    const frame = requestAnimationFrame(() => {
      setPendingAutoSpin(false);
      startDraw();
    });
    return () => cancelAnimationFrame(frame);
  }, [drawCandidates.length, drawModalVisible, pendingAutoSpin, startDraw]);

  const openDrawModal = useCallback(() => {
    setDrawModalVisible(true);
  }, []);

  const dismissFromSheet = useCallback(() => {
    setIncompleteConfirmVisible(false);
    setPendingAutoSpin(false);
    setPhase('filtros');
    setSpinSession(null);
    setDrawModalVisible(false);
  }, []);

  const handleClose = useCallback(() => {
    if (phase === 'resultado' && spinSession?.winner && !drawHandledRef.current) {
      drawHandledRef.current = true;
      void recordDrawAction(spinSession.winner, 'ignorou');
    }
    drawEntryPromiseRef.current = null;
    drawHandledRef.current = false;
    dismissFromSheet();
  }, [dismissFromSheet, phase, recordDrawAction, spinSession]);

  const handleDrawPress = useCallback(() => {
    if (drawCandidates.length === 0) return;
    if (isFetchingCatalog) {
      setIncompleteConfirmVisible(true);
      return;
    }
    startDraw();
  }, [drawCandidates.length, isFetchingCatalog, startDraw]);

  const confirmIncompleteDraw = useCallback(() => {
    setIncompleteConfirmVisible(false);
    startDraw();
  }, [startDraw]);

  const cancelIncompleteDraw = useCallback(() => {
    setIncompleteConfirmVisible(false);
  }, []);

  const handleRouletteDone = useCallback(() => {
    setPhase('resultado');
  }, []);

  const handleDrawAnother = useCallback(() => {
    if (spinSession?.winner && !drawHandledRef.current) {
      drawHandledRef.current = true;
      void recordDrawAction(spinSession.winner, 'sorteou outro');
    }
    startDraw();
  }, [recordDrawAction, spinSession, startDraw]);

  const handleWatchWinner = useCallback(() => {
    if (spinSession?.winner) {
      commitDrawAction(spinSession.winner, 'assistiu');
    }
    handleClose();
  }, [commitDrawAction, handleClose, spinSession]);

  const handleMarkWinnerWatched = useCallback(() => {
    if (!spinSession?.winner) return;
    commitDrawAction(spinSession.winner, 'assistiu');
  }, [commitDrawAction, spinSession]);

  const handleToggleWinnerSaved = useCallback(() => {
    if (!spinSession?.winner) return;
    const nextSaved = !isSaved(spinSession.winner.id);
    toggleSavedTitle(spinSession.winner);
    if (nextSaved) {
      commitDrawAction(spinSession.winner, 'salvou');
    }
  }, [commitDrawAction, isSaved, spinSession, toggleSavedTitle]);

  const winnerDuration = activeWinner
    ? winnerDetails.id === activeWinner.id
      ? winnerDetails.duration
      : getCachedTitleDuration(activeWinner)
    : '';
  const winnerTrailerUrl = activeWinner
    ? winnerDetails.id === activeWinner.id
      ? winnerDetails.trailerUrl
      : getCachedTitleTrailerUrl(activeWinner)
    : null;
  const isWinnerSaved = activeWinner ? isSaved(activeWinner.id) : false;

  return {
    activeSubscriptions,
    activeServiceSet,
    availableTitles,
    eligibleTitles,
    featuredSample,
    catalogStatus,
    isFetchingCatalog,
    storageReady,
    refreshProgressIds,
    isTitleSaved: isSaved,
    toggleSavedTitle,
    drawModalVisible,
    openDrawModal,
    phase,
    spinSession,
    incompleteConfirmVisible,
    availableGenres,
    drawCandidates,
    watchedCount: watchedTitleIds.size,
    filters,
    enabledServices,
    winnerDuration,
    winnerTrailerUrl,
    isWinnerSaved,
    setKind,
    toggleGenre,
    clearGenres,
    toggleService,
    setHideWatched,
    resetFilters,
    handleClose,
    dismissFromSheet,
    handleDrawPress,
    confirmIncompleteDraw,
    cancelIncompleteDraw,
    handleRouletteDone,
    handleDrawAnother,
    handleWatchWinner,
    handleMarkWinnerWatched,
    handleToggleWinnerSaved,
  };
}
