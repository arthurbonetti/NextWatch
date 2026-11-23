import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef } from 'react';

import { isMediaTitle } from '@/constants/catalog';
import { useAuth } from '@/contexts/AuthContext';
import {
  createOperationSequencer,
  createPendingOpsMapStore,
  createVersionedStorage,
  readStorageFlag,
  writeStorageFlag,
} from '@/services/offlineStore';
import { queryKeys } from '@/services/queryKeys';
import {
  deleteMyListTitle,
  fetchMyList,
  upsertMyListBatch,
  upsertMyListTitle,
} from '@/services/repositories/myListRepo';
import { hasSupabaseConfig } from '@/services/supabase';
import { getCachedTitleDuration } from '@/services/tmdb';
import type { MutationOutcome, RefreshOptions } from '@/types/common';
import type { MediaTitle } from '@/types/media';

const BASE_STORAGE_KEY = '@nextwatch/my-list';
const SYNCED_FLAG_PREFIX = '@nextwatch/my-list-synced';
const PENDING_OPS_PREFIX = '@nextwatch/my-list-pending';
const EMPTY_TITLES: MediaTitle[] = [];

type PendingOp =
  | { type: 'upsert'; title: MediaTitle }
  | { type: 'delete' };

type PendingOpsMap = Record<string, PendingOp>;

function parseStoredTitlesData(data: unknown): MediaTitle[] {
  return Array.isArray(data)
    ? data
        .filter(isMediaTitle)
        .map((item) => (item.catalogSource === 'tmdb' ? { ...item, metacriticScore: null } : item))
    : [];
}

function parsePendingOp(entry: unknown): PendingOp | null {
  if (!entry || typeof entry !== 'object') return null;
  const candidate = entry as { type?: unknown; title?: unknown };
  if (candidate.type === 'delete') {
    return { type: 'delete' };
  }
  if (candidate.type === 'upsert' && isMediaTitle(candidate.title)) {
    return { type: 'upsert', title: candidate.title };
  }
  return null;
}

const myListStorage = createVersionedStorage<MediaTitle[]>({
  version: 1,
  fallback: EMPTY_TITLES,
  parse: parseStoredTitlesData,
});

const myListPendingStore = createPendingOpsMapStore<PendingOp>({
  parseOp: parsePendingOp,
});

function applyPendingOps(baseItems: MediaTitle[], pendingOps: PendingOpsMap): MediaTitle[] {
  const entries = Object.entries(pendingOps);
  if (entries.length === 0) return baseItems;

  const deletedIds = new Set<string>();
  const upserts = new Map<string, MediaTitle>();
  for (const [id, op] of entries) {
    if (op.type === 'delete') deletedIds.add(id);
    else upserts.set(id, op.title);
  }

  const updatedBase: MediaTitle[] = [];
  const seen = new Set<string>();
  for (const item of baseItems) {
    if (deletedIds.has(item.id) || seen.has(item.id)) continue;
    seen.add(item.id);
    updatedBase.push(upserts.get(item.id) ?? item);
  }

  const newUpserts: MediaTitle[] = [];
  for (const [id, title] of upserts) {
    if (!seen.has(id)) {
      seen.add(id);
      newUpserts.unshift(title);
    }
  }

  return [...newUpserts, ...updatedBase];
}

