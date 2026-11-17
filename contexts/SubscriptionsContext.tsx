import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { Subscription } from '@/constants/subscriptions';
import { useAuth } from '@/contexts/AuthContext';
import { hasSupabaseConfig, supabaseRestFetch } from '@/services/authApi';

const BASE_STORAGE_KEY = '@nextwatch/subscriptions';
const SYNC_TIMEOUT_MS = 8000;
const MAX_MONTHLY_PRICE = 10000;

type SubscriptionsContextValue = {
  subscriptions: Subscription[];
  storageReady: boolean;
  saveSubscription: (subscription: Subscription) => void;
  toggleSubscription: (id: string) => void;
  removeSubscription: (id: string) => void;
};

type DbSubscriptionRow = {
  user_id: string;
  subscription_id: string;
  provider: string;
  monthly_price: number;
  billing_day: number;
  active: boolean;
  renewal_alert: boolean;
  alert_days: number;
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
    const controller = new AbortController();

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

      try {
        const response = await supabaseRestFetch(
          `/rest/v1/user_subscriptions?user_id=eq.${encodeURIComponent(activeUserId)}&select=*`,
          { signal: controller.signal },
          tokenRef.current,
          SYNC_TIMEOUT_MS,
        );
        if (cancelled || !response || !response.ok) return;
        const rows: unknown = await response.json();
        if (cancelled || !Array.isArray(rows)) return;

        const remoteSubs = (rows as DbSubscriptionRow[])
          .map((row): Subscription => ({
            id: String(row.subscription_id ?? '').slice(0, 128),
            provider: String(row.provider ?? '').slice(0, 64),
            monthlyPrice: Math.min(MAX_MONTHLY_PRICE, Math.max(0.01, Number(row.monthly_price) || 0)),
            billingDay: Math.min(31, Math.max(1, Math.trunc(Number(row.billing_day) || 1))),
            active: Boolean(row.active),
            renewalAlert: Boolean(row.renewal_alert),
            alertDays: row.alert_days === 1 || row.alert_days === 3 || row.alert_days === 7 ? row.alert_days : 3,
          }))
          .filter(isSubscription);

        latestSubscriptionsRef.current = remoteSubs;
        setSubscriptions(remoteSubs);
        AsyncStorage.setItem(activeKey, JSON.stringify(remoteSubs)).catch(() => {});
      } catch {
        // Mantém os dados locais se offline
      }
    }

    void loadSubscriptions(storageKey, userId);

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [hasToken, storageKey, userId]);

  const syncUpsertToRemote = useCallback((sub: Subscription) => {
    if (!userId || !tokenRef.current || !hasSupabaseConfig()) return;
    void supabaseRestFetch(
      '/rest/v1/user_subscriptions',
      {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({
          user_id: userId,
          subscription_id: sub.id,
          provider: sub.provider,
          monthly_price: sub.monthlyPrice,
          billing_day: sub.billingDay,
          active: sub.active,
          renewal_alert: sub.renewalAlert,
          alert_days: sub.alertDays,
        }),
      },
      tokenRef.current,
      SYNC_TIMEOUT_MS,
    ).catch(() => {});
  }, [userId]);

  const syncDeleteFromRemote = useCallback((subId: string) => {
    if (!userId || !tokenRef.current || !hasSupabaseConfig()) return;
    void supabaseRestFetch(
      `/rest/v1/user_subscriptions?user_id=eq.${encodeURIComponent(userId)}&subscription_id=eq.${encodeURIComponent(subId)}`,
      { method: 'DELETE' },
      tokenRef.current,
      SYNC_TIMEOUT_MS,
    ).catch(() => {});
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

function isSubscription(value: unknown): value is Subscription {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<Subscription>;
  return (
    typeof item.id === 'string' &&
    item.id.length > 0 &&
    item.id.length <= 128 &&
    typeof item.provider === 'string' &&
    item.provider.length > 0 &&
    item.provider.length <= 64 &&
    typeof item.monthlyPrice === 'number' &&
    Number.isFinite(item.monthlyPrice) &&
    item.monthlyPrice > 0 &&
    item.monthlyPrice <= MAX_MONTHLY_PRICE &&
    typeof item.billingDay === 'number' &&
    Number.isInteger(item.billingDay) &&
    item.billingDay >= 1 &&
    item.billingDay <= 31 &&
    typeof item.active === 'boolean' &&
    typeof item.renewalAlert === 'boolean' &&
    (item.alertDays === 1 || item.alertDays === 3 || item.alertDays === 7)
  );
}
