import { createClient } from 'npm:@supabase/supabase-js@2';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

const ALLOWED_ENDPOINT_REGEX =
  /^\/(watch\/providers\/(movie|tv)|discover\/(movie|tv)|search\/(movie|tv)|(movie|tv)\/\d+(\/watch\/providers)?|tv\/\d+\/(episode_groups|external_ids)|tv\/episode_group\/[a-zA-Z0-9]+)$/;

const ALLOWED_APPEND_TO_RESPONSE = new Set([
  'episode_groups',
  'external_ids',
  'episode_groups,external_ids',
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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const jwt = authHeader.slice('Bearer '.length).trim();
  if (!jwt) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseKey =
    Deno.env.get('SUPABASE_ANON_KEY') ??
    Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ??
    '';

  if (!supabaseUrl || !supabaseKey) {
    return jsonResponse({ error: 'Server auth configuration missing' }, 500);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(jwt);

  if (authError || !user) {
    return jsonResponse({ error: 'Invalid or expired session' }, 401);
  }

  const tmdbToken = (Deno.env.get('TMDB_API_TOKEN') ?? Deno.env.get('TMDB_API_KEY') ?? '').trim();
  if (!tmdbToken) {
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
        if (!Number.isFinite(pageNum) || pageNum < 1 || pageNum > 50) continue;
        upstreamUrl.searchParams.set('page', String(pageNum));
        continue;
      }
      if (key === 'append_to_response') {
        if (!ALLOWED_APPEND_TO_RESPONSE.has(value)) continue;
        upstreamUrl.searchParams.set('append_to_response', value);
        continue;
      }
      upstreamUrl.searchParams.set(key, value.slice(0, 100));
    }
  }
  upstreamUrl.searchParams.set('include_adult', 'false');

  const isBearer = tmdbToken.startsWith('eyJ');
  if (!isBearer) {
    upstreamUrl.searchParams.set('api_key', tmdbToken);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const upstreamRes = await fetch(upstreamUrl, {
      headers: {
        Accept: 'application/json',
        ...(isBearer ? { Authorization: `Bearer ${tmdbToken}` } : {}),
      },
      signal: controller.signal,
    });

    const payload = await upstreamRes.text();
    return new Response(payload, {
      status: upstreamRes.status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch {
    return jsonResponse({ error: 'Upstream catalog request failed' }, 502);
  } finally {
    clearTimeout(timer);
  }
});
