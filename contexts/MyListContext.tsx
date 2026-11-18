import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { isMediaTitle, MediaTitle, sanitizeHexColor, sanitizeTmdbPath } from '@/constants/catalog';
import { useAuth } from '@/contexts/AuthContext';
import { useForegroundSync } from '@/hooks/useNetworkStatus';
import {
  classifySupabaseOutcome,
  hasSupabaseConfig,
  supabaseRestFetch,
  type SupabaseOutcome,
} from '@/services/authApi';
import { getCachedTitleDuration } from '@/services/tmdb';

const BASE_STORAGE_KEY = '@nextwatch/my-list';
const SYNCED_FLAG_PREFIX = '@nextwatch/my-list-synced';
const PENDING_OPS_PREFIX = '@nextwatch/my-list-pending';
const TABLE_NAME = 'user_my_list';
const SYNC_TIMEOUT_MS = 8000;
const AUTO_REFRESH_COOLDOWN_MS = 4000;

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
  genres: string[] | null;
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

const MyListContext = createContext<MyListContextValue | null>(null);

function parseStoredTitles(raw: string | null): MediaTitle[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed
          .filter(isMediaTitle)
          .map((item) => (item.catalogSource === 'tmdb' ? { ...item, metacriticScore: null } : item))
      : [];
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

function mapRowToMediaTitle(row: Partial<DbMyListRow> | null | undefined): MediaTitle | null {
  if (!row || typeof row !== 'object') return null;

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
    metacriticScore:
      row.catalog_source !== 'tmdb' &&
      typeof row.metacritic_score === 'number' &&
      Number.isFinite(row.metacritic_score)
        ? Math.round(row.metacritic_score)
        : null,
    synopsis: String(row.synopsis ?? ''),
    color: sanitizeHexColor(row.color) ?? '#596b7c',
    icon: row.icon as MediaTitle['icon'],
    ...(row.rating_source === 'IMDb' || row.rating_source === 'TMDB'
      ? { ratingSource: row.rating_source }
      : {}),
    ...(row.catalog_source === 'tmdb' ? { catalogSource: 'tmdb' as const } : {}),
    tmdbPosterPath: sanitizeTmdbPath(row.tmdb_poster_path),
    tmdbBackdropPath: sanitizeTmdbPath(row.tmdb_backdrop_path),
    ...(typeof row.original_title === 'string' ? { originalTitle: row.original_title } : {}),
    ...(typeof row.popularity === 'number' && Number.isFinite(row.popularity)
      ? { popularity: row.popularity }
      : {}),
    ...(typeof row.vote_count === 'number' && Number.isFinite(row.vote_count)
      ? { voteCount: Math.trunc(row.vote_count) }
      : {}),
  };

  return isMediaTitle(candidate) ? candidate : null;
}

function mapMediaTitleToDbRow(
  userId: string,
  title: MediaTitle,
  createdAt?: string,
): DbMyListRow {
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
    color: sanitizeHexColor(title.color) ?? '#596b7c',
    icon: title.icon,
    rating_source: title.ratingSource === 'IMDb' || title.ratingSource === 'TMDB' ? title.ratingSource : null,
    catalog_source: title.catalogSource === 'tmdb' ? 'tmdb' : null,
    tmdb_poster_path: sanitizeTmdbPath(title.tmdbPosterPath),
    tmdb_backdrop_path: sanitizeTmdbPath(title.tmdbBackdropPath),
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
    ...(createdAt ? { created_at: createdAt } : {}),
  };
}

async function remoteFetchTitles(userId: string, token: string): Promise<MediaTitle[] | null> {
  try {
    const response = await supabaseRestFetch(
      `/rest/v1/${TABLE_NAME}?user_id=eq.${encodeURIComponent(userId)}&select=*&order=created_at.desc`,
      {},
      token,
      SYNC_TIMEOUT_MS,
    );
    if (!response || !response.ok) return null;
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) return null;
    return (rows as Partial<DbMyListRow>[])
      .map(mapRowToMediaTitle)
      .filter((item): item is MediaTitle => item !== null);
  } catch {
    return null;
  }
}

async function remoteUpsertTitles(
  rows: DbMyListRow[],
  token: string,
): Promise<SupabaseOutcome> {
  if (rows.length === 0) return 'ok';
  try {
    const response = await supabaseRestFetch(
      `/rest/v1/${TABLE_NAME}`,
      {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify(rows.length === 1 ? rows[0] : rows),
      },
      token,
      SYNC_TIMEOUT_MS,
    );
    return response ? classifySupabaseOutcome(response) : 'retry';
  } catch {
    return 'retry';
  }
}

