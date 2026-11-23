import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

import { getDrawGenres } from '@/constants/catalog';
import { useAuth } from '@/contexts/AuthContext';
import { useCatalog, useTitleQuickDetails } from '@/hooks/useCatalog';
import { useDrawHistory } from '@/hooks/useDrawHistory';
import { useMyList } from '@/hooks/useMyList';
import { usePersistedDrawFilters } from '@/hooks/usePersistedDrawFilters';
import { useWatchedProgressIds } from '@/hooks/useSeriesProgress';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import type { DrawAction } from '@/types/drawHistory';
import type { MediaTitle } from '@/types/media';
import {
  buildWatchedTitleIds,
  filterRouletteCandidates,
  filterTitlesByActiveServices,
  isEligibleForDraw,
  parseRouletteDeepLinkPreset,
  pickRouletteWinner,
  resolveLockedFeaturedTitle,
} from '@/utils/roulette';

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
  const { isSaved, toggleSavedTitle, removeFromMyList } = useMyList();
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
    () => filterTitlesByActiveServices(titles, activeServiceSet),
    [activeServiceSet, titles],
  );

  const eligibleTitles = useMemo(
    () => availableTitles.filter(isEligibleForDraw),
    [availableTitles],
  );

  const availableGenres = useMemo(() => getDrawGenres(eligibleTitles), [eligibleTitles]);

  const watchedTitleIds = useMemo(
    () => buildWatchedTitleIds(history, progressTitleIds),
    [history, progressTitleIds],
  );

  const enabledServiceSet = useMemo(() => new Set(enabledServices), [enabledServices]);

  const drawCandidates = useMemo(
    () =>
      filterRouletteCandidates({
        eligibleTitles,
        enabledServiceSet,
        filters,
        watchedTitleIds,
      }),
    [eligibleTitles, enabledServiceSet, filters, watchedTitleIds],
  );

  const [lockedFeatured, setLockedFeatured] = useState<MediaTitle | null>(null);
  const nextLockedFeatured = resolveLockedFeaturedTitle({
    lockedFeatured,
    activeServiceSet,
    eligibleTitles,
    availableTitles,
  });
  if (nextLockedFeatured?.id !== lockedFeatured?.id) {
    setLockedFeatured(nextLockedFeatured);
  }

  const featuredSample = useMemo(() => {
    if (!nextLockedFeatured) return null;
    return availableTitles.find((item) => item.id === nextLockedFeatured.id) ?? nextLockedFeatured;
  }, [availableTitles, nextLockedFeatured]);

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
    const winner = pickRouletteWinner(drawCandidates, lastDrawnId);
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
  const { duration: resolvedWinnerDuration, trailerUrl: winnerTrailerUrl } =
    useTitleQuickDetails(activeWinner);

  useEffect(() => {
    if (!drawNonce || handledDrawNonceRef.current === drawNonce) return;
    handledDrawNonceRef.current = drawNonce;

    const { kind, genres, shouldAutoSpin } = parseRouletteDeepLinkPreset({
      drawKind,
      drawGenre,
      autoSpin,
    });

    const frame = requestAnimationFrame(() => {
      applyPreset({ kind, genres });
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
      if (isSaved(spinSession.winner.id)) {
        removeFromMyList(spinSession.winner.id);
      }
    }
    handleClose();
  }, [commitDrawAction, handleClose, isSaved, removeFromMyList, spinSession]);

  const handleMarkWinnerWatched = useCallback(() => {
    if (!spinSession?.winner) return;
    commitDrawAction(spinSession.winner, 'assistiu');
    if (isSaved(spinSession.winner.id)) {
      removeFromMyList(spinSession.winner.id);
    }
  }, [commitDrawAction, isSaved, removeFromMyList, spinSession]);

  const handleToggleWinnerSaved = useCallback(() => {
    if (!spinSession?.winner) return;
    const nextSaved = !isSaved(spinSession.winner.id);
    toggleSavedTitle(spinSession.winner);
    if (nextSaved) {
      commitDrawAction(spinSession.winner, 'salvou');
    }
  }, [commitDrawAction, isSaved, spinSession, toggleSavedTitle]);

  const winnerDuration = resolvedWinnerDuration ?? '';
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
