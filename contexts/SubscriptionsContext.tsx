import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { Subscription } from '@/constants/subscriptions';
import { useAuth } from '@/contexts/AuthContext';
import { buildSupabaseHeaders, getSupabaseUrl, hasSupabaseConfig } from '@/services/authApi';

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
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [storageReady, setStorageReady] = useState(false);

  const storageKey = user ? `${BASE_STORAGE_KEY}:${user.id}` : null;
  const userId = user?.id;

  // Carrega as assinaturas (cache local imediato + sync autenticado com Supabase se online)
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    if (!storageKey || !userId) {
      setSubscriptions([]);
      setStorageReady(true);
      return;
    }

    setStorageReady(false);

    // 1. Carrega do cache local validado para resposta instantânea na tela
    AsyncStorage.getItem(storageKey)
      .then((storedValue) => {
        if (cancelled) return;
        if (storedValue) {
          const parsed: unknown = JSON.parse(storedValue);
          if (Array.isArray(parsed) && parsed.every(isSubscription)) {
            setSubscriptions(parsed);
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setStorageReady(true);
      });

    // 2. Busca do Supabase na nuvem apenas com token autenticado válido (OWASP A01)
    const baseUrl = getSupabaseUrl();
    if (baseUrl && token && hasSupabaseConfig()) {
      const timer = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);
      fetch(`${baseUrl}/rest/v1/user_subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=*`, {
        headers: buildSupabaseHeaders(token),
        signal: controller.signal,
      })
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Falha HTTP'))))
        .then((rows: DbSubscriptionRow[]) => {
          if (cancelled || !Array.isArray(rows)) return;
          const remoteSubs: Subscription[] = rows
            .map((r): Subscription => ({
              id: String(r.subscription_id ?? '').slice(0, 128),
              provider: String(r.provider ?? '').slice(0, 64),
              monthlyPrice: Math.min(MAX_MONTHLY_PRICE, Math.max(0.01, Number(r.monthly_price) || 0)),
              billingDay: Math.min(31, Math.max(1, Math.trunc(Number(r.billing_day) || 1))),
              active: Boolean(r.active),
              renewalAlert: Boolean(r.renewal_alert),
              alertDays: r.alert_days === 1 || r.alert_days === 3 || r.alert_days === 7 ? r.alert_days : 3,
            }))
            .filter(isSubscription);

          setSubscriptions(remoteSubs);
          AsyncStorage.setItem(storageKey, JSON.stringify(remoteSubs)).catch(() => {});
        })
        .catch(() => {
          // Mantém os dados locais se offline
        })
        .finally(() => {
          clearTimeout(timer);
        });
    }

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [storageKey, userId, token]);

  // Salva no AsyncStorage local sempre que o estado mudar
  useEffect(() => {
    if (!storageReady || !storageKey) return;
    AsyncStorage.setItem(storageKey, JSON.stringify(subscriptions)).catch(() => {});
  }, [storageKey, storageReady, subscriptions]);

  // Envia modificações individuais ao Supabase exigindo sessão autenticada
  const syncUpsertToRemote = useCallback((sub: Subscription) => {
    const baseUrl = getSupabaseUrl();
    if (!userId || !token || !baseUrl || !hasSupabaseConfig()) return;
    fetch(`${baseUrl}/rest/v1/user_subscriptions`, {
      method: 'POST',
      headers: {
        ...buildSupabaseHeaders(token),
        Prefer: 'resolution=merge-duplicates',
      },
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
    }).catch(() => {});
  }, [token, userId]);

  const syncDeleteFromRemote = useCallback((subId: string) => {
    const baseUrl = getSupabaseUrl();
    if (!userId || !token || !baseUrl || !hasSupabaseConfig()) return;
    fetch(
      `${baseUrl}/rest/v1/user_subscriptions?user_id=eq.${encodeURIComponent(userId)}&subscription_id=eq.${encodeURIComponent(subId)}`,
      {
        method: 'DELETE',
        headers: buildSupabaseHeaders(token),
      },
    ).catch(() => {});
  }, [token, userId]);

  const saveSubscription = useCallback((subscription: Subscription) => {
    if (!isSubscription(subscription)) return;
    syncUpsertToRemote(subscription);
    setSubscriptions((current) => {
      const exists = current.some((item) => item.id === subscription.id);
      return exists
        ? current.map((item) => (item.id === subscription.id ? subscription : item))
        : [...current, subscription];
    });
  }, [syncUpsertToRemote]);

  const toggleSubscription = useCallback((id: string) => {
    setSubscriptions((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, active: !item.active };
        syncUpsertToRemote(updated);
        return updated;
      }),
    );
  }, [syncUpsertToRemote]);

  const removeSubscription = useCallback((id: string) => {
    syncDeleteFromRemote(id);
    setSubscriptions((current) => current.filter((item) => item.id !== id));
  }, [syncDeleteFromRemote]);

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
