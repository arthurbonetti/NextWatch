import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { MediaKind, MediaTitle, sanitizeHexColor, sanitizeTmdbPath } from '@/constants/catalog';
import { useAuth } from '@/contexts/AuthContext';
import { useForegroundSync } from '@/hooks/useNetworkStatus';
import {
  classifySupabaseOutcome,
  hasSupabaseConfig,
  supabaseRestFetch,
  type SupabaseOutcome,
} from '@/services/authApi';

const BASE_STORAGE_KEY = '@nextwatch/draw-history';
const PENDING_STORAGE_PREFIX = '@nextwatch/draw-history-pending';
const SYNC_TIMEOUT_MS = 8000;
const MAX_HISTORY_ENTRIES = 100;
const AUTO_REFRESH_COOLDOWN_MS = 4000;

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
    tmdbPosterPath: sanitizeTmdbPath(row.tmdb_poster_path),
    color: sanitizeHexColor(row.color),
  };
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

async function remoteFetchHistory(
  userId: string,
  token: string,
): Promise<DrawHistoryEntry[] | null> {
  try {
    const response = await supabaseRestFetch(
      `/rest/v1/user_draw_history?user_id=eq.${encodeURIComponent(userId)}&order=sorteado_em.desc&limit=${MAX_HISTORY_ENTRIES}&select=id,user_id,tmdb_id,sorteado_em,acao,title,kind,tmdb_poster_path,color`,
      {},
      token,
      SYNC_TIMEOUT_MS,
    );
    if (!response || !response.ok) return null;
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) return null;
    return (rows as DbDrawHistoryRow[])
      .map(mapDbRowToEntry)
      .filter((entry): entry is DrawHistoryEntry => entry !== null);
  } catch {
    return null;
  }
}

async function remoteInsertEntry(
  userId: string,
  entry: DrawHistoryEntry,
  token: string,
): Promise<{ status: 'ok'; saved: DrawHistoryEntry } | { status: Exclude<SupabaseOutcome, 'ok'> }> {
  try {
    const response = await supabaseRestFetch(
      '/rest/v1/user_draw_history',
      {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          user_id: userId,
          tmdb_id: entry.tmdbId.slice(0, 128),
          sorteado_em: entry.sorteadoEm,
          acao: entry.acao,
          title: entry.title ? entry.title.slice(0, 500) : null,
          kind: entry.kind ?? null,
          tmdb_poster_path: sanitizeTmdbPath(entry.tmdbPosterPath),
          color: sanitizeHexColor(entry.color) ?? null,
        }),
      },
      token,
      SYNC_TIMEOUT_MS,
    );
    if (!response) return { status: 'retry' };
    const outcome = classifySupabaseOutcome(response);
    if (outcome !== 'ok') return { status: outcome };

    const payload: unknown = await response.json();
    const mapped = Array.isArray(payload) && payload.length > 0
      ? mapDbRowToEntry(payload[0] as DbDrawHistoryRow)
      : null;
    return { status: 'ok', saved: mapped ?? entry };
  } catch {
    return { status: 'retry' };
  }
}

async function remoteRequestOk(
  pathWithQuery: string,
  token: string,
  method: 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<boolean> {
  try {
    const response = await supabaseRestFetch(
      pathWithQuery,
      {
        method,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      },
      token,
      SYNC_TIMEOUT_MS,
    );
    return Boolean(response?.ok);
  } catch {
    return false;
  }
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
            const result = await remoteInsertEntry(userId, entryToInsert, sessionToken);
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

        const remoteItems = await remoteFetchHistory(userId, sessionToken);
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

    const result = await remoteInsertEntry(userId, newEntry, token);
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
            void remoteRequestOk(
              `/rest/v1/user_draw_history?id=eq.${encodeURIComponent(result.saved.id)}&user_id=eq.${encodeURIComponent(userId)}`,
              token,
              'PATCH',
              { acao: currentLocal.acao },
            );
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
      await remoteRequestOk(
        `/rest/v1/user_draw_history?id=eq.${encodeURIComponent(entryId)}&user_id=eq.${encodeURIComponent(userId)}`,
        token,
        'PATCH',
        { acao },
      );
    }
  }, [commitHistoryState, pendingKey, storageKey, token, userId]);

  const clearDrawHistory = useCallback(async (): Promise<void> => {
    if (!storageKey || !userId || !pendingKey) return;

    pendingByKeyRef.current[pendingKey] = [];
    commitHistoryState({ key: storageKey, items: [] });
    AsyncStorage.setItem(storageKey, JSON.stringify([])).catch(() => {});
    AsyncStorage.setItem(pendingKey, JSON.stringify([])).catch(() => {});

    if (token && hasSupabaseConfig()) {
      await remoteRequestOk(
        `/rest/v1/user_draw_history?user_id=eq.${encodeURIComponent(userId)}`,
        token,
        'DELETE',
      );
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
