import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { Subscription } from '@/constants/subscriptions';
import { useAuth } from '@/contexts/AuthContext';
import {
  deleteSubscription,
  fetchSubscriptions,
  isSubscription,
  upsertSubscription,
} from '@/services/repositories/subscriptionsRepo';
import { hasSupabaseConfig } from '@/services/supabase';

const BASE_STORAGE_KEY = '@nextwatch/subscriptions';

type SubscriptionsContextValue = {
  subscriptions: Subscription[];
  storageReady: boolean;
  saveSubscription: (subscription: Subscription) => void;
  toggleSubscription: (id: string) => void;
  removeSubscription: (id: string) => void;
};

const SubscriptionsContext = createContext<SubscriptionsContextValue | null>(null);

export function SubscriptionsProvider({ children }: PropsWithChildren) {
  const { user, token } = useAuth();
  const userId = user?.id ?? null;
  const hasToken = Boolean(token);
  const storageKey = userId ? `${BASE_STORAGE_KEY}:${userId}` : null;
  const [prevStorageKey, setPrevStorageKey] = useState(storageKey);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [storageReady, setStorageReady] = useState(() => !storageKey);
  const latestSubscriptionsRef = useRef<Subscription[]>([]);
  const tokenRef = useRef<string | null>(token);

  if (prevStorageKey !== storageKey) {
    setPrevStorageKey(storageKey);
    setSubscriptions([]);
    setStorageReady(!storageKey);
  }

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const commitSubscriptions = useCallback((next: Subscription[], persist = true) => {
    latestSubscriptionsRef.current = next;
    setSubscriptions(next);
    if (persist && storageKey) {
      AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch(() => {});
    }
  }, [storageKey]);

  // Carrega cache local imediatamente e sincroniza com Supabase quando autenticado
  useEffect(() => {
    let cancelled = false;

    if (!storageKey || !userId) {
      latestSubscriptionsRef.current = [];
      return;
    }

    async function loadSubscriptions(activeKey: string, activeUserId: string) {
      try {
        const storedValue = await AsyncStorage.getItem(activeKey);
        if (cancelled) return;
        if (storedValue) {
          const parsed: unknown = JSON.parse(storedValue);
          if (Array.isArray(parsed)) {
            const valid = parsed.filter(isSubscription);
            latestSubscriptionsRef.current = valid;
            setSubscriptions(valid);
          }
        }
      } catch {
        // Cache corrompido: ignora e aguarda sincronização remota
      } finally {
        if (!cancelled) setStorageReady(true);
      }

      if (cancelled || !hasToken || !hasSupabaseConfig()) return;

      const remoteSubs = await fetchSubscriptions(activeUserId);
      if (cancelled || !remoteSubs) return;

      latestSubscriptionsRef.current = remoteSubs;
      setSubscriptions(remoteSubs);
      AsyncStorage.setItem(activeKey, JSON.stringify(remoteSubs)).catch(() => {});
    }

    void loadSubscriptions(storageKey, userId);

    return () => {
      cancelled = true;
    };
  }, [hasToken, storageKey, userId]);

  const syncUpsertToRemote = useCallback((sub: Subscription) => {
    if (!userId || !tokenRef.current || !hasSupabaseConfig()) return;
    void upsertSubscription(userId, sub);
  }, [userId]);

  const syncDeleteFromRemote = useCallback((subId: string) => {
    if (!userId || !tokenRef.current || !hasSupabaseConfig()) return;
    void deleteSubscription(userId, subId);
  }, [userId]);

  const saveSubscription = useCallback((subscription: Subscription) => {
    if (!isSubscription(subscription)) return;
    syncUpsertToRemote(subscription);
    const current = latestSubscriptionsRef.current;
    const exists = current.some((item) => item.id === subscription.id);
    commitSubscriptions(
      exists
        ? current.map((item) => (item.id === subscription.id ? subscription : item))
        : [...current, subscription],
    );
  }, [commitSubscriptions, syncUpsertToRemote]);

  const toggleSubscription = useCallback((id: string) => {
    const target = latestSubscriptionsRef.current.find((item) => item.id === id);
    if (!target) return;
    const updated = { ...target, active: !target.active };
    syncUpsertToRemote(updated);
    commitSubscriptions(latestSubscriptionsRef.current.map((item) => (item.id === id ? updated : item)));
  }, [commitSubscriptions, syncUpsertToRemote]);

  const removeSubscription = useCallback((id: string) => {
    syncDeleteFromRemote(id);
    commitSubscriptions(latestSubscriptionsRef.current.filter((item) => item.id !== id));
  }, [commitSubscriptions, syncDeleteFromRemote]);

  const value = useMemo<SubscriptionsContextValue>(() => ({
    subscriptions,
    storageReady,
    saveSubscription,
    toggleSubscription,
    removeSubscription,
  }), [removeSubscription, saveSubscription, storageReady, subscriptions, toggleSubscription]);

  return <SubscriptionsContext.Provider value={value}>{children}</SubscriptionsContext.Provider>;
}

export function useSubscriptions() {
  const context = useContext(SubscriptionsContext);
  if (!context) throw new Error('useSubscriptions must be used within SubscriptionsProvider');
  return context;
}
