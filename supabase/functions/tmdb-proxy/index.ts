import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

const ALLOWED_ENDPOINT_REGEX =
  /^\/(watch\/providers\/(movie|tv)|discover\/(movie|tv)|search\/(movie|tv)|(movie|tv)\/\d+(\/(watch\/providers|videos))?|tv\/\d+\/season\/\d+|tv\/\d+\/(episode_groups|external_ids)|tv\/episode_group\/[a-zA-Z0-9]+)$/;

const ALLOWED_APPEND_TOKENS = new Set([
  'videos',
  'credits',
  'recommendations',
  'similar',
  'release_dates',
  'content_ratings',
  'watch/providers',
  'episode_groups',
  'external_ids',
]);

const ALLOWED_PARAMS = new Set([
  'language',
  'region',
  'watch_region',
  'with_watch_providers',
  'with_watch_monetization_types',
  'sort_by',
  'include_adult',
  'page',
  'query',
  'append_to_response',
]);

const MAX_DISCOVER_PAGES = 60;
const MAX_L1_ENTRIES = 250;
const MAX_CACHE_KEY_LENGTH = 512;
const SEARCH_OR_DISCOVER_TTL_SECONDS = 12 * 60 * 60;
const DETAIL_TTL_SECONDS = 24 * 60 * 60;
const PUBLISHABLE_KEY_CACHE_TTL_MS = 15 * 60 * 1000;
const L2_CIRCUIT_BREAKER_MS = 5 * 60 * 1000;
const L2_READ_TIMEOUT_MS = 2000;

type L1CacheEntry = {
  payloadText: string;
  statusCode: number;
  expiresAtMs: number;
};

const l1Cache = new Map<string, L1CacheEntry>();
const validatedPublishableKeys = new Map<string, number>();
const pendingPublishableKeyChecks = new Map<string, Promise<boolean>>();

let l2DisabledUntilMs = 0;

function isL2CircuitOpen(): boolean {
  return Date.now() < l2DisabledUntilMs;
}

function tripL2CircuitBreaker(reason: string): void {
  const alreadyOpen = isL2CircuitOpen();
  l2DisabledUntilMs = Date.now() + L2_CIRCUIT_BREAKER_MS;
  if (!alreadyOpen) {
    console.warn(`[tmdb-proxy] L2 cache temporarily disabled for 5m: ${reason}`);
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Expose-Headers': 'X-Cache, Cache-Control',
};

function jsonResponse(
  body: unknown,
  status: number,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}

function cachedPayloadResponse(
  payloadText: string,
  status: number,
  cacheState: 'HIT-L1' | 'HIT-L2' | 'MISS' | 'BYPASS',
  maxAgeSeconds: number,
): Response {
  const cacheControl =
    cacheState === 'BYPASS'
      ? 'no-store'
      : `public, max-age=${Math.max(1, Math.floor(maxAgeSeconds))}, stale-while-revalidate=3600`;
  return new Response(payloadText, {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'X-Cache': cacheState,
      'Cache-Control': cacheControl,
    },
  });
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function collectConfiguredPublicKeys(): string[] {
  const keys = new Set<string>();
  const singleEnvKeys = [
    Deno.env.get('SUPABASE_ANON_KEY'),
    Deno.env.get('SUPABASE_PUBLISHABLE_KEY'),
  ];
  for (const raw of singleEnvKeys) {
    const trimmed = raw?.trim();
    if (trimmed) keys.add(trimmed);
  }

  const rawJsonKeys = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')?.trim();
  if (rawJsonKeys) {
    try {
      const parsed: unknown = JSON.parse(rawJsonKeys);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const value of Object.values(parsed as Record<string, unknown>)) {
          if (typeof value === 'string' && value.trim()) {
            keys.add(value.trim());
          }
        }
      }
    } catch {
      // Ignora JSON inválido de SUPABASE_PUBLISHABLE_KEYS
    }
  }
  return Array.from(keys);
}

