import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { isMediaTitle, MediaTitle } from '@/constants/catalog';
import { useAuth } from '@/contexts/AuthContext';
import { buildSupabaseHeaders, getSupabaseUrl, hasSupabaseConfig } from '@/services/authApi';
import { getCachedTitleDuration } from '@/services/tmdb';

const BASE_STORAGE_KEY = '@nextwatch/my-list';
const SYNCED_FLAG_PREFIX = '@nextwatch/my-list-synced';
const PENDING_OPS_PREFIX = '@nextwatch/my-list-pending';
const SYNC_TIMEOUT_MS = 8000;
const AUTO_REFRESH_COOLDOWN_MS = 4000;
const SAFE_HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;
const SAFE_TMDB_PATH_REGEX = /^\/[a-zA-Z0-9._-]{1,120}$/;

type RefreshOptions = {
  minIntervalMs?: number;
};

type MyListContextValue = {
  savedTitles: MediaTitle[];
  storageReady: boolean;
  isSaved: (id: string) => boolean;
  toggleSavedTitle: (title: MediaTitle) => void;
  removeFromMyList: (id: string) => void;
  findSavedTitle: (id: string) => MediaTitle | undefined;
  refreshMyList: (options?: RefreshOptions) => Promise<void>;
};

type ListState = {
  key: string | null;
  items: MediaTitle[];
};

type PendingOp =
  | { type: 'upsert'; title: MediaTitle }
  | { type: 'delete' };

type PendingOpsMap = Record<string, PendingOp>;

type DbMyListRow = {
  user_id: string;
  title_id: string;
  title: string;
  kind: string;
  year: number;
  duration: string;
  genres: string[];
  service: string;
  services: string[] | null;
  imdb_rating: string;
  metacritic_score: number | null;
  synopsis: string;
  color: string;
  icon: string;
  rating_source: string | null;
  catalog_source: string | null;
  tmdb_poster_path: string | null;
  tmdb_backdrop_path: string | null;
  original_title: string | null;
  popularity: number | null;
  vote_count: number | null;
  created_at?: string;
};

type RemoteOutcome = 'ok' | 'drop' | 'retry';

const MyListContext = createContext<MyListContextValue | null>(null);

function parseStoredTitles(raw: string | null): MediaTitle[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isMediaTitle) : [];
  } catch {
    return [];
  }
}

function parsePendingOps(raw: string | null): PendingOpsMap {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const result: PendingOpsMap = {};
    for (const [id, entry] of Object.entries(parsed as Record<string, unknown>)) {
      if (!id || !entry || typeof entry !== 'object') continue;
      const candidate = entry as { type?: unknown; title?: unknown };
      if (candidate.type === 'delete') {
        result[id] = { type: 'delete' };
      } else if (candidate.type === 'upsert' && isMediaTitle(candidate.title)) {
        result[id] = { type: 'upsert', title: candidate.title };
      }
    }
    return result;
  } catch {
    return {};
  }
}

function applyPendingOps(baseItems: MediaTitle[], pendingOps: PendingOpsMap): MediaTitle[] {
  const entries = Object.entries(pendingOps);
  if (entries.length === 0) return baseItems;

  const deletedIds = new Set<string>();
  const upserts = new Map<string, MediaTitle>();
  for (const [id, op] of entries) {
    if (op.type === 'delete') deletedIds.add(id);
    else upserts.set(id, op.title);
  }

  const updatedBase: MediaTitle[] = [];
  const seen = new Set<string>();
  for (const item of baseItems) {
    if (deletedIds.has(item.id) || seen.has(item.id)) continue;
    seen.add(item.id);
    updatedBase.push(upserts.get(item.id) ?? item);
  }

  const newUpserts: MediaTitle[] = [];
  for (const [id, title] of upserts) {
    if (!seen.has(id)) {
      seen.add(id);
      newUpserts.unshift(title);
    }
  }

  return [...newUpserts, ...updatedBase];
}