export function useMyList() {
  const { user, token } = useAuth();
  const userId = user?.id ?? null;
  const hasToken = Boolean(token);
  const storageKey = userId ? `${BASE_STORAGE_KEY}:${userId}` : null;
  const syncedKey = userId ? `${SYNCED_FLAG_PREFIX}:${userId}` : null;
  const pendingKey = userId ? `${PENDING_OPS_PREFIX}:${userId}` : null;

  const queryClient = useQueryClient();
  const queryKey = useMemo(() => queryKeys.myList(userId), [userId]);
  const sequencerRef = useRef(createOperationSequencer());

  const { data, isLoading } = useQuery<MediaTitle[]>({
    queryKey,
    enabled: Boolean(userId),
    staleTime: 30_000,
    queryFn: async ({ signal }) => {
      if (!userId || !storageKey || !syncedKey || !pendingKey) return EMPTY_TITLES;

      const [localCached, syncedFlag, pendingOps] = await Promise.all([
        myListStorage.read(storageKey),
        readStorageFlag(syncedKey),
        myListPendingStore.read(pendingKey),
      ]);

      if (!hasToken || !hasSupabaseConfig()) {
        return applyPendingOps(localCached, pendingOps);
      }

      // Reenvia mutações locais pendentes antes de consultar a nuvem
      const { remaining: remainingPending, stoppedOnRetry, aborted } =
        await myListPendingStore.flush({
          pendingKey,
          scopePrefix: userId,
          sequencer: sequencerRef.current,
          signal,
          execute: (titleId, op) =>
            op.type === 'upsert'
              ? upsertMyListTitle(userId, op.title)
              : deleteMyListTitle(userId, titleId),
        });

      if (aborted || stoppedOnRetry) {
        return applyPendingOps(localCached, remainingPending);
      }

      const fetchedTitles = await fetchMyList(userId);
      if (signal.aborted || fetchedTitles === null) {
        return applyPendingOps(localCached, remainingPending);
      }
      let remoteTitles = fetchedTitles;

      // Migra títulos que existiam apenas no cache local antes da sincronização na nuvem
      if (!syncedFlag) {
        const remoteIds = new Set(remoteTitles.map((item) => item.id));
        const localOnly = localCached.filter(
          (item) => !remoteIds.has(item.id) && remainingPending[item.id]?.type !== 'delete',
        );

        if (localOnly.length > 0) {
          const now = Date.now();
          const migrationOutcome = await upsertMyListBatch(
            userId,
            localOnly.map((item, index) => ({
              title: item,
              createdAt: new Date(now - index).toISOString(),
            })),
          );
          if (signal.aborted) {
            return applyPendingOps(localCached, remainingPending);
          }
          remoteTitles = [...localOnly, ...remoteTitles];
          if (migrationOutcome === 'ok' || migrationOutcome === 'drop') {
            void writeStorageFlag(syncedKey, true);
          }
        } else {
          void writeStorageFlag(syncedKey, true);
        }
      }

      const latestPending = await myListPendingStore.read(pendingKey);
      const finalTitles = applyPendingOps(remoteTitles, latestPending);
      void myListStorage.write(storageKey, finalTitles);
      return finalTitles;
    },
  });

  type MutationContext = { previous: MediaTitle[] | undefined; opKey: string; seq: number };

  const { mutate: upsertMutate } = useMutation<MutationOutcome, Error, MediaTitle, MutationContext>({
    mutationFn: async (snapshot) => {
      if (!userId || !hasToken || !hasSupabaseConfig()) return 'offline';
      const outcome = await upsertMyListTitle(userId, snapshot);
      if (outcome === 'drop') {
        throw new Error('Não foi possível salvar o título na sua fila.');
      }
      return outcome;
    },
    onMutate: async (snapshot) => {
      if (!userId || !storageKey || !pendingKey) {
        return { previous: undefined, opKey: '', seq: 0 };
      }
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<MediaTitle[]>(queryKey);
      const current = previous ?? [];
      const next = [snapshot, ...current.filter((item) => item.id !== snapshot.id)];
      queryClient.setQueryData<MediaTitle[]>(queryKey, next);
      void myListStorage.write(storageKey, next);

      const opKey = `${userId}:${snapshot.id}`;
      const seq = sequencerRef.current.next(opKey);
      void myListPendingStore.set(pendingKey, snapshot.id, { type: 'upsert', title: snapshot });

      return { previous, opKey, seq };
    },
    onSuccess: (outcome, snapshot, context) => {
      if (
        outcome === 'ok' &&
        pendingKey &&
        context &&
        sequencerRef.current.isCurrent(context.opKey, context.seq)
      ) {
        void myListPendingStore.remove(pendingKey, snapshot.id);
      }
    },
    onError: (_error, snapshot, context) => {
      if (
        pendingKey &&
        context &&
        sequencerRef.current.isCurrent(context.opKey, context.seq)
      ) {
        void myListPendingStore.remove(pendingKey, snapshot.id);
      }
      if (storageKey && context?.previous !== undefined) {
        queryClient.setQueryData<MediaTitle[]>(queryKey, context.previous);
        void myListStorage.write(storageKey, context.previous);
      }
    },
    onSettled: (outcome) => {
      if (outcome === 'ok' && userId && hasToken) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });

  const { mutate: deleteMutate } = useMutation<MutationOutcome, Error, string, MutationContext>({
    mutationFn: async (targetId) => {
      if (!userId || !hasToken || !hasSupabaseConfig()) return 'offline';
      const outcome = await deleteMyListTitle(userId, targetId);
      if (outcome === 'drop') {
        throw new Error('Não foi possível remover o título da sua fila.');
      }
      return outcome;
    },
    onMutate: async (targetId) => {
      if (!userId || !storageKey || !pendingKey) {
        return { previous: undefined, opKey: '', seq: 0 };
      }
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<MediaTitle[]>(queryKey);
      const next = (previous ?? []).filter((item) => item.id !== targetId);
      queryClient.setQueryData<MediaTitle[]>(queryKey, next);
      void myListStorage.write(storageKey, next);

      const opKey = `${userId}:${targetId}`;
      const seq = sequencerRef.current.next(opKey);
      void myListPendingStore.set(pendingKey, targetId, { type: 'delete' });

      return { previous, opKey, seq };
    },
    onSuccess: (outcome, targetId, context) => {
      if (
        outcome === 'ok' &&
        pendingKey &&
        context &&
        sequencerRef.current.isCurrent(context.opKey, context.seq)
      ) {
        void myListPendingStore.remove(pendingKey, targetId);
      }
    },
    onError: (_error, targetId, context) => {
      if (
        pendingKey &&
        context &&
        sequencerRef.current.isCurrent(context.opKey, context.seq)
      ) {
        void myListPendingStore.remove(pendingKey, targetId);
      }
      if (storageKey && context?.previous !== undefined) {
        queryClient.setQueryData<MediaTitle[]>(queryKey, context.previous);
        void myListStorage.write(storageKey, context.previous);
      }
    },
    onSettled: (outcome) => {
      if (outcome === 'ok' && userId && hasToken) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });

  const savedTitles = useMemo(
    () => (userId ? (data ?? EMPTY_TITLES) : EMPTY_TITLES),
    [data, userId],
  );

  const savedById = useMemo(
    () => new Map(savedTitles.map((item) => [item.id, item])),
    [savedTitles],
  );

  const isSaved = useCallback((id: string) => savedById.has(id), [savedById]);

  const findSavedTitle = useCallback((id: string) => savedById.get(id), [savedById]);

  const toggleSavedTitle = useCallback(
    (title: MediaTitle) => {
      if (!userId) return;
      const snapshot: MediaTitle = {
        ...title,
        duration: getCachedTitleDuration(title),
      };
      if (!isMediaTitle(snapshot)) return;

      const currentItems = queryClient.getQueryData<MediaTitle[]>(queryKey) ?? savedTitles;
      const exists = currentItems.some((item) => item.id === snapshot.id);
      if (exists) {
        deleteMutate(snapshot.id);
      } else {
        upsertMutate(snapshot);
      }
    },
    [deleteMutate, queryClient, queryKey, savedTitles, upsertMutate, userId],
  );

  const removeFromMyList = useCallback(
    (id: string) => {
      if (!userId) return;
      deleteMutate(id);
    },
    [deleteMutate, userId],
  );

  const refreshMyList = useCallback(
    async (options?: RefreshOptions) => {
      if (!userId || !pendingKey) return;
      if (options?.minIntervalMs !== undefined) {
        const state = queryClient.getQueryState(queryKey);
        const lastUpdated = state?.dataUpdatedAt ?? 0;
        if (Date.now() - lastUpdated < options.minIntervalMs) {
          const pending = await myListPendingStore.read(pendingKey);
          if (Object.keys(pending).length === 0) {
            return;
          }
        }
      }
      await queryClient.invalidateQueries({ queryKey });
    },
    [pendingKey, queryClient, queryKey, userId],
  );

  return {
    savedTitles,
    storageReady: !userId || !isLoading,
    isSaved,
    toggleSavedTitle,
    removeFromMyList,
    findSavedTitle,
    refreshMyList,
  };
}
