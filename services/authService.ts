import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  AuthSession as SupabaseAuthSession,
  AuthUser as SupabaseAuthUser,
  SupabaseClient,
} from '@supabase/supabase-js';

import { SecureStore } from '@/services/secureStore';
import { supabase } from '@/services/supabase';
import {
  type AuthSession,
  type AuthUser,
  isStrongPassword,
  isValidEmail,
  type LoginCredentials,
  MAX_NAME_LENGTH,
  MAX_PASSWORD_LENGTH,
  MIN_LOGIN_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  type RegisterPayload,
} from '@/types/auth';

export type AuthChangeEvent = Parameters<Parameters<SupabaseClient['auth']['onAuthStateChange']>[0]>[0];

const LEGACY_ACCESS_TOKEN_KEY = 'accessToken';
const LEGACY_REFRESH_TOKEN_KEY = 'refreshToken';
const APP_STORAGE_PREFIX = '@nextwatch/';

// Proteção auxiliar contra cliques repetidos no cliente (controle efetivo deve estar no Supabase Auth)
const AUTH_RATE_LIMIT_WINDOW_MS = 60_000;
const AUTH_RATE_LIMIT_MAX_ATTEMPTS = 5;
const authAttemptTimestamps: number[] = [];

function checkAuthRateLimit(): void {
  const now = Date.now();
  while (authAttemptTimestamps.length > 0 && now - authAttemptTimestamps[0]! > AUTH_RATE_LIMIT_WINDOW_MS) {
    authAttemptTimestamps.shift();
  }
  if (authAttemptTimestamps.length >= AUTH_RATE_LIMIT_MAX_ATTEMPTS) {
    throw new Error('Muitas tentativas seguidas. Aguarde 1 minuto antes de tentar novamente.');
  }
  authAttemptTimestamps.push(now);
}

function toAuthUser(rawUser: SupabaseAuthUser, fallbackEmail = '', fallbackName?: string): AuthUser {
  const metadataName = typeof rawUser.user_metadata?.name === 'string'
    ? rawUser.user_metadata.name.trim().slice(0, MAX_NAME_LENGTH)
    : '';
  const email = rawUser.email || fallbackEmail;
  return {
    id: rawUser.id,
    name: metadataName || fallbackName || email.split('@')[0] || 'Usuário',
    email,
    createdAt: rawUser.created_at || new Date().toISOString(),
  };
}

function toAuthSession(
  session: SupabaseAuthSession,
  fallbackEmail = '',
  fallbackName?: string,
): AuthSession {
  return {
    user: toAuthUser(session.user, fallbackEmail, fallbackName),
    accessToken: session.access_token,
    ...(session.refresh_token ? { refreshToken: session.refresh_token } : {}),
  };
}

/**
 * Mapeia erros de autenticação para mensagens genéricas e seguras,
 * evitando enumeração de contas ou vazamento de detalhes internos (OWASP A07 / A10).
 */
function formatSupabaseError(errorMsg?: string): string {
  if (!errorMsg) return 'Erro ao comunicar com o servidor de autenticação.';
  const lower = errorMsg.toLowerCase();
  if (lower.includes('invalid login credentials') || lower.includes('invalid_grant') || lower.includes('user not found')) {
    return 'E-mail ou senha incorretos. Verifique suas credenciais.';
  }
  if (lower.includes('user already registered') || lower.includes('already exists')) {
    return 'Não foi possível concluir o cadastro com este e-mail. Tente fazer login.';
  }
  if (lower.includes('password should be at least') || lower.includes('weak_password')) {
    return `A senha deve conter no mínimo ${MIN_PASSWORD_LENGTH} caracteres com letras e números.`;
  }
  if (lower.includes('email not confirmed')) {
    return 'E-mail ainda não confirmado. Verifique sua caixa de entrada.';
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Muitas solicitações. Aguarde alguns instantes e tente novamente.';
  }
  return 'Não foi possível concluir a autenticação. Verifique os dados e tente novamente.';
}

async function purgeLegacyTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(LEGACY_ACCESS_TOKEN_KEY).catch(() => {});
  await SecureStore.deleteItemAsync(LEGACY_REFRESH_TOKEN_KEY).catch(() => {});
}