function mapRowToMediaTitle(row: DbMyListRow): MediaTitle | null {
  const candidate: MediaTitle = {
    id: String(row.title_id ?? '').slice(0, 128),
    title: String(row.title ?? '').slice(0, 500),
    kind: row.kind as MediaTitle['kind'],
    year: Math.max(0, Math.trunc(Number(row.year) || 0)),
    duration: String(row.duration ?? ''),
    genres: Array.isArray(row.genres) ? row.genres.filter((genre): genre is string => typeof genre === 'string') : [],
    service: String(row.service ?? ''),
    ...(Array.isArray(row.services)
      ? { services: row.services.filter((service): service is string => typeof service === 'string') }
      : {}),
    imdbRating: String(row.imdb_rating ?? ''),
    metacriticScore: typeof row.metacritic_score === 'number' && Number.isFinite(row.metacritic_score)
      ? row.metacritic_score
      : null,
    synopsis: String(row.synopsis ?? ''),
    color: String(row.color ?? '#596b7c'),
    icon: row.icon as MediaTitle['icon'],
    ...(row.rating_source === 'IMDb' || row.rating_source === 'TMDB'
      ? { ratingSource: row.rating_source }
      : {}),
    ...(row.catalog_source === 'tmdb' ? { catalogSource: 'tmdb' as const } : {}),
    tmdbPosterPath: typeof row.tmdb_poster_path === 'string' ? row.tmdb_poster_path : null,
    tmdbBackdropPath: typeof row.tmdb_backdrop_path === 'string' ? row.tmdb_backdrop_path : null,
    ...(typeof row.original_title === 'string' ? { originalTitle: row.original_title } : {}),
    ...(typeof row.popularity === 'number' && Number.isFinite(row.popularity)
      ? { popularity: row.popularity }
      : {}),
    ...(typeof row.vote_count === 'number' && Number.isFinite(row.vote_count)
      ? { voteCount: row.vote_count }
      : {}),
  };

  return isMediaTitle(candidate) ? candidate : null;
}

function mapMediaTitleToDbRow(userId: string, title: MediaTitle): Omit<DbMyListRow, 'created_at'> {
  const safeService = (title.service || title.services?.[0] || 'Netflix').trim().slice(0, 64) || 'Netflix';
  const safeServices = Array.isArray(title.services)
    ? title.services.map((service) => String(service).trim().slice(0, 64)).filter(Boolean).slice(0, 20)
    : null;

  return {
    user_id: userId,
    title_id: title.id.slice(0, 128),
    title: (title.title.trim() || 'Título sem nome').slice(0, 500),
    kind: title.kind,
    year: Math.max(0, Math.trunc(title.year) || 0),
    duration: (title.duration ?? '').slice(0, 64),
    genres: (Array.isArray(title.genres) ? title.genres : [])
      .map((genre) => String(genre).trim())
      .filter(Boolean)
      .slice(0, 20),
    service: safeService,
    services: safeServices && safeServices.length > 0 ? safeServices : null,
    imdb_rating: (title.imdbRating ?? '').slice(0, 16),
    metacritic_score:
      typeof title.metacriticScore === 'number' && Number.isFinite(title.metacriticScore)
        ? Math.min(100, Math.max(0, Math.round(title.metacriticScore)))
        : null,
    synopsis: (title.synopsis ?? '').slice(0, 4000),
    color: SAFE_HEX_COLOR_REGEX.test(title.color) ? title.color : '#596b7c',
    icon: title.icon,
    rating_source: title.ratingSource === 'IMDb' || title.ratingSource === 'TMDB' ? title.ratingSource : null,
    catalog_source: title.catalogSource === 'tmdb' ? 'tmdb' : null,
    tmdb_poster_path:
      title.tmdbPosterPath && SAFE_TMDB_PATH_REGEX.test(title.tmdbPosterPath) ? title.tmdbPosterPath : null,
    tmdb_backdrop_path:
      title.tmdbBackdropPath && SAFE_TMDB_PATH_REGEX.test(title.tmdbBackdropPath) ? title.tmdbBackdropPath : null,
    original_title:
      typeof title.originalTitle === 'string' && title.originalTitle.trim().length > 0
        ? title.originalTitle.trim().slice(0, 500)
        : null,
    popularity:
      typeof title.popularity === 'number' && Number.isFinite(title.popularity) && title.popularity >= 0
        ? title.popularity
        : null,
    vote_count:
      typeof title.voteCount === 'number' && Number.isFinite(title.voteCount) && title.voteCount >= 0
        ? Math.trunc(title.voteCount)
        : null,
  };
}

