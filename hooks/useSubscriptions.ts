import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useSyncExternalStore } from 'react';

import type { Subscription } from '@/constants/subscriptions';
import { useAuth } from '@/contexts/AuthContext';
import { queryKeys } from '@/services/queryKeys';
import {
  deleteSubscription,
  fetchSubscriptions,
  isSubscription,
  upsertSubscription,
} from '@/services/repositories/subscriptionsRepo';
import { hasSupabaseConfig } from '@/services/supabase';

const BASE_STORAGE_KEY = '@nextwatch/subscriptions';
const EMPTY_SUBSCRIPTIONS: Subscription[] = [];

type MutationOutcome = 'ok' | 'retry' | 'offline';

const localSubscriptionsCache = new Map<string, Subscription[] | null>();
const localHydrationInFlight = new Map<string, Promise<Subscription[] | null>>();
const localCacheWriteSeq = new Map<string, number>();
const localCacheListeners = new Set<() => void>();
let localCacheVersion = 0;

function notifyLocalCacheListeners() {
  localCacheVersion += 1;
  for (const listener of localCacheListeners) {
    listener();
  }
}

function subscribeLocalCache(listener: () => void) {
  localCacheListeners.add(listener);
  return () => {
    localCacheListeners.delete(listener);
  };
}

function getLocalCacheVersion() {
  return localCacheVersion;
}

function setLocalSubscriptionsCache(userId: string, value: Subscription[] | null) {
  localCacheWriteSeq.set(userId, (localCacheWriteSeq.get(userId) ?? 0) + 1);
  localSubscriptionsCache.set(userId, value);
  notifyLocalCacheListeners();
}

export function clearSubscriptionsLocalCache(): void {
  localSubscriptionsCache.clear();
  localHydrationInFlight.clear();
  localCacheWriteSeq.clear();
  notifyLocalCacheListeners();
}

function parseStoredSubscriptionsEntry(raw: string | null): Subscription[] | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isSubscription) : null;
  } catch {
    return null;
  }
}

function hydrateLocalSubscriptions(
  userId: string,
  storageKey: string,
): Promise<Subscription[] | null> {
  const existing = localSubscriptionsCache.get(userId);
  if (existing !== undefined) {
    return Promise.resolve(existing);
  }

  const inFlight = localHydrationInFlight.get(userId);
  if (inFlight) {
    return inFlight;
  }

  const writeSeqAtStart = localCacheWriteSeq.get(userId) ?? 0;
  const promise = AsyncStorage.getItem(storageKey)
    .then((raw) => {
      const parsed = parseStoredSubscriptionsEntry(raw);
      if (
        (localCacheWriteSeq.get(userId) ?? 0) === writeSeqAtStart &&
        localSubscriptionsCache.get(userId) === undefined
      ) {
        setLocalSubscriptionsCache(userId, parsed);
      }
      return parsed;
    })
    .catch(() => {
      if (
        (localCacheWriteSeq.get(userId) ?? 0) === writeSeqAtStart &&
        localSubscriptionsCache.get(userId) === undefined
      ) {
        setLocalSubscriptionsCache(userId, null);
      }
      return null;
    })
    .finally(() => {
      localHydrationInFlight.delete(userId);
    });

  localHydrationInFlight.set(userId, promise);
  return promise;
}

