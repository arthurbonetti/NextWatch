import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { INITIAL_SUBSCRIPTIONS, Subscription } from '@/constants/subscriptions';
import { useAuth } from '@/contexts/AuthContext';

const BASE_STORAGE_KEY = '@nextwatch/subscriptions';
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';

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

function buildSupabaseHeaders(token?: string | null): Record<string, string> {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function SubscriptionsProvider({ children }: PropsWithChildren) {
  const { user, token } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(INITIAL_SUBSCRIPTIONS);
  const [storageReady, setStorageReady] = useState(false);
  const isSyncingFromRemote = useRef(false);

  const storageKey = user ? `${BASE_STORAGE_KEY}:${user.id}` : null;
  const userId = user?.id;

  // Carrega as assinaturas (cache local imediato + sync com Supabase se online)
  useEffect(() => {
    let cancelled = false;

    if (!storageKey || !userId) {
      setSubscriptions([]);
      setStorageReady(true);
      return;
    }

    setStorageReady(false);

    // 1. Carrega do cache local para resposta instantânea na tela
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

    // 2. Busca do Supabase na nuvem para manter atualizado e sincronizado entre dispositivos
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      fetch(`${SUPABASE_URL}/rest/v1/user_subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=*`, {
        headers: buildSupabaseHeaders(token),
      })
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Falha HTTP'))))
        .then((rows: DbSubscriptionRow[]) => {
          if (cancelled || !Array.isArray(rows)) return;
          const remoteSubs: Subscription[] = rows.map((r) => ({
            id: r.subscription_id,
            provider: r.provider,
            monthlyPrice: Number(r.monthly_price) || 0,
            billingDay: Number(r.billing_day) || 1,
            active: Boolean(r.active),
            renewalAlert: Boolean(r.renewal_alert),
            alertDays: (r.alert_days === 1 || r.alert_days === 3 || r.alert_days === 7 ? r.alert_days : 3),
          }));

          isSyncingFromRemote.current = true;
          setSubscriptions(remoteSubs);
          AsyncStorage.setItem(storageKey, JSON.stringify(remoteSubs)).catch(() => {});
          setTimeout(() => { isSyncingFromRemote.current = false; }, 100);
        })
        .catch(() => {
          // Mantém os dados locais se offline
        });
    }

    return () => {
      cancelled = true;
    };
  }, [storageKey, userId, token]);

  // Salva no AsyncStorage local sempre que o estado mudar
  useEffect(() => {
    if (!storageReady || !storageKey) return;
    AsyncStorage.setItem(storageKey, JSON.stringify(subscriptions)).catch(() => {});
  }, [storageKey, storageReady, subscriptions]);

  // Função auxiliar para enviar modificações individuais ao Supabase
  const syncUpsertToRemote = (sub: Subscription) => {
    if (!userId || !SUPABASE_URL || !SUPABASE_ANON_KEY) return;
    fetch(`${SUPABASE_URL}/rest/v1/user_subscriptions`, {
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
  };

  const syncDeleteFromRemote = (subId: string) => {
    if (!userId || !SUPABASE_URL || !SUPABASE_ANON_KEY) return;
    fetch(
      `${SUPABASE_URL}/rest/v1/user_subscriptions?user_id=eq.${encodeURIComponent(userId)}&subscription_id=eq.${encodeURIComponent(subId)}`,
      {
        method: 'DELETE',
        headers: buildSupabaseHeaders(token),
      },
    ).catch(() => {});
  };

  const value = useMemo<SubscriptionsContextValue>(() => ({
    subscriptions,
    storageReady,
    saveSubscription: (subscription) => {
      syncUpsertToRemote(subscription);
      setSubscriptions((current) => {
        const exists = current.some((item) => item.id === subscription.id);
        return exists
          ? current.map((item) => (item.id === subscription.id ? subscription : item))
          : [...current, subscription];
      });
    },
    toggleSubscription: (id) => {
      setSubscriptions((current) =>
        current.map((item) => {
          if (item.id !== id) return item;
          const updated = { ...item, active: !item.active };
          syncUpsertToRemote(updated);
          return updated;
        }),
      );
    },
    removeSubscription: (id) => {
      syncDeleteFromRemote(id);
      setSubscriptions((current) => current.filter((item) => item.id !== id));
    },
  }), [storageReady, subscriptions, userId, token]);

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
    typeof item.provider === 'string' &&
    typeof item.monthlyPrice === 'number' &&
    typeof item.billingDay === 'number' &&
    typeof item.active === 'boolean' &&
    typeof item.renewalAlert === 'boolean' &&
    (item.alertDays === 1 || item.alertDays === 3 || item.alertDays === 7)
  );
}