async function purgeLocalStorageCaches(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const appKeys = keys.filter((key) => key.startsWith(APP_STORAGE_PREFIX));
    if (appKeys.length > 0) {
      await AsyncStorage.multiRemove(appKeys);
    }
  } catch {
    // Ignora falha ao limpar cache local
  }
}

async function signInInternal(
  normalizedEmail: string,
  password: string,
  enforceRateLimit: boolean,
): Promise<AuthSession> {
  if (!supabase) {
    throw new Error('Serviço de autenticação não configurado corretamente.');
  }
  if (enforceRateLimit) {
    checkAuthRateLimit();
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (error || !data.session || !data.user) {
    throw new Error(formatSupabaseError(error?.message));
  }

  return toAuthSession(data.session, normalizedEmail);
}

export async function loginWithCredentials({ email, password }: LoginCredentials): Promise<AuthSession> {
  const normalizedEmail = email.trim().toLowerCase();
  if (
    !isValidEmail(normalizedEmail) ||
    password.length < MIN_LOGIN_PASSWORD_LENGTH ||
    password.length > MAX_PASSWORD_LENGTH
  ) {
    throw new Error('E-mail ou senha inválidos.');
  }

  return signInInternal(normalizedEmail, password, true);
}

export async function registerAccount({ name, email, password }: RegisterPayload): Promise<AuthSession> {
  const normalizedName = name.trim().slice(0, MAX_NAME_LENGTH);
  const normalizedEmail = email.trim().toLowerCase();
  if (
    normalizedName.length < 2 ||
    !isValidEmail(normalizedEmail) ||
    !isStrongPassword(password)
  ) {
    throw new Error(
      `Verifique os dados informados. A senha precisa ter ao menos ${MIN_PASSWORD_LENGTH} caracteres com letras e números.`,
    );
  }

  if (!supabase) {
    throw new Error('Serviço de autenticação não configurado corretamente.');
  }

  checkAuthRateLimit();

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: { name: normalizedName },
    },
  });

  if (error || !data.user) {
    throw new Error(formatSupabaseError(error?.message));
  }

  if (data.session) {
    return toAuthSession(data.session, normalizedEmail, normalizedName);
  }

  return signInInternal(normalizedEmail, password, false);
}

export async function restoreAuthSession(): Promise<AuthSession | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.auth.getSession();
    if (!error && data.session?.user) {
      return toAuthSession(data.session);
    }
  } catch {
    // Prossegue para tentativa de migração legada
  }

  const legacyAccessToken = await SecureStore.getItemAsync(LEGACY_ACCESS_TOKEN_KEY).catch(() => null);
  const legacyRefreshToken = await SecureStore.getItemAsync(LEGACY_REFRESH_TOKEN_KEY).catch(() => null);

  if (legacyAccessToken && legacyRefreshToken) {
    try {
      const { data, error } = await supabase.auth.setSession({
        access_token: legacyAccessToken,
        refresh_token: legacyRefreshToken,
      });
      if (!error && data.session?.user) {
        return toAuthSession(data.session);
      }
    } catch {
      // Migração falhou (offline ou tokens expirados)
    } finally {
      await purgeLegacyTokens();
    }
  } else if (legacyAccessToken || legacyRefreshToken) {
    await purgeLegacyTokens();
  }

  return null;
}

export async function refreshAuthSession(): Promise<AuthSession | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session?.user) return null;
    return toAuthSession(data.session);
  } catch {
    return null;
  }
}

export async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

export async function clearAuthSession(): Promise<void> {
  if (supabase) {
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch {
      // Prossegue com limpeza local mesmo se offline
    }
  }
  await purgeLegacyTokens();
  await purgeLocalStorageCaches();
}

export function onAuthStateChange(
  listener: (event: AuthChangeEvent, session: AuthSession | null) => void,
): () => void {
  if (!supabase) {
    return () => {};
  }

  const { data } = supabase.auth.onAuthStateChange((event, rawSession) => {
    listener(event, rawSession?.user ? toAuthSession(rawSession) : null);
  });

  return () => {
    data.subscription.unsubscribe();
  };
}
