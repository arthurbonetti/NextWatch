import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { sanitizeHexColor, sanitizeTmdbPath } from '@/constants/catalog';
import { useAuth } from '@/contexts/AuthContext';
import { queryKeys } from '@/services/queryKeys';
import {
  clearDrawHistory as clearRemoteDrawHistory,
  fetchDrawHistory,
  insertDrawHistoryEntry,
  MAX_HISTORY_ENTRIES,
  updateDrawHistoryAction,
} from '@/services/repositories/drawHistoryRepo';
import { hasSupabaseConfig } from '@/services/supabase';
import type { RefreshOptions } from '@/types/common';
import { type DrawAction, type DrawHistoryEntry, isDrawHistoryEntry } from '@/types/drawHistory';
import type { MediaTitle } from '@/types/media';

export type { DrawAction, DrawHistoryEntry } from '@/types/drawHistory';

const BASE_STORAGE_KEY = '@nextwatch/draw-history';
const PENDING_STORAGE_PREFIX = '@nextwatch/draw-history-pending';
const EMPTY_HISTORY: DrawHistoryEntry[] = [];

type PendingInsert = {
  localId: string;
  entry: DrawHistoryEntry;
};

function isPendingInsert(value: unknown): value is PendingInsert {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    typeof (value as PendingInsert).localId === 'string' &&
    isDrawHistoryEntry((value as PendingInsert).entry)
  );
}