async function remoteDeleteTitle(
  userId: string,
  titleId: string,
  token: string,
): Promise<SupabaseOutcome> {
  try {
    const response = await supabaseRestFetch(
      `/rest/v1/${TABLE_NAME}?user_id=eq.${encodeURIComponent(userId)}&title_id=eq.${encodeURIComponent(titleId)}`,
      { method: 'DELETE' },
      token,
      SYNC_TIMEOUT_MS,
    );
    return response ? classifySupabaseOutcome(response) : 'retry';
  } catch {
    return 'retry';
  }
}

export function MyListProvider({ children }: PropsWithChildren) {
  const { user, token } = useAuth();
  const userId = user?.id ?? null;
  const hasToken = Boolean(token);
  const storageKey = userId ? `${BASE_STORAGE_KEY}:${userId}` : null;
  const syncedKey = userId ? `${SYNCED_FLAG_PREFIX}:${userId}` : null;
  const pendingKey = userId ? `${PENDING_OPS_PREFIX}:${userId}` : null;

  const [prevStorageKey, setPrevStorageKey] = useState(storageKey);
  const [listState, setListState] = useState<ListState>({ key: null, items: [] });
  const latestListRef = useRef<ListState>({ key: null, items: [] });

  if (prevStorageKey !== storageKey) {
    setPrevStorageKey(storageKey);
    setListState({ key: null, items: [] });
  }
  const pendingOpsByKeyRef = useRef<Record<string, PendingOpsMap>>({});
  const itemOpSeqRef = useRef<Map<string, number>>(new Map());
  const mutationEpochRef = useRef(0);
  const lastRemoteSyncAtRef = useRef(0);
  const syncRunIdRef = useRef(0);
  const inFlightSyncRef = useRef<{ key: string; runId: number; promise: Promise<void> } | null>(null);
  const activeSessionRef = useRef<{
    storageKey: string | null;
    userId: string | null;
    hasToken: boolean;
  }>({ storageKey: null, userId: null, hasToken: false });

  const commitListState = useCallback((next: ListState) => {
    latestListRef.current = next;
    setListState(next);
  }, []);

  const syncList = useCallback((options?: RefreshOptions): Promise<void> => {
    if (!storageKey || !userId || !syncedKey || !pendingKey) {
      return Promise.resolve();
    }

    const sessionToken = token;
    const sessionHasToken = Boolean(sessionToken);
    const syncIdentity = `${storageKey}:${sessionHasToken}`;
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
      activeSessionRef.current.hasToken === sessionHasToken;

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

          const initialItems = applyPendingOps(localCached, mergedPending);

          commitListState({ key: storageKey, items: initialItems });
        } else {
          syncedFlag = (await AsyncStorage.getItem(syncedKey).catch(() => null)) === '1';
          if (!isSessionCurrent()) return;
        }

        if (!sessionToken || !hasSupabaseConfig()) {
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
            ? await remoteUpsertTitles([mapMediaTitleToDbRow(userId, op.title)], sessionToken)
            : await remoteDeleteTitle(userId, titleId, sessionToken);

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
        const fetchedTitles = await remoteFetchTitles(userId, sessionToken);
        if (!isSessionCurrent() || fetchedTitles === null) return;
        let remoteTitles = fetchedTitles;

        // 4. Migra títulos que existiam apenas no cache local antes da sincronização na nuvem
        if (!syncedFlag) {
          const remoteIds = new Set(remoteTitles.map((item) => item.id));
          const latestPending = pendingOpsByKeyRef.current[pendingKey] ?? {};
          const localCandidates = latestListRef.current.key === storageKey ? latestListRef.current.items : [];
          const localOnly = localCandidates.filter(
            (item) => !remoteIds.has(item.id) && latestPending[item.id]?.type !== 'delete',
          );

          if (localOnly.length > 0) {
            const now = Date.now();
            const migrationOutcome = await remoteUpsertTitles(
              localOnly.map((item, index) => mapMediaTitleToDbRow(userId, item, new Date(now - index).toISOString())),
              sessionToken,
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
    activeSessionRef.current = { storageKey, userId, hasToken };
    if (previousKey !== storageKey) {
      lastRemoteSyncAtRef.current = 0;
    }
    if (!storageKey || !userId) {
      latestListRef.current = { key: null, items: [] };
      pendingOpsByKeyRef.current = {};
      return;
    }
    void syncList();
  }, [commitListState, hasToken, storageKey, syncList, userId]);

  useForegroundSync(Boolean(storageKey && userId && hasToken), syncList, AUTO_REFRESH_COOLDOWN_MS);

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

    if (!token || !hasSupabaseConfig()) return;

    const remoteCall = mode === 'delete' || !snapshot
      ? remoteDeleteTitle(userId, targetId, token)
      : remoteUpsertTitles([mapMediaTitleToDbRow(userId, snapshot)], token);

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
    if (!storageKey) return;
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