export function useSubscriptions() {
  const { user, token } = useAuth();
  const userId = user?.id ?? null;
  const hasToken = Boolean(token);
  const storageKey = userId ? `${BASE_STORAGE_KEY}:${userId}` : null;
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => queryKeys.subscriptions(userId), [userId]);

  useSyncExternalStore(subscribeLocalCache, getLocalCacheVersion, getLocalCacheVersion);
  const localEntry = userId ? localSubscriptionsCache.get(userId) : undefined;
  const hasHydratedLocal = Array.isArray(localEntry);

  const { data, isLoading } = useQuery<Subscription[]>({
    queryKey,
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      if (!userId || !storageKey) return EMPTY_SUBSCRIPTIONS;

      const cachedLocal = await hydrateLocalSubscriptions(userId, storageKey);
      const localSubs = cachedLocal ?? EMPTY_SUBSCRIPTIONS;

      if (!hasToken || !hasSupabaseConfig()) {
        return localSubs;
      }

      const remoteSubs = await fetchSubscriptions(userId);
      if (remoteSubs === null) {
        return localSubs;
      }

      setLocalSubscriptionsCache(userId, remoteSubs);
      AsyncStorage.setItem(storageKey, JSON.stringify(remoteSubs)).catch(() => {});
      return remoteSubs;
    },
  });

  const { mutate: upsertMutate } = useMutation<
    MutationOutcome,
    Error,
    Subscription,
    { previous: Subscription[] | undefined }
  >({
    mutationFn: async (subscription) => {
      if (!userId || !hasToken || !hasSupabaseConfig()) return 'offline';
      const outcome = await upsertSubscription(userId, subscription);
      if (outcome === 'drop') {
        throw new Error('Não foi possível salvar a assinatura.');
      }
      return outcome;
    },
    onMutate: async (subscription) => {
      if (!userId || !storageKey) return { previous: undefined };
      await queryClient.cancelQueries({ queryKey });
      const cachedLocal = localSubscriptionsCache.get(userId);
      const previous =
        queryClient.getQueryData<Subscription[]>(queryKey) ??
        (Array.isArray(cachedLocal) ? cachedLocal : undefined);
      const current = previous ?? [];
      const exists = current.some((item) => item.id === subscription.id);
      const next = exists
        ? current.map((item) => (item.id === subscription.id ? subscription : item))
        : [...current, subscription];
      setLocalSubscriptionsCache(userId, next);
      queryClient.setQueryData<Subscription[]>(queryKey, next);
      AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch(() => {});
      return { previous };
    },
    onError: (_error, _subscription, context) => {
      if (userId && storageKey && context?.previous !== undefined) {
        setLocalSubscriptionsCache(userId, context.previous);
        queryClient.setQueryData<Subscription[]>(queryKey, context.previous);
        AsyncStorage.setItem(storageKey, JSON.stringify(context.previous)).catch(() => {});
      }
    },
    onSettled: (outcome) => {
      if (outcome === 'ok' && userId && hasToken) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });

  const { mutate: removeMutate } = useMutation<
    MutationOutcome,
    Error,
    string,
    { previous: Subscription[] | undefined }
  >({
    mutationFn: async (subId) => {
      if (!userId || !hasToken || !hasSupabaseConfig()) return 'offline';
      const outcome = await deleteSubscription(userId, subId);
      if (outcome === 'drop') {
        throw new Error('Não foi possível remover a assinatura.');
      }
      return outcome;
    },
    onMutate: async (subId) => {
      if (!userId || !storageKey) return { previous: undefined };
      await queryClient.cancelQueries({ queryKey });
      const cachedLocal = localSubscriptionsCache.get(userId);
      const previous =
        queryClient.getQueryData<Subscription[]>(queryKey) ??
        (Array.isArray(cachedLocal) ? cachedLocal : undefined);
      const next = (previous ?? []).filter((item) => item.id !== subId);
      setLocalSubscriptionsCache(userId, next);
      queryClient.setQueryData<Subscription[]>(queryKey, next);
      AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch(() => {});
      return { previous };
    },
    onError: (_error, _subId, context) => {
      if (userId && storageKey && context?.previous !== undefined) {
        setLocalSubscriptionsCache(userId, context.previous);
        queryClient.setQueryData<Subscription[]>(queryKey, context.previous);
        AsyncStorage.setItem(storageKey, JSON.stringify(context.previous)).catch(() => {});
      }
    },
    onSettled: (outcome) => {
      if (outcome === 'ok' && userId && hasToken) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });

  const saveSubscription = useCallback(
    (subscription: Subscription) => {
      if (!userId || !isSubscription(subscription)) return;
      upsertMutate(subscription);
    },
    [upsertMutate, userId],
  );

  const toggleSubscription = useCallback(
    (id: string) => {
      if (!userId) return;
      const cachedLocal = localSubscriptionsCache.get(userId);
      const current =
        queryClient.getQueryData<Subscription[]>(queryKey) ??
        (Array.isArray(cachedLocal) ? cachedLocal : EMPTY_SUBSCRIPTIONS);
      const target = current.find((item) => item.id === id);
      if (!target) return;
      upsertMutate({ ...target, active: !target.active });
    },
    [queryClient, queryKey, upsertMutate, userId],
  );

  const removeSubscription = useCallback(
    (id: string) => {
      if (!userId) return;
      removeMutate(id);
    },
    [removeMutate, userId],
  );

  return {
    subscriptions: userId
      ? (data ?? (hasHydratedLocal ? localEntry : EMPTY_SUBSCRIPTIONS))
      : EMPTY_SUBSCRIPTIONS,
    storageReady: !userId || data !== undefined || hasHydratedLocal || !isLoading,
    saveSubscription,
    toggleSubscription,
    removeSubscription,
  };
}
