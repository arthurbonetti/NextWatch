import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

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

function parseStoredSubscriptions(raw: string | null): Subscription[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isSubscription) : [];
  } catch {
    return [];
  }
}

export function useSubscriptions() {
  const { user, token } = useAuth();
  const userId = user?.id ?? null;
  const hasToken = Boolean(token);
  const storageKey = userId ? `${BASE_STORAGE_KEY}:${userId}` : null;
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => queryKeys.subscriptions(userId), [userId]);

  const { data, isLoading } = useQuery<Subscription[]>({
    queryKey,
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: async () => {
      if (!userId || !storageKey) return EMPTY_SUBSCRIPTIONS;

      const storedRaw = await AsyncStorage.getItem(storageKey).catch(() => null);
      const localSubs = parseStoredSubscriptions(storedRaw);

      if (!hasToken || !hasSupabaseConfig()) {
        return localSubs;
      }

      const remoteSubs = await fetchSubscriptions(userId);
      if (remoteSubs === null) {
        return localSubs;
      }

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
      const previous = queryClient.getQueryData<Subscription[]>(queryKey);
      const current = previous ?? [];
      const exists = current.some((item) => item.id === subscription.id);
      const next = exists
        ? current.map((item) => (item.id === subscription.id ? subscription : item))
        : [...current, subscription];
      queryClient.setQueryData<Subscription[]>(queryKey, next);
      AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch(() => {});
      return { previous };
    },
    onError: (_error, _subscription, context) => {
      if (storageKey && context?.previous !== undefined) {
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
      const previous = queryClient.getQueryData<Subscription[]>(queryKey);
      const next = (previous ?? []).filter((item) => item.id !== subId);
      queryClient.setQueryData<Subscription[]>(queryKey, next);
      AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch(() => {});
      return { previous };
    },
    onError: (_error, _subId, context) => {
      if (storageKey && context?.previous !== undefined) {
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
      const current = queryClient.getQueryData<Subscription[]>(queryKey) ?? [];
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
    subscriptions: userId ? (data ?? EMPTY_SUBSCRIPTIONS) : EMPTY_SUBSCRIPTIONS,
    storageReady: !userId || !isLoading,
    saveSubscription,
    toggleSubscription,
    removeSubscription,
  };
}
