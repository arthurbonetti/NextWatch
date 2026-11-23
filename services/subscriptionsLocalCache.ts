import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Subscription } from '@/types/subscription';
import { isSubscription } from '@/services/repositories/subscriptionsRepo';

const BASE_STORAGE_KEY = '@nextwatch/subscriptions';

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

export function getSubscriptionsStorageKey(userId: string): string {
  return `${BASE_STORAGE_KEY}:${userId}`;
}

export function subscribeLocalCache(listener: () => void) {
  localCacheListeners.add(listener);
  return () => {
    localCacheListeners.delete(listener);
  };
}

export function getLocalCacheVersion() {
  return localCacheVersion;
}

export function getLocalSubscriptionsCache(userId: string): Subscription[] | null | undefined {
  return localSubscriptionsCache.get(userId);
}

export function setLocalSubscriptionsCache(userId: string, value: Subscription[] | null) {
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

export function hydrateLocalSubscriptions(
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