function parseStoredArray<T>(
  raw: string | null,
  guard: (value: unknown) => value is T,
  limit?: number,
): T[] {
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

async function readPendingInserts(pendingKey: string): Promise<PendingInsert[]> {
  const raw = await AsyncStorage.getItem(pendingKey).catch(() => null);
  return parseStoredArray(raw, isPendingInsert);
}

async function appendPendingInsert(pendingKey: string, item: PendingInsert): Promise<void> {
  const current = await readPendingInserts(pendingKey);
  const next = [item, ...current.filter((existing) => existing.localId !== item.localId)];
  await AsyncStorage.setItem(pendingKey, JSON.stringify(next)).catch(() => {});
}

export function useDrawHistory() {
  const { user, token } = useAuth();
  const userId = user?.id ?? null;
  const hasToken = Boolean(token);
  const storageKey = userId ? `${BASE_STORAGE_KEY}:${userId}` : null;
  const pendingKey = userId ? `${PENDING_STORAGE_PREFIX}:${userId}` : null;

  const queryClient = useQueryClient();
  const queryKey = useMemo(() => queryKeys.drawHistory(userId), [userId]);

  const { data, isLoading } = useQuery<DrawHistoryEntry[]>({
    queryKey,
    enabled: Boolean(userId),
    staleTime: 30_000,
    queryFn: async ({ signal }) => {
      if (!userId || !storageKey || !pendingKey) return EMPTY_HISTORY;

      const [storedRaw, pendingRaw] = await Promise.all([
        AsyncStorage.getItem(storageKey).catch(() => null),
        AsyncStorage.getItem(pendingKey).catch(() => null),
      ]);

      const localCached = parseStoredArray(storedRaw, isDrawHistoryEntry, MAX_HISTORY_ENTRIES);
      const pendingList = parseStoredArray(pendingRaw, isPendingInsert);
      const pendingEntries = pendingList.map((item) => item.entry);
      const initialItems = [
        ...pendingEntries,
        ...localCached.filter((item) => !pendingEntries.some((pending) => pending.id === item.id)),
      ].slice(0, MAX_HISTORY_ENTRIES);

      if (!hasToken || !hasSupabaseConfig()) {
        return initialItems;
      }

      if (pendingList.length > 0) {
        const remaining: PendingInsert[] = [];
        let stopFlush = false;
        for (const pendingItem of pendingList) {
          if (stopFlush) {
            remaining.push(pendingItem);
            continue;
          }
          if (signal.aborted) return initialItems;
          const latestLocal = localCached.find((item) => item.id === pendingItem.localId);
          const entryToInsert = latestLocal ?? pendingItem.entry;
          const result = await insertDrawHistoryEntry(userId, entryToInsert);
          if (signal.aborted) return initialItems;
          if (result.status === 'retry') {
            remaining.push({ ...pendingItem, entry: entryToInsert });
            stopFlush = true;
          }
        }
        AsyncStorage.setItem(pendingKey, JSON.stringify(remaining)).catch(() => {});
        if (stopFlush) return initialItems;
      }

      const remoteItems = await fetchDrawHistory(userId);
      if (signal.aborted || remoteItems === null) return initialItems;

      const remainingPending = await readPendingInserts(pendingKey);
      const unsyncedLocal = remainingPending.map((item) => item.entry);
      const merged = [
        ...unsyncedLocal,
        ...remoteItems.filter((item) => !unsyncedLocal.some((u) => u.id === item.id)),
      ].slice(0, MAX_HISTORY_ENTRIES);

      AsyncStorage.setItem(storageKey, JSON.stringify(merged)).catch(() => {});
      return merged;
    },
  });

  const { mutateAsync: recordMutateAsync } = useMutation<
    string,
    Error,
    DrawHistoryEntry,
    { previous: DrawHistoryEntry[] | undefined }
  >({
    mutationFn: async (newEntry) => {
      if (!userId || !storageKey || !pendingKey) {
        throw new Error('Sessão indisponível para registrar sorteio.');
      }

      if (!hasToken || !hasSupabaseConfig()) {
        await appendPendingInsert(pendingKey, { localId: newEntry.id, entry: newEntry });
        return newEntry.id;
      }

      const result = await insertDrawHistoryEntry(userId, newEntry);
      if (result.status === 'ok') {
        const current = queryClient.getQueryData<DrawHistoryEntry[]>(queryKey) ?? [];
        const matchedLocal = current.find((item) => item.id === newEntry.id);
        const resolvedAction = matchedLocal?.acao ?? newEntry.acao;
        const updated = current.map((item) =>
          item.id === newEntry.id ? { ...result.saved, acao: resolvedAction } : item,
        );
        queryClient.setQueryData<DrawHistoryEntry[]>(queryKey, updated);
        AsyncStorage.setItem(storageKey, JSON.stringify(updated)).catch(() => {});

        if (result.saved.id !== newEntry.id && resolvedAction !== result.saved.acao) {
          void updateDrawHistoryAction(userId, result.saved.id, resolvedAction);
        }
        return result.saved.id;
      }

      if (result.status === 'retry') {
        const current = queryClient.getQueryData<DrawHistoryEntry[]>(queryKey) ?? [];
        const latestLocal = current.find((item) => item.id === newEntry.id) ?? newEntry;
        await appendPendingInsert(pendingKey, { localId: newEntry.id, entry: latestLocal });
        return newEntry.id;
      }

      throw new Error('Não foi possível registrar o sorteio.');
    },
    onMutate: async (newEntry) => {
      if (!userId || !storageKey) return { previous: undefined };
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<DrawHistoryEntry[]>(queryKey);
      const next = [newEntry, ...(previous ?? [])].slice(0, MAX_HISTORY_ENTRIES);
      queryClient.setQueryData<DrawHistoryEntry[]>(queryKey, next);
      AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch(() => {});
      return { previous };
    },
    onError: (_error, _newEntry, context) => {
      if (storageKey && context?.previous !== undefined) {
        queryClient.setQueryData<DrawHistoryEntry[]>(queryKey, context.previous);
        AsyncStorage.setItem(storageKey, JSON.stringify(context.previous)).catch(() => {});
      }
    },
  });

  const { mutateAsync: updateMutateAsync } = useMutation<
    void,
    Error,
    { entryId: string; acao: DrawAction },
    { previous: DrawHistoryEntry[] | undefined }
  >({
    mutationFn: async ({ entryId, acao }) => {
      if (!userId || entryId.startsWith('local-') || !hasToken || !hasSupabaseConfig()) {
        return;
      }
      await updateDrawHistoryAction(userId, entryId, acao);
    },
    onMutate: async ({ entryId, acao }) => {
      if (!userId || !storageKey || !pendingKey) return { previous: undefined };
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<DrawHistoryEntry[]>(queryKey);
      const next = (previous ?? []).map((item) => (item.id === entryId ? { ...item, acao } : item));
      queryClient.setQueryData<DrawHistoryEntry[]>(queryKey, next);
      AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch(() => {});

      const pendingList = await readPendingInserts(pendingKey);
      if (pendingList.some((p) => p.localId === entryId)) {
        const nextPending = pendingList.map((p) =>
          p.localId === entryId ? { ...p, entry: { ...p.entry, acao } } : p,
        );
        AsyncStorage.setItem(pendingKey, JSON.stringify(nextPending)).catch(() => {});
      }

      return { previous };
    },
  });

  const { mutateAsync: clearMutateAsync } = useMutation<
    void,
    Error,
    void,
    { previous: DrawHistoryEntry[] | undefined; previousPending: PendingInsert[] }
  >({
    mutationFn: async () => {
      if (!userId || !hasToken || !hasSupabaseConfig()) return;
      const ok = await clearRemoteDrawHistory(userId);
      if (!ok) {
        throw new Error('Não foi possível limpar o histórico de sorteios.');
      }
    },
    onMutate: async () => {
      if (!userId || !storageKey || !pendingKey) {
        return { previous: undefined, previousPending: [] };
      }
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<DrawHistoryEntry[]>(queryKey);
      const previousPending = await readPendingInserts(pendingKey);
      queryClient.setQueryData<DrawHistoryEntry[]>(queryKey, []);
      AsyncStorage.setItem(storageKey, JSON.stringify([])).catch(() => {});
      AsyncStorage.setItem(pendingKey, JSON.stringify([])).catch(() => {});
      return { previous, previousPending };
    },
    onError: (_error, _vars, context) => {
      if (storageKey && context?.previous !== undefined) {
        queryClient.setQueryData<DrawHistoryEntry[]>(queryKey, context.previous);
        AsyncStorage.setItem(storageKey, JSON.stringify(context.previous)).catch(() => {});
      }
      if (pendingKey && context?.previousPending) {
        AsyncStorage.setItem(pendingKey, JSON.stringify(context.previousPending)).catch(() => {});
      }
    },
    onSettled: (_data, error) => {
      if (!error && userId && hasToken) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });

  const recordDrawAction = useCallback(
    async (title: MediaTitle, acao: DrawAction): Promise<string | null> => {
      if (!userId) return null;
      const newEntry: DrawHistoryEntry = {
        id: generateLocalEntryId(),
        tmdbId: title.id,
        sorteadoEm: new Date().toISOString(),
        acao,
        title: title.title,
        kind: title.kind,
        tmdbPosterPath: sanitizeTmdbPath(title.tmdbPosterPath),
        color: sanitizeHexColor(title.color),
      };
      try {
        return await recordMutateAsync(newEntry);
      } catch {
        return null;
      }
    },
    [recordMutateAsync, userId],
  );

  const updateDrawAction = useCallback(
    async (entryId: string, acao: DrawAction): Promise<void> => {
      if (!userId) return;
      try {
        await updateMutateAsync({ entryId, acao });
      } catch {
        // Ignora erro mantendo estado local
      }
    },
    [updateMutateAsync, userId],
  );

  const clearDrawHistory = useCallback(async (): Promise<void> => {
    if (!userId) return;
    try {
      await clearMutateAsync();
    } catch {
      // Rollback já executado em onError
    }
  }, [clearMutateAsync, userId]);

  const refreshDrawHistory = useCallback(
    async (options?: RefreshOptions) => {
      if (!userId || !pendingKey) return;
      if (options?.minIntervalMs !== undefined) {
        const state = queryClient.getQueryState(queryKey);
        const lastUpdated = state?.dataUpdatedAt ?? 0;
        if (Date.now() - lastUpdated < options.minIntervalMs) {
          const pending = await readPendingInserts(pendingKey);
          if (pending.length === 0) {
            return;
          }
        }
      }
      await queryClient.invalidateQueries({ queryKey });
    },
    [pendingKey, queryClient, queryKey, userId],
  );

  return {
    history: userId ? (data ?? EMPTY_HISTORY) : EMPTY_HISTORY,
    storageReady: !userId || !isLoading,
    recordDrawAction,
    updateDrawAction,
    clearDrawHistory,
    refreshDrawHistory,
  };
}
