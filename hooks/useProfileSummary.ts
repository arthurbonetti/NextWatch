import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { useCatalog } from '@/hooks/useCatalog';
import { useDrawHistory } from '@/hooks/useDrawHistory';
import { useMyList } from '@/hooks/useMyList';
import { useProfile } from '@/hooks/useProfile';
import { useWatchedProgressIds } from '@/hooks/useSeriesProgress';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import type { MediaTitle } from '@/types/media';
import { buildWatchedTitleIdsOrdered, computeMyListsCounts } from '@/utils/watchedProgress';

const DEFAULT_PREVIEW_HISTORY_LIMIT = 3;
const MIN_MANUAL_REFRESH_DURATION_MS = 650;
const FOCUS_REFRESH_MIN_INTERVAL_MS = 3000;

type UseProfileSummaryOptions = {
  previewHistoryLimit?: number;
};

/**
 * Agrega contadores, status do catálogo e prévia do histórico exibidos na tela de Perfil,
 * centralizando o estado derivado de assinaturas, listas, progresso e sorteios.
 */
export function useProfileSummary(options?: UseProfileSummaryOptions) {
  const previewHistoryLimit = options?.previewHistoryLimit ?? DEFAULT_PREVIEW_HISTORY_LIMIT;

  const { user, token } = useAuth();
  const { profile, refreshProfile } = useProfile();
  const { subscriptions } = useSubscriptions();
  const { savedTitles, findSavedTitle, refreshMyList } = useMyList();
  const { history, refreshDrawHistory } = useDrawHistory();
  const { progressTitleIds, refreshProgressIds } = useWatchedProgressIds(user?.id ?? null, token);
  const { titles, status, isFetchingCatalog, errorMessage, findTitle, refreshCatalog } = useCatalog();

  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  const isRefreshingCatalog = status === 'loading' || isFetchingCatalog || isManualRefreshing;

  const handleRefreshCatalog = useCallback(async () => {
    if (isRefreshingCatalog) return;
    setIsManualRefreshing(true);
    const startedAt = Date.now();
    try {
      await refreshCatalog();
    } finally {
      const remaining = Math.max(0, MIN_MANUAL_REFRESH_DURATION_MS - (Date.now() - startedAt));
      if (remaining === 0) {
        setIsManualRefreshing(false);
      } else {
        refreshTimerRef.current = setTimeout(() => {
          refreshTimerRef.current = null;
          setIsManualRefreshing(false);
        }, remaining);
      }
    }
  }, [isRefreshingCatalog, refreshCatalog]);

  const refreshSummary = useCallback(() => {
    void refreshProfile();
    void refreshMyList({ minIntervalMs: FOCUS_REFRESH_MIN_INTERVAL_MS });
    void refreshDrawHistory({ minIntervalMs: FOCUS_REFRESH_MIN_INTERVAL_MS });
    void refreshProgressIds();
  }, [refreshDrawHistory, refreshMyList, refreshProfile, refreshProgressIds]);

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
    () => history.slice(0, previewHistoryLimit),
    [history, previewHistoryLimit],
  );

  const resolveHistoryTitle = useCallback(
    (tmdbId: string): MediaTitle | undefined => findTitle(tmdbId) ?? findSavedTitle(tmdbId),
    [findSavedTitle, findTitle],
  );

  return {
    profile,
    activeSubscriptionsCount: activeSubscriptions.length,
    monthlyTotal,
    watchedCount,
    myListsCount,
    historyCount: history.length,
    previewHistory,
    resolveHistoryTitle,
    catalogCount: titles.length,
    catalogStatus: status,
    catalogErrorMessage: errorMessage,
    isRefreshingCatalog,
    handleRefreshCatalog,
    refreshSummary,
  };
}
