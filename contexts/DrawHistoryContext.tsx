import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { MediaKind, MediaTitle } from '@/constants/catalog';
import { useAuth } from '@/contexts/AuthContext';
import { buildSupabaseHeaders, getSupabaseUrl, hasSupabaseConfig } from '@/services/authApi';

const BASE_STORAGE_KEY = '@nextwatch/draw-history';
const PENDING_STORAGE_PREFIX = '@nextwatch/draw-history-pending';
const SYNC_TIMEOUT_MS = 8000;
const MAX_HISTORY_ENTRIES = 100;
const AUTO_REFRESH_COOLDOWN_MS = 4000;
const SAFE_HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;
const SAFE_TMDB_PATH_REGEX = /^\/[a-zA-Z0-9._-]{1,120}$/;

export type DrawAction = 'assistiu' | 'salvou' | 'sorteou outro' | 'ignorou';

export type DrawHistoryEntry = {
  id: string;
  tmdbId: string;
  sorteadoEm: string;
  acao: DrawAction;
  title?: string;
  kind?: MediaKind;
  tmdbPosterPath?: string | null;
  color?: string;
};

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

type DbDrawHistoryRow = {
  id: number | string;
  user_id: string;
  tmdb_id: string;
  sorteado_em: string;
  acao: string;
  title: string | null;
  kind: string | null;
  tmdb_poster_path: string | null;
  color: string | null;
};

type PendingInsert = {
  localId: string;
  entry: DrawHistoryEntry;
};

const VALID_ACTIONS = new Set<DrawAction>(['assistiu', 'salvou', 'sorteou outro', 'ignorou']);
const VALID_KINDS = new Set<MediaKind>(['Filme', 'Série', 'Anime']);

const DrawHistoryContext = createContext<DrawHistoryContextValue | null>(null);

function isDrawAction(value: unknown): value is DrawAction {
  return typeof value === 'string' && VALID_ACTIONS.has(value as DrawAction);
}

function sanitizePosterPath(path: unknown): string | null {
  if (typeof path !== 'string') return null;
  return SAFE_TMDB_PATH_REGEX.test(path) ? path : null;
}

function sanitizeColor(color: unknown): string | undefined {
  if (typeof color !== 'string') return undefined;
  return SAFE_HEX_COLOR_REGEX.test(color) ? color : undefined;
}

function isDrawHistoryEntry(value: unknown): value is DrawHistoryEntry {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<DrawHistoryEntry>;
  return (
    typeof item.id === 'string' &&
    item.id.length > 0 &&
    typeof item.tmdbId === 'string' &&
    item.tmdbId.length > 0 &&
    item.tmdbId.length <= 128 &&
    typeof item.sorteadoEm === 'string' &&
    item.sorteadoEm.length > 0 &&
    isDrawAction(item.acao)
  );
}

function parseStoredHistory(raw: string | null): DrawHistoryEntry[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isDrawHistoryEntry).slice(0, MAX_HISTORY_ENTRIES) : [];
  } catch {
    return [];
  }
}

function parsePendingInserts(raw: string | null): PendingInsert[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is PendingInsert =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as PendingInsert).localId === 'string' &&
        isDrawHistoryEntry((item as PendingInsert).entry),
    );
  } catch {
    return [];
  }
}

function mapDbRowToEntry(row: DbDrawHistoryRow): DrawHistoryEntry | null {
  if (!isDrawAction(row.acao) || typeof row.tmdb_id !== 'string' || !row.tmdb_id) return null;
  const kind = typeof row.kind === 'string' && VALID_KINDS.has(row.kind as MediaKind)
    ? (row.kind as MediaKind)
    : undefined;
  return {
    id: String(row.id),
    tmdbId: row.tmdb_id,
    sorteadoEm: typeof row.sorteado_em === 'string' ? row.sorteado_em : new Date().toISOString(),
    acao: row.acao,
    title: typeof row.title === 'string' && row.title.trim() ? row.title : undefined,
    kind,
    tmdbPosterPath: sanitizePosterPath(row.tmdb_poster_path),
    color: sanitizeColor(row.color),
  };
}

