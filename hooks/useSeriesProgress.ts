import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useForegroundSync } from '@/hooks/useNetworkStatus';
import {
  deleteSeriesProgress,
  fetchAllWatchedProgress,
  fetchSeriesProgress,
  sanitizeProgressObject,
  upsertSeriesProgress,
} from '@/services/repositories/progressRepo';
import { hasSupabaseConfig } from '@/services/supabase';
import {
  mergeWatchedProgress,
  type RemoteProgressEntry,
  type SeriesProgressMap,
} from '@/utils/watchedProgress';

const BASE_STORAGE_KEY = '@nextwatch/series-progress';
const PENDING_SYNC_PREFIX = '@nextwatch/series-progress-pending';
const EMPTY_MAP: SeriesProgressMap = {};

function parseProgressMap(raw: string | null): SeriesProgressMap {
  if (!raw) return EMPTY_MAP;
  try {
    return sanitizeProgressObject(JSON.parse(raw));
  } catch {
    return EMPTY_MAP;
  }
}

export function useSeriesProgress(
  userId: string | null,
  titleId: string,
  token: string | null = null,
) {
  const storageKey = `${BASE_STORAGE_KEY}:${userId ?? 'guest'}:${titleId}`;
  const pendingKey = `${PENDING_SYNC_PREFIX}:${userId ?? 'guest'}:${titleId}`;

  const [state, setState] = useState<{ key: string; map: SeriesProgressMap; ready: boolean }>({
    key: '',
    map: EMPTY_MAP,
    ready: false,
  });

  const latestMapRef = useRef<SeriesProgressMap>(EMPTY_MAP);
  const mutationEpochRef = useRef(0);
  const activeKeyRef = useRef(storageKey);

  useEffect(() => {
    activeKeyRef.current = storageKey;
  }, [storageKey]);

  const syncWithBackend = useCallback(async () => {
    if (!titleId) return;
    const targetKey = storageKey;
    const targetPendingKey = pendingKey;
    const initialEpoch = mutationEpochRef.current;

    const [rawLocal, rawPending] = await Promise.all([
      AsyncStorage.getItem(targetKey).catch(() => null),
      AsyncStorage.getItem(targetPendingKey).catch(() => null),
    ]);

    if (activeKeyRef.current !== targetKey) return;

    const localMap = parseProgressMap(rawLocal);
    if (mutationEpochRef.current === initialEpoch) {
      latestMapRef.current = localMap;
      setState({ key: targetKey, map: localMap, ready: true });
    }

    if (!userId || !token || !hasSupabaseConfig()) {
      return;
    }

    const hasPending = rawPending === '1';
    if (hasPending) {
      const currentMap =
        mutationEpochRef.current === initialEpoch ? localMap : latestMapRef.current;
      const outcome =
        Object.keys(currentMap).length === 0
          ? await deleteSeriesProgress(userId, titleId)
          : await upsertSeriesProgress(userId, titleId, currentMap);

      if (outcome === 'ok' && mutationEpochRef.current === initialEpoch) {
        await AsyncStorage.removeItem(targetPendingKey).catch(() => {});
      }
      return;
    }

    const remote = await fetchSeriesProgress(userId, titleId);
    if (!remote || activeKeyRef.current !== targetKey) return;
    if (mutationEpochRef.current !== initialEpoch) return;

    if (remote.found) {
      latestMapRef.current = remote.map;
      setState({ key: targetKey, map: remote.map, ready: true });
      await AsyncStorage.setItem(targetKey, JSON.stringify(remote.map)).catch(() => {});
    } else if (Object.keys(localMap).length > 0) {
      // Migra progresso salvo apenas localmente antes da sincronização em nuvem.
      await upsertSeriesProgress(userId, titleId, localMap);
    }
  }, [pendingKey, storageKey, titleId, token, userId]);

  useEffect(() => {
    void syncWithBackend();
  }, [syncWithBackend]);

  useForegroundSync(Boolean(userId && titleId && token), syncWithBackend);

  const persistRemote = useCallback(
    async (nextMap: SeriesProgressMap, expectedEpoch: number) => {
      if (!userId || !titleId || !token || !hasSupabaseConfig()) {
        if (userId && titleId) {
          await AsyncStorage.setItem(pendingKey, '1').catch(() => {});
        }
        return;
      }

      await AsyncStorage.setItem(pendingKey, '1').catch(() => {});
      const outcome =
        Object.keys(nextMap).length === 0
          ? await deleteSeriesProgress(userId, titleId)
          : await upsertSeriesProgress(userId, titleId, nextMap);

      if (outcome === 'ok' && mutationEpochRef.current === expectedEpoch) {
        await AsyncStorage.removeItem(pendingKey).catch(() => {});
      }
    },
    [pendingKey, titleId, token, userId],
  );

  const updateMap = useCallback(
    (updater: (prev: SeriesProgressMap) => SeriesProgressMap) => {
      const nextEpoch = ++mutationEpochRef.current;
      const base = state.key === storageKey ? latestMapRef.current : EMPTY_MAP;
      const next = updater(base);
      latestMapRef.current = next;
      setState({ key: storageKey, map: next, ready: true });
      void AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch(() => {});
      void persistRemote(next, nextEpoch);
    },
    [persistRemote, state.key, storageKey],
  );

  const activeMap = state.key === storageKey ? state.map : EMPTY_MAP;

  const isEpisodeWatched = useCallback(
    (seasonNumber: number, episodeNumber: number): boolean => {
      const episodes = activeMap[String(seasonNumber)];
      return episodes ? episodes.includes(episodeNumber) : false;
    },
    [activeMap],
  );

  const getSeasonWatchedCount = useCallback(
    (seasonNumber: number): number => {
      return activeMap[String(seasonNumber)]?.length ?? 0;
    },
    [activeMap],
  );

  const isSeasonCompleted = useCallback(
    (seasonNumber: number, episodeCount: number): boolean => {
      if (episodeCount <= 0) return false;
      return (activeMap[String(seasonNumber)]?.length ?? 0) >= episodeCount;
    },
    [activeMap],
  );

  const toggleEpisode = useCallback(
    (seasonNumber: number, episodeNumber: number) => {
      const key = String(seasonNumber);
      updateMap((prev) => {
        const current = prev[key] ?? [];
        const exists = current.includes(episodeNumber);
        const nextEpisodes = exists
          ? current.filter((ep) => ep !== episodeNumber)
          : [...current, episodeNumber].sort((a, b) => a - b);

        if (nextEpisodes.length === 0) {
          const rest = { ...prev };
          delete rest[key];
          return rest;
        }
        return { ...prev, [key]: nextEpisodes };
      });
    },
    [updateMap],
  );

  const toggleSeason = useCallback(
    (seasonNumber: number, episodeCount: number, episodeNumbers?: number[]) => {
      const key = String(seasonNumber);
      const targetNumbers =
        episodeNumbers && episodeNumbers.length > 0
          ? Array.from(new Set(episodeNumbers)).sort((a, b) => a - b)
          : Array.from({ length: Math.max(0, episodeCount) }, (_, idx) => idx + 1);

      if (targetNumbers.length === 0) return;

      updateMap((prev) => {
        const current = prev[key] ?? [];
        const allWatched = targetNumbers.every((num) => current.includes(num));
        if (allWatched) {
          const rest = { ...prev };
          delete rest[key];
          return rest;
        }
        return { ...prev, [key]: targetNumbers };
      });
    },
    [updateMap],
  );

  const totalWatchedEpisodes = useMemo(() => {
    let total = 0;
    for (const episodes of Object.values(activeMap)) {
      total += episodes.length;
    }
    return total;
  }, [activeMap]);

  return {
    ready: state.key === storageKey && state.ready,
    isEpisodeWatched,
    getSeasonWatchedCount,
    isSeasonCompleted,
    toggleEpisode,
    toggleSeason,
    totalWatchedEpisodes,
  };
}

