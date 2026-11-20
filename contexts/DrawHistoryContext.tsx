import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { MediaTitle, sanitizeHexColor, sanitizeTmdbPath } from '@/constants/catalog';
import { useAuth } from '@/contexts/AuthContext';
import { useForegroundSync } from '@/hooks/useNetworkStatus';
import {
  clearDrawHistory as clearRemoteDrawHistory,
  fetchDrawHistory,
  insertDrawHistoryEntry,
  MAX_HISTORY_ENTRIES,
  updateDrawHistoryAction,
} from '@/services/repositories/drawHistoryRepo';
import { hasSupabaseConfig } from '@/services/supabase';
import { type DrawAction, type DrawHistoryEntry, isDrawHistoryEntry } from '@/types/drawHistory';

export type { DrawAction, DrawHistoryEntry } from '@/types/drawHistory';

const BASE_STORAGE_KEY = '@nextwatch/draw-history';
const PENDING_STORAGE_PREFIX = '@nextwatch/draw-history-pending';
const AUTO_REFRESH_COOLDOWN_MS = 4000;

type RefreshOptions = {
  minIntervalMs?: number;
};

type DrawHistoryContextValue = {
  history: DrawHistoryEntry[];
  storageReady: boolean;
  recordDrawAction: (title: MediaTitle, acao: DrawAction) => Promise<string | null>;
  updateDrawAction: (entryId: string, acao: DrawAction) => Promise<void>;
  clearDrawHistory: () => Promise<void>;
  refreshDrawHistory: (options?: RefreshOptions) => Promise<void>;
};

type HistoryState = {
  key: string | null;
  items: DrawHistoryEntry[];
};

type PendingInsert = {
  localId: string;
  entry: DrawHistoryEntry;
};

const DrawHistoryContext = createContext<DrawHistoryContextValue | null>(null);

function isPendingInsert(value: unknown): value is PendingInsert {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    typeof (value as PendingInsert).localId === 'string' &&
    isDrawHistoryEntry((value as PendingInsert).entry)
  );
}

function parseStoredArray<T>(raw: string | null, guard: (value: unknown) => value is T, limit?: number): T[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid = parsed.filter(guard);
    return limit ? valid.slice(0, limit) : valid;
  } catch {
    return [];
  }
}

function generateLocalEntryId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `local-${globalThis.crypto.randomUUID()}`;
  }
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const bytes = new Uint8Array(8);
    globalThis.crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `local-${hex}`;
  }
  return `local-${Date.now().toString(36)}`;
}