function generateLocalEntryId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `local-${globalThis.crypto.randomUUID()}`;
  }
  return `local-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

async function remoteFetchHistory(
  baseUrl: string,
  token: string,
  userId: string,
): Promise<DrawHistoryEntry[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);
  try {
    const response = await fetch(
      `${baseUrl}/rest/v1/user_draw_history?user_id=eq.${encodeURIComponent(userId)}&order=sorteado_em.desc&limit=${MAX_HISTORY_ENTRIES}&select=id,user_id,tmdb_id,sorteado_em,acao,title,kind,tmdb_poster_path,color`,
      {
        headers: buildSupabaseHeaders(token),
        signal: controller.signal,
      },
    );
    if (!response.ok) return null;
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) return null;
    return (rows as DbDrawHistoryRow[])
      .map(mapDbRowToEntry)
      .filter((entry): entry is DrawHistoryEntry => entry !== null);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function remoteInsertEntry(
  baseUrl: string,
  token: string,
  userId: string,
  entry: DrawHistoryEntry,
): Promise<{ status: 'ok'; saved: DrawHistoryEntry } | { status: 'drop' } | { status: 'retry' }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl}/rest/v1/user_draw_history`, {
      method: 'POST',
      headers: {
        ...buildSupabaseHeaders(token),
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        user_id: userId,
        tmdb_id: entry.tmdbId.slice(0, 128),
        sorteado_em: entry.sorteadoEm,
        acao: entry.acao,
        title: entry.title ? entry.title.slice(0, 500) : null,
        kind: entry.kind ?? null,
        tmdb_poster_path: sanitizePosterPath(entry.tmdbPosterPath),
        color: sanitizeColor(entry.color) ?? null,
      }),
      signal: controller.signal,
    });
    if (response.ok) {
      const payload: unknown = await response.json();
      if (Array.isArray(payload) && payload.length > 0) {
        const mapped = mapDbRowToEntry(payload[0] as DbDrawHistoryRow);
        if (mapped) return { status: 'ok', saved: mapped };
      }
      return { status: 'ok', saved: entry };
    }
    if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) {
      return { status: 'drop' };
    }
    return { status: 'retry' };
  } catch {
    return { status: 'retry' };
  } finally {
    clearTimeout(timer);
  }
}