function classifyHttpOutcome(response: Response): RemoteOutcome {
  if (response.ok) return 'ok';
  if (response.status === 400 || response.status === 404 || response.status === 409 || response.status === 422) {
    return 'drop';
  }
  return 'retry';
}

async function remoteUpsertTitles(
  baseUrl: string,
  token: string,
  rows: Array<Omit<DbMyListRow, 'created_at'>>,
): Promise<RemoteOutcome> {
  if (rows.length === 0) return 'ok';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl}/rest/v1/user_my_list`, {
      method: 'POST',
      headers: {
        ...buildSupabaseHeaders(token),
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(rows.length === 1 ? rows[0] : rows),
      signal: controller.signal,
    });
    return classifyHttpOutcome(response);
  } catch {
    return 'retry';
  } finally {
    clearTimeout(timer);
  }
}

async function remoteDeleteTitle(
  baseUrl: string,
  token: string,
  userId: string,
  titleId: string,
): Promise<RemoteOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);
  try {
    const response = await fetch(
      `${baseUrl}/rest/v1/user_my_list?user_id=eq.${encodeURIComponent(userId)}&title_id=eq.${encodeURIComponent(titleId)}`,
      {
        method: 'DELETE',
        headers: buildSupabaseHeaders(token),
        signal: controller.signal,
      },
    );
    return classifyHttpOutcome(response);
  } catch {
    return 'retry';
  } finally {
    clearTimeout(timer);
  }
}

export function MyListProvider({ children }: PropsWithChildren) {
  const { user, token } = useAuth();
  const userId = user?.id ?? null;
  const storageKey = userId ? `${BASE_STORAGE_KEY}:${userId}` : null;
  const syncedKey = userId ? `${SYNCED_FLAG_PREFIX}:${userId}` : null;
  const pendingKey = userId ? `${PENDING_OPS_PREFIX}:${userId}` : null;

  const [listState, setListState] = useState<ListState>({ key: null, items: [] });
  const latestListRef = useRef<ListState>({ key: null, items: [] });
  const pendingOpsByKeyRef = useRef<Record<string, PendingOpsMap>>({});
  const itemOpSeqRef = useRef<Map<string, number>>(new Map());
  const mutationEpochRef = useRef(0);
  const lastRemoteSyncAtRef = useRef(0);
  const syncRunIdRef = useRef(0);
  const inFlightSyncRef = useRef<{ key: string; runId: number; promise: Promise<void> } | null>(null);
  const activeSessionRef = useRef<{
    storageKey: string | null;
    userId: string | null;
    token: string | null;
  }>({ storageKey: null, userId: null, token: null });

  const commitListState = useCallback((next: ListState) => {
    latestListRef.current = next;
    setListState(next);
  }, []);

  const syncList = useCallback((options?: RefreshOptions): Promise<void> => {
    if (!storageKey || !userId || !syncedKey || !pendingKey) {
      return Promise.resolve();
    }

    const sessionToken = token;
    const syncIdentity = `${storageKey}:${sessionToken ?? ''}`;
    const pendingForUser = pendingOpsByKeyRef.current[pendingKey];
    const hasPending = Boolean(pendingForUser && Object.keys(pendingForUser).length > 0);

    if (
      options?.minIntervalMs !== undefined &&
      !hasPending &&
      latestListRef.current.key === storageKey &&
      Date.now() - lastRemoteSyncAtRef.current < options.minIntervalMs
    ) {
      return Promise.resolve();
    }

    if (inFlightSyncRef.current?.key === syncIdentity) {
      return inFlightSyncRef.current.promise;
    }

    const isSessionCurrent = () =>
      activeSessionRef.current.storageKey === storageKey &&
      activeSessionRef.current.userId === userId &&
      activeSessionRef.current.token === sessionToken;

    let shouldResync = false;
    const runId = ++syncRunIdRef.current;

    const promise = (async () => {
      try {
        // 1. Carrega cache local e fila pendente ao iniciar ou trocar de usuário
        let syncedFlag = false;
        if (latestListRef.current.key !== storageKey) {
          const [storedRaw, syncedRaw, pendingRaw] = await Promise.all([
            AsyncStorage.getItem(storageKey).catch(() => null),
            AsyncStorage.getItem(syncedKey).catch(() => null),
            AsyncStorage.getItem(pendingKey).catch(() => null),
          ]);
          if (!isSessionCurrent()) return;

          const localCached = parseStoredTitles(storedRaw);
          const storedPending = parsePendingOps(pendingRaw);
          const mergedPending: PendingOpsMap = {
            ...storedPending,
            ...(pendingOpsByKeyRef.current[pendingKey] ?? {}),
          };
          pendingOpsByKeyRef.current[pendingKey] = mergedPending;
          syncedFlag = syncedRaw === '1';

          const currentBase = latestListRef.current.key === storageKey ? latestListRef.current.items : [];
          const mergedBase = currentBase.length > 0
            ? [...currentBase, ...localCached.filter((item) => !currentBase.some((cur) => cur.id === item.id))]
            : localCached;
          const initialItems = applyPendingOps(mergedBase, mergedPending);

          commitListState({ key: storageKey, items: initialItems });
        } else {
          syncedFlag = (await AsyncStorage.getItem(syncedKey).catch(() => null)) === '1';
          if (!isSessionCurrent()) return;
        }

        const baseUrl = getSupabaseUrl();
        if (!baseUrl || !sessionToken || !hasSupabaseConfig()) {
          return;
        }

        // 2. Reenvia mutações locais pendentes antes de consultar a nuvem
        const currentPending = { ...(pendingOpsByKeyRef.current[pendingKey] ?? {}) };
        let pendingChanged = false;
        for (const [titleId, op] of Object.entries(currentPending)) {
          if (!isSessionCurrent()) return;
          const opKey = `${userId}:${titleId}`;
          const seqBefore = itemOpSeqRef.current.get(opKey) ?? 0;

          const outcome = op.type === 'upsert'
            ? await remoteUpsertTitles(baseUrl, sessionToken, [mapMediaTitleToDbRow(userId, op.title)])
            : await remoteDeleteTitle(baseUrl, sessionToken, userId, titleId);

          if (!isSessionCurrent()) return;
          if (outcome === 'retry') {
            if (pendingChanged) {
              AsyncStorage.setItem(pendingKey, JSON.stringify(pendingOpsByKeyRef.current[pendingKey] ?? {})).catch(() => {});
            }
            return;
          }

          if ((itemOpSeqRef.current.get(opKey) ?? 0) === seqBefore) {
            const nextPending = { ...(pendingOpsByKeyRef.current[pendingKey] ?? {}) };
            delete nextPending[titleId];
            pendingOpsByKeyRef.current[pendingKey] = nextPending;
            pendingChanged = true;
          }
        }
        if (pendingChanged) {
          AsyncStorage.setItem(pendingKey, JSON.stringify(pendingOpsByKeyRef.current[pendingKey] ?? {})).catch(() => {});
        }

        // 3. Busca lista autoritativa no Supabase
        const epochAtGetStart = mutationEpochRef.current;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);
        let remoteRows: DbMyListRow[];
        try {
          const response = await fetch(
            `${baseUrl}/rest/v1/user_my_list?user_id=eq.${encodeURIComponent(userId)}&select=*&order=created_at.desc`,
            {
              headers: buildSupabaseHeaders(sessionToken),
              signal: controller.signal,
            },
          );
          if (!response.ok) return;
          const json: unknown = await response.json();
          if (!Array.isArray(json)) return;
          remoteRows = json as DbMyListRow[];
        } catch {
          return;
        } finally {
          clearTimeout(timer);
        }

        if (!isSessionCurrent()) return;

        let remoteTitles = remoteRows
          .map(mapRowToMediaTitle)
          .filter((item): item is MediaTitle => item !== null);

        // 4. Migra títulos que existiam apenas no cache local antes da sincronização na nuvem
        if (!syncedFlag) {
          const remoteIds = new Set(remoteTitles.map((item) => item.id));
          const latestPending = pendingOpsByKeyRef.current[pendingKey] ?? {};
          const localCandidates = latestListRef.current.key === storageKey ? latestListRef.current.items : [];
          const localOnly = localCandidates.filter(
            (item) => !remoteIds.has(item.id) && latestPending[item.id]?.type !== 'delete',
          );

          if (localOnly.length > 0) {
            const migrationOutcome = await remoteUpsertTitles(
              baseUrl,
              sessionToken,
              localOnly.map((item) => mapMediaTitleToDbRow(userId, item)),
            );
            if (!isSessionCurrent()) return;
            remoteTitles = [...localOnly, ...remoteTitles];
            if (migrationOutcome === 'ok' || migrationOutcome === 'drop') {
              AsyncStorage.setItem(syncedKey, '1').catch(() => {});
            }
          } else {
            AsyncStorage.setItem(syncedKey, '1').catch(() => {});
          }
        }

        // Descarta resposta obsoleta se o usuário alterou a lista durante a requisição GET
        if (mutationEpochRef.current !== epochAtGetStart) {
          shouldResync = true;
          return;
        }

        const finalTitles = applyPendingOps(remoteTitles, pendingOpsByKeyRef.current[pendingKey] ?? {});
        commitListState({ key: storageKey, items: finalTitles });
        AsyncStorage.setItem(storageKey, JSON.stringify(finalTitles)).catch(() => {});
        lastRemoteSyncAtRef.current = Date.now();
      } finally {
        if (inFlightSyncRef.current?.runId === runId) {
          inFlightSyncRef.current = null;
        }
        if (shouldResync && isSessionCurrent()) {
          void syncList();
        }
      }
    })();

    inFlightSyncRef.current = { key: syncIdentity, runId, promise };
    return promise;
  }, [commitListState, pendingKey, storageKey, syncedKey, token, userId]);

  // Carrega cache local e sincroniza com o Supabase ao autenticar / trocar usuário
  useEffect(() => {
    const previousKey = activeSessionRef.current.storageKey;
    activeSessionRef.current = { storageKey, userId, token };
    if (previousKey !== storageKey) {
      lastRemoteSyncAtRef.current = 0;
    }
    if (!storageKey || !userId) return;
    void syncList();
  }, [storageKey, syncList, token, userId]);

  // Re-sincroniza ao voltar para o primeiro plano ou recuperar conexão
  useEffect(() => {
    if (!storageKey || !userId || !token) return;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleOnline = () => {
        void syncList();
      };
      const handleVisibility = () => {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          void syncList({ minIntervalMs: AUTO_REFRESH_COOLDOWN_MS });
        }
      };
      window.addEventListener('online', handleOnline);
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', handleVisibility);
      }
      return () => {
        window.removeEventListener('online', handleOnline);
        if (typeof document !== 'undefined') {
          document.removeEventListener('visibilitychange', handleVisibility);
        }
      };
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void syncList({ minIntervalMs: AUTO_REFRESH_COOLDOWN_MS });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [storageKey, syncList, token, userId]);

  const storageReady = !storageKey || listState.key === storageKey;
  const savedTitles = useMemo(
    () => (storageKey && listState.key === storageKey ? listState.items : []),
    [listState, storageKey],
  );

  const savedById = useMemo(
    () => new Map(savedTitles.map((item) => [item.id, item])),
    [savedTitles],
  );

  const applyLocalMutation = useCallback((
    mode: 'upsert' | 'delete',
    targetId: string,
    snapshot?: MediaTitle,
  ) => {
    if (!storageKey || !userId || !pendingKey) return;

    mutationEpochRef.current += 1;
    const currentItems = latestListRef.current.key === storageKey ? latestListRef.current.items : [];
    const nextItems = mode === 'delete'
      ? currentItems.filter((item) => item.id !== targetId)
      : snapshot
        ? [snapshot, ...currentItems.filter((item) => item.id !== targetId)]
        : currentItems;

    commitListState({ key: storageKey, items: nextItems });
    AsyncStorage.setItem(storageKey, JSON.stringify(nextItems)).catch(() => {});

    const opKey = `${userId}:${targetId}`;
    const seq = (itemOpSeqRef.current.get(opKey) ?? 0) + 1;
    itemOpSeqRef.current.set(opKey, seq);

    const nextPending: PendingOpsMap = { ...(pendingOpsByKeyRef.current[pendingKey] ?? {}) };
    nextPending[targetId] = mode === 'delete' || !snapshot
      ? { type: 'delete' }
      : { type: 'upsert', title: snapshot };
    pendingOpsByKeyRef.current[pendingKey] = nextPending;
    AsyncStorage.setItem(pendingKey, JSON.stringify(nextPending)).catch(() => {});

    const baseUrl = getSupabaseUrl();
    if (!baseUrl || !token || !hasSupabaseConfig()) return;

    const remoteCall = mode === 'delete' || !snapshot
      ? remoteDeleteTitle(baseUrl, token, userId, targetId)
      : remoteUpsertTitles(baseUrl, token, [mapMediaTitleToDbRow(userId, snapshot)]);

    void remoteCall.then((outcome) => {
      if (outcome === 'retry') return;
      if ((itemOpSeqRef.current.get(opKey) ?? 0) !== seq) return;
      const latestPending = { ...(pendingOpsByKeyRef.current[pendingKey] ?? {}) };
      delete latestPending[targetId];
      pendingOpsByKeyRef.current[pendingKey] = latestPending;
      AsyncStorage.setItem(pendingKey, JSON.stringify(latestPending)).catch(() => {});
    });
  }, [commitListState, pendingKey, storageKey, token, userId]);

  const isSaved = useCallback((id: string) => savedById.has(id), [savedById]);

  const findSavedTitle = useCallback((id: string) => savedById.get(id), [savedById]);

  const toggleSavedTitle = useCallback((title: MediaTitle) => {
    const snapshot: MediaTitle = {
      ...title,
      duration: getCachedTitleDuration(title),
    };
    if (!isMediaTitle(snapshot) || !storageKey) return;

    const currentItems = latestListRef.current.key === storageKey ? latestListRef.current.items : [];
    const exists = currentItems.some((item) => item.id === snapshot.id);
    if (exists) {
      applyLocalMutation('delete', snapshot.id);
    } else {
      applyLocalMutation('upsert', snapshot.id, snapshot);
    }
  }, [applyLocalMutation, storageKey]);

  const removeFromMyList = useCallback((id: string) => {
    applyLocalMutation('delete', id);
  }, [applyLocalMutation]);

  const value = useMemo<MyListContextValue>(() => ({
    savedTitles,
    storageReady,
    isSaved,
    toggleSavedTitle,
    removeFromMyList,
    findSavedTitle,
    refreshMyList: syncList,
  }), [findSavedTitle, isSaved, removeFromMyList, savedTitles, storageReady, syncList, toggleSavedTitle]);

  return <MyListContext.Provider value={value}>{children}</MyListContext.Provider>;
}

export function useMyList() {
  const context = useContext(MyListContext);
  if (!context) throw new Error('useMyList must be used within MyListProvider');
  return context;
}