function resolveSecretKey(): string {
  const direct =
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ??
    Deno.env.get('SUPABASE_SECRET_KEY')?.trim();
  if (direct) return direct;

  const rawJson = Deno.env.get('SUPABASE_SECRET_KEYS')?.trim();
  if (rawJson) {
    try {
      const parsed: unknown = JSON.parse(rawJson);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const record = parsed as Record<string, unknown>;
        if (typeof record.default === 'string' && record.default.trim()) {
          return record.default.trim();
        }
        for (const value of Object.values(record)) {
          if (typeof value === 'string' && value.trim()) {
            return value.trim();
          }
        }
      }
    } catch {
      // Ignora JSON inválido de SUPABASE_SECRET_KEYS
    }
  }
  return '';
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')?.trim() ?? '';
const CONFIGURED_PUBLIC_KEYS = collectConfiguredPublicKeys();
const SECRET_KEY = resolveSecretKey();
const TMDB_TOKEN = (Deno.env.get('TMDB_API_TOKEN') ?? Deno.env.get('TMDB_API_KEY') ?? '').trim();

const adminClient: SupabaseClient | null =
  SUPABASE_URL && SECRET_KEY
    ? createClient(SUPABASE_URL, SECRET_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : null;

async function verifyApiKey(apiKey: string): Promise<boolean> {
  if (!apiKey) return false;
  if (CONFIGURED_PUBLIC_KEYS.some((key) => constantTimeEqual(apiKey, key))) {
    return true;
  }

  // Fallback para chaves publishable (`sb_publishable_*`) quando SUPABASE_PUBLISHABLE_KEYS ainda não estiver exposta no runtime
  if (!apiKey.startsWith('sb_publishable_') || !SUPABASE_URL) {
    return false;
  }

  const cachedUntil = validatedPublishableKeys.get(apiKey);
  if (cachedUntil && cachedUntil > Date.now()) {
    return true;
  }

  const pendingCheck = pendingPublishableKeyChecks.get(apiKey);
  if (pendingCheck) {
    return pendingCheck;
  }

  const checkPromise = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
        method: 'GET',
        headers: { apikey: apiKey },
        signal: controller.signal,
      });
      if (res.ok) {
        validatedPublishableKeys.set(apiKey, Date.now() + PUBLISHABLE_KEY_CACHE_TTL_MS);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
      pendingPublishableKeyChecks.delete(apiKey);
    }
  })();

  pendingPublishableKeyChecks.set(apiKey, checkPromise);
  return checkPromise;
}

function sanitizeAppendToResponse(rawValue: string): string | null {
  const tokens = Array.from(
    new Set(
      rawValue
        .split(',')
        .map((token) => token.trim())
        .filter((token) => ALLOWED_APPEND_TOKENS.has(token)),
    ),
  ).sort();
  return tokens.length > 0 ? tokens.join(',') : null;
}

async function buildCanonicalCacheKey(endpoint: string, searchParams: URLSearchParams): Promise<string> {
  const canonical = new URLSearchParams();
  const sortedEntries = Array.from(searchParams.entries()).sort(([keyA, valA], [keyB, valB]) => {
    if (keyA !== keyB) return keyA.localeCompare(keyB);
    return valA.localeCompare(valB);
  });

  for (const [key, value] of sortedEntries) {
    canonical.append(key, key === 'query' ? value.toLocaleLowerCase() : value);
  }

  const rawKey = `${endpoint}?${canonical.toString()}`;
  if (rawKey.length <= MAX_CACHE_KEY_LENGTH) {
    return rawKey;
  }

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawKey));
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `sha256:${hex}`;
}

function getFromL1(cacheKey: string): L1CacheEntry | null {
  const entry = l1Cache.get(cacheKey);
  if (!entry) return null;
  if (entry.expiresAtMs <= Date.now()) {
    l1Cache.delete(cacheKey);
    return null;
  }
  l1Cache.delete(cacheKey);
  l1Cache.set(cacheKey, entry);
  return entry;
}

