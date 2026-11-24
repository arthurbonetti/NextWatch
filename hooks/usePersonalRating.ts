import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import {
  deleteTitleRating,
  fetchTitleRating,
  upsertTitleRating,
} from '@/services/repositories/ratingRepo';

const CACHE_PREFIX = '@nextwatch/personal-rating:';

function normalizeRating(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value > 5) {
    return Math.max(0, Math.min(5, Math.round(value / 2)));
  }
  const rounded = Math.round(value);
  return rounded >= 0 && rounded <= 5 ? rounded : null;
}

export function usePersonalRating(userId: string | null, titleId: string) {
  const [rating, setRating] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const storageKey = titleId ? `${CACHE_PREFIX}${userId ?? 'guest'}:${titleId}` : '';

  useEffect(() => {
    let active = true;
    setReady(false);

    if (!titleId) {
      setRating(null);
      setReady(true);
      return () => { active = false; };
    }

    void (async () => {
      let localRating: number | null = null;
      if (storageKey) {
        const raw = await AsyncStorage.getItem(storageKey).catch(() => null);
        if (raw !== null) {
          try {
            localRating = normalizeRating(JSON.parse(raw));
          } catch {
            localRating = null;
          }
        }
      }

      let resolved = localRating;
      if (userId) {
        const remote = await fetchTitleRating(userId, titleId);
        if (remote.found) resolved = remote.rating;
      }

      if (active) {
        setRating(resolved);
        setReady(true);
        if (storageKey && resolved !== null) {
          await AsyncStorage.setItem(storageKey, JSON.stringify(resolved)).catch(() => {});
        }
      }
    })();

    return () => { active = false; };
  }, [storageKey, titleId, userId]);

  const saveRating = useCallback((nextRating: number | null) => {
    const normalized = normalizeRating(nextRating);
    setRating(normalized);

    if (storageKey) {
      if (normalized === null) {
        void AsyncStorage.removeItem(storageKey).catch(() => {});
      } else {
        void AsyncStorage.setItem(storageKey, JSON.stringify(normalized)).catch(() => {});
      }
    }

    if (userId && titleId) {
      void (normalized === null
        ? deleteTitleRating(userId, titleId)
        : upsertTitleRating(userId, titleId, normalized));
    }
  }, [storageKey, titleId, userId]);

  return { rating, ready, saveRating };
}