async function remoteUpdateEntryAction(
  baseUrl: string,
  token: string,
  userId: string,
  entryId: string,
  acao: DrawAction,
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);
  try {
    const response = await fetch(
      `${baseUrl}/rest/v1/user_draw_history?id=eq.${encodeURIComponent(entryId)}&user_id=eq.${encodeURIComponent(userId)}`,
      {
        method: 'PATCH',
        headers: buildSupabaseHeaders(token),
        body: JSON.stringify({ acao }),
        signal: controller.signal,
      },
    );
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function remoteClearHistory(
  baseUrl: string,
  token: string,
  userId: string,
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);
  try {
    const response = await fetch(
      `${baseUrl}/rest/v1/user_draw_history?user_id=eq.${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
        headers: buildSupabaseHeaders(token),
        signal: controller.signal,
      },
    );
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function DrawHistoryProvider({ children }: PropsWithChildren) {
  const { user, token } = useAuth();
  const userId = user?.id ?? null;
  const storageKey = userId ? `${BASE_STORAGE_KEY}:${userId}` : null;
  const pendingKey = userId ? `${PENDING_STORAGE_PREFIX}:${userId}` : null;

  const [historyState, setHistoryState] = useState<HistoryState>({ key: null, items: [] });
  const latestHistoryRef = useRef<HistoryState>({ key: null, items: [] });
  const pendingByKeyRef = useRef<Record<string, PendingInsert[]>>({});
  const lastRemoteSyncAtRef = useRef(0);
  const activeSessionRef = useRef<{
    storageKey: string | null;
    userId: string | null;
    token: string | null;
  }>({ storageKey: null, userId: null, token: null });
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
    const syncIdentity = `${storageKey}:${sessionToken ?? ''}`;
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
      activeSessionRef.current.token === sessionToken;

    const promise = (async () => {
      try {
        if (latestHistoryRef.current.key !== storageKey) {
          const [storedRaw, pendingRaw] = await Promise.all([
            AsyncStorage.getItem(storageKey).catch(() => null),
            AsyncStorage.getItem(pendingKey).catch(() => null),
          ]);
          if (!isSessionCurrent()) return;

          const localCached = parseStoredHistory(storedRaw);
          const storedPending = parsePendingInserts(pendingRaw);
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

        const baseUrl = getSupabaseUrl();
        if (!baseUrl || !sessionToken || !hasSupabaseConfig()) {
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
            const result = await remoteInsertEntry(baseUrl, sessionToken, userId, entryToInsert);
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

        const remoteItems = await remoteFetchHistory(baseUrl, sessionToken, userId);
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
    activeSessionRef.current = { storageKey, userId, token };
    lastRemoteSyncAtRef.current = 0;

    if (!storageKey || !userId || !pendingKey) {
      commitHistoryState({ key: null, items: [] });
      return;
    }

    void syncHistory();
  }, [commitHistoryState, pendingKey, storageKey, syncHistory, token, userId]);

  useEffect(() => {
    if (!storageKey || !userId) return;

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void syncHistory({ minIntervalMs: AUTO_REFRESH_COOLDOWN_MS });
      }
    });

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleFocus = () => {
        void syncHistory({ minIntervalMs: AUTO_REFRESH_COOLDOWN_MS });
      };
      window.addEventListener('focus', handleFocus);
      return () => {
        appStateSub.remove();
        window.removeEventListener('focus', handleFocus);
      };
    }

    return () => {
      appStateSub.remove();
    };
  }, [storageKey, syncHistory, userId]);

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
      tmdbPosterPath: sanitizePosterPath(title.tmdbPosterPath),
      color: sanitizeColor(title.color),
    };

    const nextItems = [newEntry, ...latestHistoryRef.current.items].slice(0, MAX_HISTORY_ENTRIES);
    commitHistoryState({ key: storageKey, items: nextItems });
    AsyncStorage.setItem(storageKey, JSON.stringify(nextItems)).catch(() => {});

    const baseUrl = getSupabaseUrl();
    if (!baseUrl || !token || !hasSupabaseConfig()) {
      const nextPending = [{ localId, entry: newEntry }, ...(pendingByKeyRef.current[pendingKey] ?? [])];
      pendingByKeyRef.current[pendingKey] = nextPending;
      AsyncStorage.setItem(pendingKey, JSON.stringify(nextPending)).catch(() => {});
      return localId;
    }

    const result = await remoteInsertEntry(baseUrl, token, userId, newEntry);
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
            void remoteUpdateEntryAction(baseUrl, token, userId, result.saved.id, currentLocal.acao);
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

    const baseUrl = getSupabaseUrl();
    if (baseUrl && token && hasSupabaseConfig()) {
      await remoteUpdateEntryAction(baseUrl, token, userId, entryId, acao);
    }
  }, [commitHistoryState, pendingKey, storageKey, token, userId]);

  const clearDrawHistory = useCallback(async (): Promise<void> => {
    if (!storageKey || !userId || !pendingKey) return;

    pendingByKeyRef.current[pendingKey] = [];
    commitHistoryState({ key: storageKey, items: [] });
    AsyncStorage.setItem(storageKey, JSON.stringify([])).catch(() => {});
    AsyncStorage.setItem(pendingKey, JSON.stringify([])).catch(() => {});

    const baseUrl = getSupabaseUrl();
    if (baseUrl && token && hasSupabaseConfig()) {
      await remoteClearHistory(baseUrl, token, userId);
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