export function DrawHistoryProvider({ children }: PropsWithChildren) {
  const { user, token } = useAuth();
  const userId = user?.id ?? null;
  const hasToken = Boolean(token);
  const storageKey = userId ? `${BASE_STORAGE_KEY}:${userId}` : null;
  const pendingKey = userId ? `${PENDING_STORAGE_PREFIX}:${userId}` : null;

  const [prevStorageKey, setPrevStorageKey] = useState(storageKey);
  const [historyState, setHistoryState] = useState<HistoryState>({ key: null, items: [] });
  const latestHistoryRef = useRef<HistoryState>({ key: null, items: [] });

  if (prevStorageKey !== storageKey) {
    setPrevStorageKey(storageKey);
    setHistoryState({ key: null, items: [] });
  }
  const pendingByKeyRef = useRef<Record<string, PendingInsert[]>>({});
  const lastRemoteSyncAtRef = useRef(0);
  const activeSessionRef = useRef<{
    storageKey: string | null;
    userId: string | null;
    hasToken: boolean;
  }>({ storageKey: null, userId: null, hasToken: false });
  const inFlightSyncRef = useRef<{ key: string; promise: Promise<void> } | null>(null);

  const commitHistoryState = useCallback((next: HistoryState) => {
    latestHistoryRef.current = next;
    setHistoryState(next);
  }, []);

  const syncHistory = useCallback((options?: RefreshOptions): Promise<void> => {
    if (!storageKey || !userId || !pendingKey) {
      return Promise.resolve();
    }

    const sessionToken = token;
    const sessionHasToken = Boolean(sessionToken);
    const syncIdentity = `${storageKey}:${sessionHasToken}`;
    const pendingList = pendingByKeyRef.current[pendingKey] ?? [];

    if (
      options?.minIntervalMs !== undefined &&
      pendingList.length === 0 &&
      latestHistoryRef.current.key === storageKey &&
      Date.now() - lastRemoteSyncAtRef.current < options.minIntervalMs
    ) {
      return Promise.resolve();
    }

    if (inFlightSyncRef.current?.key === syncIdentity) {
      return inFlightSyncRef.current.promise;
    }

    const isSessionCurrent = () =>
      activeSessionRef.current.storageKey === storageKey &&
      activeSessionRef.current.userId === userId &&
      activeSessionRef.current.hasToken === sessionHasToken;

    const promise = (async () => {
      try {
        if (latestHistoryRef.current.key !== storageKey) {
          const [storedRaw, pendingRaw] = await Promise.all([
            AsyncStorage.getItem(storageKey).catch(() => null),
            AsyncStorage.getItem(pendingKey).catch(() => null),
          ]);
          if (!isSessionCurrent()) return;

          const localCached = parseStoredArray(storedRaw, isDrawHistoryEntry, MAX_HISTORY_ENTRIES);
          const storedPending = parseStoredArray(pendingRaw, isPendingInsert);
          const existingPending = pendingByKeyRef.current[pendingKey] ?? [];
          const mergedPending = [...existingPending];
          for (const item of storedPending) {
            if (!mergedPending.some((existing) => existing.localId === item.localId)) {
              mergedPending.push(item);
            }
          }
          pendingByKeyRef.current[pendingKey] = mergedPending;

          const pendingEntries = mergedPending.map((item) => item.entry);
          const initialItems = [
            ...pendingEntries,
            ...localCached.filter((item) => !pendingEntries.some((p) => p.id === item.id)),
          ].slice(0, MAX_HISTORY_ENTRIES);

          commitHistoryState({ key: storageKey, items: initialItems });
        }

        if (!sessionToken || !hasSupabaseConfig()) {
          return;
        }

        const currentPending = [...(pendingByKeyRef.current[pendingKey] ?? [])];
        if (currentPending.length > 0) {
          const remaining: PendingInsert[] = [];
          let stopFlush = false;
          for (const pendingItem of currentPending) {
            if (stopFlush) {
              remaining.push(pendingItem);
              continue;
            }
            if (!isSessionCurrent()) return;
            const latestLocal = latestHistoryRef.current.items.find((item) => item.id === pendingItem.localId);
            const entryToInsert = latestLocal ?? pendingItem.entry;
            const result = await insertDrawHistoryEntry(userId, entryToInsert);
            if (!isSessionCurrent()) return;
            if (result.status === 'retry') {
              remaining.push({ ...pendingItem, entry: entryToInsert });
              stopFlush = true;
            }
          }
          pendingByKeyRef.current[pendingKey] = remaining;
          AsyncStorage.setItem(pendingKey, JSON.stringify(remaining)).catch(() => {});
          if (stopFlush) return;
        }

        const remoteItems = await fetchDrawHistory(userId);
        if (!isSessionCurrent() || remoteItems === null) return;

        lastRemoteSyncAtRef.current = Date.now();
        const unsyncedLocal = (pendingByKeyRef.current[pendingKey] ?? []).map((item) => item.entry);
        const merged = [
          ...unsyncedLocal,
          ...remoteItems.filter((item) => !unsyncedLocal.some((u) => u.id === item.id)),
        ].slice(0, MAX_HISTORY_ENTRIES);

        commitHistoryState({ key: storageKey, items: merged });
        AsyncStorage.setItem(storageKey, JSON.stringify(merged)).catch(() => {});
      } finally {
        if (inFlightSyncRef.current?.key === syncIdentity) {
          inFlightSyncRef.current = null;
        }
      }
    })();

    inFlightSyncRef.current = { key: syncIdentity, promise };
    return promise;
  }, [commitHistoryState, pendingKey, storageKey, token, userId]);

  useEffect(() => {
    const previousKey = activeSessionRef.current.storageKey;
    activeSessionRef.current = { storageKey, userId, hasToken };
    if (previousKey !== storageKey) {
      lastRemoteSyncAtRef.current = 0;
    }

    if (!storageKey || !userId || !pendingKey) {
      latestHistoryRef.current = { key: null, items: [] };
      pendingByKeyRef.current = {};
      return;
    }

    void syncHistory();
  }, [commitHistoryState, hasToken, pendingKey, storageKey, syncHistory, userId]);

  useForegroundSync(Boolean(storageKey && userId && hasToken), syncHistory, AUTO_REFRESH_COOLDOWN_MS);

  const recordDrawAction = useCallback(async (title: MediaTitle, acao: DrawAction): Promise<string | null> => {
    if (!storageKey || !userId || !pendingKey) return null;

    const localId = generateLocalEntryId();
    const newEntry: DrawHistoryEntry = {
      id: localId,
      tmdbId: title.id,
      sorteadoEm: new Date().toISOString(),
      acao,
      title: title.title,
      kind: title.kind,
      tmdbPosterPath: sanitizeTmdbPath(title.tmdbPosterPath),
      color: sanitizeHexColor(title.color),
    };

    const nextItems = [newEntry, ...latestHistoryRef.current.items].slice(0, MAX_HISTORY_ENTRIES);
    commitHistoryState({ key: storageKey, items: nextItems });
    AsyncStorage.setItem(storageKey, JSON.stringify(nextItems)).catch(() => {});

    if (!token || !hasSupabaseConfig()) {
      const nextPending = [{ localId, entry: newEntry }, ...(pendingByKeyRef.current[pendingKey] ?? [])];
      pendingByKeyRef.current[pendingKey] = nextPending;
      AsyncStorage.setItem(pendingKey, JSON.stringify(nextPending)).catch(() => {});
      return localId;
    }

    const result = await insertDrawHistoryEntry(userId, newEntry);
    const sessionMatches =
      activeSessionRef.current.storageKey === storageKey &&
      activeSessionRef.current.userId === userId;

    if (result.status === 'ok') {
      if (sessionMatches) {
        const updated = latestHistoryRef.current.items.map((item) =>
          item.id === localId ? { ...result.saved, acao: item.acao } : item,
        );
        commitHistoryState({ key: storageKey, items: updated });
        AsyncStorage.setItem(storageKey, JSON.stringify(updated)).catch(() => {});

        if (result.saved.id !== localId) {
          const currentLocal = latestHistoryRef.current.items.find((item) => item.id === result.saved.id);
          if (currentLocal && currentLocal.acao !== result.saved.acao) {
            void updateDrawHistoryAction(userId, result.saved.id, currentLocal.acao);
          }
          return result.saved.id;
        }
      }
      return result.saved.id;
    }

    if (result.status === 'retry') {
      const nextPending = [{ localId, entry: newEntry }, ...(pendingByKeyRef.current[pendingKey] ?? [])];
      pendingByKeyRef.current[pendingKey] = nextPending;
      AsyncStorage.setItem(pendingKey, JSON.stringify(nextPending)).catch(() => {});
    }
    return localId;
  }, [commitHistoryState, pendingKey, storageKey, token, userId]);

  const updateDrawAction = useCallback(async (entryId: string, acao: DrawAction): Promise<void> => {
    if (!storageKey || !userId || !pendingKey) return;

    const updated = latestHistoryRef.current.items.map((item) =>
      item.id === entryId ? { ...item, acao } : item,
    );
    commitHistoryState({ key: storageKey, items: updated });
    AsyncStorage.setItem(storageKey, JSON.stringify(updated)).catch(() => {});

    const pendingList = pendingByKeyRef.current[pendingKey] ?? [];
    if (pendingList.some((p) => p.localId === entryId)) {
      const nextPending = pendingList.map((p) =>
        p.localId === entryId ? { ...p, entry: { ...p.entry, acao } } : p,
      );
      pendingByKeyRef.current[pendingKey] = nextPending;
      AsyncStorage.setItem(pendingKey, JSON.stringify(nextPending)).catch(() => {});
    }

    if (entryId.startsWith('local-')) return;

    if (token && hasSupabaseConfig()) {
      await updateDrawHistoryAction(userId, entryId, acao);
    }
  }, [commitHistoryState, pendingKey, storageKey, token, userId]);

  const clearDrawHistory = useCallback(async (): Promise<void> => {
    if (!storageKey || !userId || !pendingKey) return;

    pendingByKeyRef.current[pendingKey] = [];
    commitHistoryState({ key: storageKey, items: [] });
    AsyncStorage.setItem(storageKey, JSON.stringify([])).catch(() => {});
    AsyncStorage.setItem(pendingKey, JSON.stringify([])).catch(() => {});

    if (token && hasSupabaseConfig()) {
      await clearRemoteDrawHistory(userId);
    }
  }, [commitHistoryState, pendingKey, storageKey, token, userId]);

  const refreshDrawHistory = useCallback((options?: RefreshOptions) => {
    return syncHistory(options);
  }, [syncHistory]);

  const storageReady = !storageKey || historyState.key === storageKey;
  const history = useMemo(
    () => (storageKey && historyState.key === storageKey ? historyState.items : []),
    [historyState.items, historyState.key, storageKey],
  );

  const value = useMemo<DrawHistoryContextValue>(() => ({
    history,
    storageReady,
    recordDrawAction,
    updateDrawAction,
    clearDrawHistory,
    refreshDrawHistory,
  }), [clearDrawHistory, history, recordDrawAction, refreshDrawHistory, storageReady, updateDrawAction]);

  return <DrawHistoryContext.Provider value={value}>{children}</DrawHistoryContext.Provider>;
}

export function useDrawHistory() {
  const context = useContext(DrawHistoryContext);
  if (!context) throw new Error('useDrawHistory must be used within DrawHistoryProvider');
  return context;
}