function setInL1(cacheKey: string, entry: L1CacheEntry): void {
  if (!l1Cache.has(cacheKey) && l1Cache.size >= MAX_L1_ENTRIES) {
    const oldestKey = l1Cache.keys().next().value;
    if (oldestKey !== undefined) {
      l1Cache.delete(oldestKey);
    }
  }
  l1Cache.delete(cacheKey);
  l1Cache.set(cacheKey, entry);
}

async function readFromL2(cacheKey: string): Promise<L1CacheEntry | null> {
  if (!adminClient || isL2CircuitOpen()) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), L2_READ_TIMEOUT_MS);
  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await adminClient
      .from('tmdb_cache')
      .select('payload, status_code, expires_at')
      .eq('cache_key', cacheKey)
      .gt('expires_at', nowIso)
      .abortSignal(controller.signal)
      .maybeSingle();

    if (error) {
      tripL2CircuitBreaker(error.message || 'select error');
      return null;
    }
    if (!data || data.payload === undefined || data.payload === null) {
      return null;
    }

    const expiresAtMs = Date.parse(String(data.expires_at ?? ''));
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
      return null;
    }

    const statusCode =
      typeof data.status_code === 'number' && data.status_code >= 200 && data.status_code < 300
        ? data.status_code
        : 200;
    const entry: L1CacheEntry = {
      payloadText: JSON.stringify(data.payload),
      statusCode,
      expiresAtMs,
    };
    setInL1(cacheKey, entry);
    return entry;
  } catch (error) {
    tripL2CircuitBreaker(error instanceof Error ? error.message : 'read exception');
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function writeToL2(
  cacheKey: string,
  parsedPayload: unknown,
  statusCode: number,
  expiresAtIso: string,
): Promise<void> {
  if (!adminClient || isL2CircuitOpen()) return;

  try {
    const nowIso = new Date().toISOString();
    const { error } = await adminClient.from('tmdb_cache').upsert(
      {
        cache_key: cacheKey,
        payload: parsedPayload,
        status_code: statusCode,
        expires_at: expiresAtIso,
        updated_at: nowIso,
      },
      { onConflict: 'cache_key' },
    );

    if (error) {
      tripL2CircuitBreaker(error.message || 'upsert error');
      return;
    }

    if (Math.random() < 0.01) {
      await adminClient.from('tmdb_cache').delete().lt('expires_at', nowIso);
    }
  } catch (error) {
    tripL2CircuitBreaker(error instanceof Error ? error.message : 'write exception');
  }
}

function runInBackground(task: Promise<unknown>): void {
  const safeTask = task.catch(() => {});
  const edgeRuntime = (
    globalThis as { EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void } }
  ).EdgeRuntime;
  if (typeof edgeRuntime?.waitUntil === 'function') {
    edgeRuntime.waitUntil(safeTask);
  } else {
    void safeTask;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  if (!SUPABASE_URL) {
    return jsonResponse({ error: 'Server auth configuration missing' }, 500);
  }

  const apiKeyHeader = req.headers.get('apikey')?.trim() ?? '';
  if (!apiKeyHeader) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }
  if (CONFIGURED_PUBLIC_KEYS.length === 0 && !apiKeyHeader.startsWith('sb_publishable_')) {
    return jsonResponse({ error: 'Server auth configuration missing' }, 500);
  }
  const isValidApiKey = await verifyApiKey(apiKeyHeader);
  if (!isValidApiKey) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  if (!TMDB_TOKEN) {
    return jsonResponse({ error: 'Catalog upstream token not configured' }, 503);
  }

  let body: { endpoint?: unknown; params?: unknown };
  try {
    body = (await req.json()) as { endpoint?: unknown; params?: unknown };
  } catch {
    return jsonResponse({ error: 'Invalid JSON payload' }, 400);
  }

  const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : '';
  if (!ALLOWED_ENDPOINT_REGEX.test(endpoint)) {
    return jsonResponse({ error: 'Endpoint not allowed' }, 400);
  }

  const upstreamUrl = new URL(`${TMDB_BASE_URL}${endpoint}`);
  if (body.params && typeof body.params === 'object' && !Array.isArray(body.params)) {
    for (const [key, value] of Object.entries(body.params as Record<string, unknown>)) {
      if (!ALLOWED_PARAMS.has(key) || typeof value !== 'string') continue;
      if (key === 'page') {
        const pageNum = Math.trunc(Number(value));
        if (!Number.isFinite(pageNum) || pageNum < 1 || pageNum > MAX_DISCOVER_PAGES) continue;
        upstreamUrl.searchParams.set('page', String(pageNum));
        continue;
      }
      if (key === 'append_to_response') {
        const sanitizedAppend = sanitizeAppendToResponse(value);
        if (!sanitizedAppend) continue;
        upstreamUrl.searchParams.set('append_to_response', sanitizedAppend);
        continue;
      }
      if (key === 'query') {
        const trimmedQuery = value.trim().slice(0, 100);
        if (!trimmedQuery) continue;
        upstreamUrl.searchParams.set('query', trimmedQuery);
        continue;
      }
      upstreamUrl.searchParams.set(key, value.slice(0, 100));
    }
  }
  upstreamUrl.searchParams.set('include_adult', 'false');

  // Gera chave canônica ANTES de anexar api_key do TMDB para nunca persistir segredo no cache
  const cacheKey = await buildCanonicalCacheKey(endpoint, upstreamUrl.searchParams);
  const ttlSeconds =
    endpoint.startsWith('/search/') || endpoint.startsWith('/discover/')
      ? SEARCH_OR_DISCOVER_TTL_SECONDS
      : DETAIL_TTL_SECONDS;

  const l1Hit = getFromL1(cacheKey);
  if (l1Hit) {
    const remainingSeconds = Math.max(1, Math.floor((l1Hit.expiresAtMs - Date.now()) / 1000));
    return cachedPayloadResponse(l1Hit.payloadText, l1Hit.statusCode, 'HIT-L1', remainingSeconds);
  }

  const l2Hit = await readFromL2(cacheKey);
  if (l2Hit) {
    const remainingSeconds = Math.max(1, Math.floor((l2Hit.expiresAtMs - Date.now()) / 1000));
    return cachedPayloadResponse(l2Hit.payloadText, l2Hit.statusCode, 'HIT-L2', remainingSeconds);
  }

  const isBearer = TMDB_TOKEN.startsWith('eyJ');
  if (!isBearer) {
    upstreamUrl.searchParams.set('api_key', TMDB_TOKEN);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const upstreamRes = await fetch(upstreamUrl, {
      headers: {
        Accept: 'application/json',
        ...(isBearer ? { Authorization: `Bearer ${TMDB_TOKEN}` } : {}),
      },
      signal: controller.signal,
    });

    const payloadText = await upstreamRes.text();
    if (!upstreamRes.ok) {
      return cachedPayloadResponse(payloadText, upstreamRes.status, 'BYPASS', 0);
    }

    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(payloadText);
    } catch {
      return cachedPayloadResponse(payloadText, upstreamRes.status, 'BYPASS', 0);
    }

    const expiresAtMs = Date.now() + ttlSeconds * 1000;
    const expiresAtIso = new Date(expiresAtMs).toISOString();
    setInL1(cacheKey, {
      payloadText,
      statusCode: upstreamRes.status,
      expiresAtMs,
    });
    runInBackground(writeToL2(cacheKey, parsedPayload, upstreamRes.status, expiresAtIso));

    return cachedPayloadResponse(payloadText, upstreamRes.status, 'MISS', ttlSeconds);
  } catch {
    return jsonResponse(
      { error: 'Upstream catalog request failed' },
      502,
      { 'X-Cache': 'BYPASS', 'Cache-Control': 'no-store' },
    );
  } finally {
    clearTimeout(timer);
  }
});
