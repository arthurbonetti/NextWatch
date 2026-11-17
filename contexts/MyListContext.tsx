import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { isMediaTitle, MediaTitle } from '@/constants/catalog';
import { useAuth } from '@/contexts/AuthContext';
import { getCachedTitleDuration } from '@/services/tmdb';

const BASE_STORAGE_KEY = '@nextwatch/my-list';

type MyListContextValue = {
  savedTitles: MediaTitle[];
  storageReady: boolean;
  isSaved: (id: string) => boolean;
  toggleSavedTitle: (title: MediaTitle) => void;
  removeFromMyList: (id: string) => void;
  findSavedTitle: (id: string) => MediaTitle | undefined;
};

type ListState = {
  key: string | null;
  items: MediaTitle[];
};

const MyListContext = createContext<MyListContextValue | null>(null);

export function MyListProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const storageKey = user ? `${BASE_STORAGE_KEY}:${user.id}` : null;
  const [listState, setListState] = useState<ListState>({ key: null, items: [] });

  useEffect(() => {
    let cancelled = false;
    if (!storageKey) return;

    AsyncStorage.getItem(storageKey)
      .then((storedValue) => {
        if (cancelled) return;
        let loaded: MediaTitle[] = [];
        if (storedValue) {
          try {
            const parsed: unknown = JSON.parse(storedValue);
            if (Array.isArray(parsed)) {
              loaded = parsed.filter(isMediaTitle);
            }
          } catch {
            loaded = [];
          }
        }
        setListState({ key: storageKey, items: loaded });
      })
      .catch(() => {
        if (!cancelled) {
          setListState({ key: storageKey, items: [] });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  const storageReady = listState.key === storageKey;
  const savedTitles = useMemo(
    () => (listState.key === storageKey ? listState.items : []),
    [listState, storageKey],
  );

  const savedById = useMemo(
    () => new Map(savedTitles.map((item) => [item.id, item])),
    [savedTitles],
  );

  const updateList = useCallback((updater: (current: MediaTitle[]) => MediaTitle[]) => {
    if (!storageKey) return;
    setListState((current) => {
      const baseItems = current.key === storageKey ? current.items : [];
      const nextItems = updater(baseItems);
      AsyncStorage.setItem(storageKey, JSON.stringify(nextItems)).catch(() => {});
      return { key: storageKey, items: nextItems };
    });
  }, [storageKey]);

  const isSaved = useCallback((id: string) => savedById.has(id), [savedById]);

  const findSavedTitle = useCallback((id: string) => savedById.get(id), [savedById]);

  const toggleSavedTitle = useCallback((title: MediaTitle) => {
    const snapshot: MediaTitle = {
      ...title,
      duration: getCachedTitleDuration(title),
    };
    if (!isMediaTitle(snapshot)) return;

    updateList((current) => {
      const exists = current.some((item) => item.id === snapshot.id);
      if (exists) {
        return current.filter((item) => item.id !== snapshot.id);
      }
      return [snapshot, ...current];
    });
  }, [updateList]);

  const removeFromMyList = useCallback((id: string) => {
    updateList((current) => current.filter((item) => item.id !== id));
  }, [updateList]);

  const value = useMemo<MyListContextValue>(() => ({
    savedTitles,
    storageReady,
    isSaved,
    toggleSavedTitle,
    removeFromMyList,
    findSavedTitle,
  }), [findSavedTitle, isSaved, removeFromMyList, savedTitles, storageReady, toggleSavedTitle]);

  return <MyListContext.Provider value={value}>{children}</MyListContext.Provider>;
}

export function useMyList() {
  const context = useContext(MyListContext);
  if (!context) throw new Error('useMyList must be used within MyListProvider');
  return context;
}