const EMPTY_BY_TITLE: Record<string, SeriesProgressMap> = {};

/** Lista IDs e mapas de progresso de obras com registros marcados (local + nuvem). */
export function useWatchedProgressIds(userId: string | null, token: string | null) {
  const scope = userId ?? 'guest';
  const localPrefix = `${BASE_STORAGE_KEY}:${scope}:`;
  const pendingPrefix = `${PENDING_SYNC_PREFIX}:${scope}:`;
  const requestIdRef = useRef(0);
  const [state, setState] = useState<{
    scope: string;
    ids: string[];
    byTitleId: Record<string, SeriesProgressMap>;
    ready: boolean;
  }>({ scope, ids: [], byTitleId: EMPTY_BY_TITLE, ready: false });

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    const localById: Record<string, SeriesProgressMap> = {};
    const pendingIds = new Set<string>();

    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const relevantKeys = allKeys.filter(
        (k) => k.startsWith(localPrefix) || k.startsWith(pendingPrefix),
      );
      if (relevantKeys.length > 0) {
        const entries = await AsyncStorage.multiGet(relevantKeys);
        for (const [key, raw] of entries) {
          if (key.startsWith(pendingPrefix)) {
            if (raw === '1') {
              pendingIds.add(key.slice(pendingPrefix.length));
            }
          } else if (key.startsWith(localPrefix)) {
            localById[key.slice(localPrefix.length)] = parseProgressMap(raw);
          }
        }
      }
    } catch {
      // ignora erro de leitura local
    }

    if (requestIdRef.current !== requestId) return;

    const canFetchRemote = Boolean(userId && token && hasSupabaseConfig());
    if (canFetchRemote) {
      const localOnly = mergeWatchedProgress(localById, [], pendingIds);
      if (localOnly.ids.length > 0) {
        setState((prev) => ({
          scope,
          ids: localOnly.ids,
          byTitleId: localOnly.byTitleId,
          ready: prev.scope === scope ? prev.ready : false,
        }));
      }
    }

    let remoteRows: RemoteProgressEntry[] = [];
    if (canFetchRemote && userId) {
      const fetched = await fetchAllWatchedProgress(userId);
      if (fetched) {
        remoteRows = fetched;
      }
    }

    if (requestIdRef.current !== requestId) return;

    const merged = mergeWatchedProgress(localById, remoteRows, pendingIds);
    setState({ scope, ids: merged.ids, byTitleId: merged.byTitleId, ready: true });
  }, [localPrefix, pendingPrefix, scope, token, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useForegroundSync(Boolean(userId && token), refresh);

  const ids = useMemo(
    () => (state.scope === scope ? state.ids : []),
    [scope, state.ids, state.scope],
  );
  const byTitleId = useMemo(
    () => (state.scope === scope ? state.byTitleId : EMPTY_BY_TITLE),
    [scope, state.byTitleId, state.scope],
  );
  const ready = state.scope === scope && state.ready;

  return {
    progressTitleIds: ids,
    progressByTitleId: byTitleId,
    progressReady: ready,
    refreshProgressIds: refresh,
  };
}
