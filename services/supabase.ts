import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { SupabaseSecureStorage } from '@/services/secureStore';

const RAW_SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || '';
const SUPABASE_ANON_KEY =
  (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY)?.trim() || '';

export type SupabaseOutcome = 'ok' | 'drop' | 'retry';

export type SupabaseErrorLike = {
  code?: string | null;
  status?: number | null;
  message?: string | null;
};

/**
 * Valida se a URL do Supabase usa protocolo seguro (HTTPS em produção ou localhost apenas em __DEV__),
 * prevenindo requisições sem criptografia em produção (OWASP M5 / A04).
 */
export function getSupabaseUrl(): string | null {
  if (!RAW_SUPABASE_URL) return null;
  try {
    const parsed = new URL(RAW_SUPABASE_URL);
    const isSecure = parsed.protocol === 'https:';
    const isDevRuntime = typeof __DEV__ !== 'undefined' && __DEV__;
    const isLocalDev =
      isDevRuntime &&
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
    if (!isSecure && !isLocalDev) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export function getSupabaseAnonKey(): string {
  return SUPABASE_ANON_KEY;
}

export function hasSupabaseConfig(): boolean {
  return Boolean(getSupabaseUrl() && SUPABASE_ANON_KEY);
}

const resolvedUrl = getSupabaseUrl();

export const supabase: SupabaseClient | null =
  resolvedUrl && SUPABASE_ANON_KEY
    ? createClient(resolvedUrl, SUPABASE_ANON_KEY, {
        auth: {
          storage: SupabaseSecureStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

export function getSupabaseClient(): SupabaseClient | null {
  return supabase;
}

if (Platform.OS !== 'web' && supabase) {
  const client = supabase;
  AppState.addEventListener('change', (nextState) => {
    if (nextState === 'active') {
      void client.auth.startAutoRefresh();
    } else {
      void client.auth.stopAutoRefresh();
    }
  });
}

export function classifySupabaseError(error: SupabaseErrorLike | null | undefined): SupabaseOutcome {
  if (!error) return 'ok';

  const status = typeof error.status === 'number' ? error.status : null;
  if (
    status !== null &&
    status >= 400 &&
    status < 500 &&
    status !== 401 &&
    status !== 403 &&
    status !== 408 &&
    status !== 429
  ) {
    return 'drop';
  }

  const code = typeof error.code === 'string' ? error.code : '';
  if (
    code.startsWith('22') ||
    code.startsWith('23') ||
    code.startsWith('PGRST1') ||
    code.startsWith('PGRST2')
  ) {
    return 'drop';
  }

  return 'retry';
}
