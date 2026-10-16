import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { INITIAL_SUBSCRIPTIONS, Subscription } from '@/constants/subscriptions';

const STORAGE_KEY = '@nextwatch/subscriptions';

type SubscriptionsContextValue = {
  subscriptions: Subscription[];
  storageReady: boolean;
  saveSubscription: (subscription: Subscription) => void;
  toggleSubscription: (id: string) => void;
  removeSubscription: (id: string) => void;
};

const SubscriptionsContext = createContext<SubscriptionsContextValue | null>(null);

export function SubscriptionsProvider({ children }: PropsWithChildren) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(INITIAL_SUBSCRIPTIONS);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    AsyncStorage.getItem(STORAGE_KEY)
      .then((storedValue) => {
        if (cancelled) return;
        if (storedValue) {
          const parsed: unknown = JSON.parse(storedValue);
          if (Array.isArray(parsed) && parsed.every(isSubscription)) {
            setSubscriptions(parsed);
          }
        }
      })
      .catch(() => {
        // Keep the bundled defaults if local storage is unavailable or invalid.
      })
      .finally(() => {
        if (!cancelled) setStorageReady(true);
      });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(subscriptions)).catch(() => {});
  }, [storageReady, subscriptions]);

  const value = useMemo<SubscriptionsContextValue>(() => ({
    subscriptions,
    storageReady,
    saveSubscription: (subscription) => setSubscriptions((current) => {
      const exists = current.some((item) => item.id === subscription.id);
      return exists
        ? current.map((item) => item.id === subscription.id ? subscription : item)
        : [...current, subscription];
    }),
    toggleSubscription: (id) => setSubscriptions((current) => current.map((item) =>
      item.id === id ? { ...item, active: !item.active } : item
    )),
    removeSubscription: (id) => setSubscriptions((current) => current.filter((item) => item.id !== id)),
  }), [storageReady, subscriptions]);

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
  return typeof item.id === 'string'
    && typeof item.provider === 'string'
    && typeof item.monthlyPrice === 'number'
    && typeof item.billingDay === 'number'
    && typeof item.active === 'boolean'
    && typeof item.renewalAlert === 'boolean'
    && (item.alertDays === 1 || item.alertDays === 3 || item.alertDays === 7);
}
