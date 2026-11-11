import AsyncStorage from '@react-native-async-storage/async-storage';

import { SecureStore } from '@/services/secureStore';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

export type AuthStatus = 'idle' | 'loading' | 'success' | 'error';

export type AuthSession = {
  user: AuthUser;
  accessToken: string;
};

export type LoginCredentials = {
  email: string;
  password: string;
};

export type RegisterPayload = {
  name: string;
  email: string;
  password: string;
};

const RAW_SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';

const ACCESS_TOKEN_KEY = 'accessToken';
const USER_CACHE_KEY = '@nextwatch/auth-user';
const REQUEST_TIMEOUT_MS = 15000;
const SESSION_RESTORE_TIMEOUT_MS = 4000;

export const MIN_PASSWORD_LENGTH = 6;
export const MAX_PASSWORD_LENGTH = 128;
export const MAX_EMAIL_LENGTH = 254;
export const MAX_NAME_LENGTH = 80;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Rate limiting contra força bruta (better-auth-security-best-practices: máx 5 tentativas por janela de 60s)
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

export function isValidEmail(email: string): boolean {
  const trimmed = email.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_EMAIL_LENGTH && EMAIL_REGEX.test(trimmed);
}

/**
 * Valida se a URL do Supabase usa protocolo seguro (HTTPS ou localhost em desenvolvimento),
 * prevenindo requisições relativas acidentais ou tráfego sem criptografia (REACT-NET-001 / OWASP A04).
 */
export function getSupabaseUrl(): string | null {
  if (!RAW_SUPABASE_URL) return null;
  try {
    const parsed = new URL(RAW_SUPABASE_URL);
    const isSecure = parsed.protocol === 'https:';
    const isLocalDev = parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
    if (!isSecure && !isLocalDev) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export function hasSupabaseConfig(): boolean {
  return Boolean(getSupabaseUrl() && SUPABASE_ANON_KEY);
}

export function buildSupabaseHeaders(token?: string | null): Record<string, string> {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function persistSession(session: AuthSession): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, session.accessToken);
  await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(session.user));
}

async function purgeLocalSession(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await AsyncStorage.removeItem(USER_CACHE_KEY);
}

function isValidAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AuthUser>;
  return (
    typeof candidate.id === 'string' &&
    candidate.id.length > 0 &&
    candidate.id.length <= 128 &&
    typeof candidate.email === 'string' &&
    isValidEmail(candidate.email) &&
    typeof candidate.name === 'string' &&
    candidate.name.length > 0 &&
    candidate.name.length <= MAX_NAME_LENGTH &&
    typeof candidate.createdAt === 'string'
  );
}

type SupabaseAuthResponse = {
  access_token?: string;
  token_type?: string;
  user?: {
    id: string;
    email?: string;
    created_at?: string;
    user_metadata?: {
      name?: string;
      [key: string]: unknown;
    };
  };
  msg?: string;
  message?: string;
  error_description?: string;
  error?: string;
};

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
  if (lower.includes('password should be at least')) {
    return `A senha deve conter no mínimo ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (lower.includes('email not confirmed')) {
    return 'E-mail ainda não confirmado. Verifique sua caixa de entrada.';
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Muitas solicitações. Aguarde alguns instantes e tente novamente.';
  }
  return 'Não foi possível concluir a autenticação. Verifique os dados e tente novamente.';
}

/**
 * POST /auth/login — Autentica o usuário no Supabase Auth via REST API.
 * Salva o `accessToken` via `SecureStore` (conforme exigido na disciplina) e o perfil em `AsyncStorage`.
 */
export async function loginWithCredentials({ email, password }: LoginCredentials): Promise<AuthSession> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!isValidEmail(normalizedEmail) || password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    throw new Error('E-mail ou senha inválidos.');
  }

  const baseUrl = getSupabaseUrl();
  if (!baseUrl || !SUPABASE_ANON_KEY) {
    throw new Error('Serviço de autenticação não configurado corretamente.');
  }

  checkAuthRateLimit();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: buildSupabaseHeaders(),
      body: JSON.stringify({
        email: normalizedEmail,
        password,
      }),
      signal: controller.signal,
    });

    const data = (await response.json()) as SupabaseAuthResponse;

    if (!response.ok || !data.access_token || !data.user) {
      const msg = data.msg || data.message || data.error_description || data.error;
      throw new Error(formatSupabaseError(msg));
    }

    const rawName = typeof data.user.user_metadata?.name === 'string'
      ? data.user.user_metadata.name.trim().slice(0, MAX_NAME_LENGTH)
      : '';

    const session: AuthSession = {
      user: {
        id: data.user.id,
        name: rawName || normalizedEmail.split('@')[0] || 'Usuário',
        email: data.user.email || normalizedEmail,
        createdAt: data.user.created_at || new Date().toISOString(),
      },
      accessToken: data.access_token,
    };

    await persistSession(session);
    return session;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * POST /auth/register — Cria uma nova conta no Supabase Auth via REST API.
 * Salva o token de acesso no `SecureStore` e os dados do usuário no `AsyncStorage`.
 */
export async function registerAccount({ name, email, password }: RegisterPayload): Promise<AuthSession> {
  const normalizedName = name.trim().slice(0, MAX_NAME_LENGTH);
  const normalizedEmail = email.trim().toLowerCase();
  if (
    normalizedName.length < 2 ||
    !isValidEmail(normalizedEmail) ||
    password.length < MIN_PASSWORD_LENGTH ||
    password.length > MAX_PASSWORD_LENGTH
  ) {
    throw new Error('Verifique os dados informados para criar sua conta.');
  }

  const baseUrl = getSupabaseUrl();
  if (!baseUrl || !SUPABASE_ANON_KEY) {
    throw new Error('Serviço de autenticação não configurado corretamente.');
  }

  checkAuthRateLimit();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/auth/v1/signup`, {
      method: 'POST',
      headers: buildSupabaseHeaders(),
      body: JSON.stringify({
        email: normalizedEmail,
        password,
        data: {
          name: normalizedName,
        },
      }),
      signal: controller.signal,
    });

    const data = (await response.json()) as SupabaseAuthResponse;

    if (!response.ok || !data.user) {
      const msg = data.msg || data.message || data.error_description || data.error;
      throw new Error(formatSupabaseError(msg));
    }

    // Se o Supabase devolver a sessão com access_token direto no signup:
    if (data.access_token) {
      const session: AuthSession = {
        user: {
          id: data.user.id,
          name: normalizedName,
          email: data.user.email || normalizedEmail,
          createdAt: data.user.created_at || new Date().toISOString(),
        },
        accessToken: data.access_token,
      };
      await persistSession(session);
      return session;
    }

    // Se não devolveu o token imediatamente no signup, autentica na sequência:
    return await loginWithCredentials({ email: normalizedEmail, password });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * GET /auth/me — Restaura a sessão validando o `accessToken` armazenado no `SecureStore`
 * com verificação online no Supabase `/auth/v1/user` e fallback offline no `AsyncStorage` (Slides 13 e 14).
 */
export async function restoreAuthSession(): Promise<AuthSession | null> {
  const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  if (!token) return null;

  const baseUrl = getSupabaseUrl();
  if (baseUrl && SUPABASE_ANON_KEY) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SESSION_RESTORE_TIMEOUT_MS);

    try {
      const response = await fetch(`${baseUrl}/auth/v1/user`, {
        method: 'GET',
        headers: buildSupabaseHeaders(token),
        signal: controller.signal,
      });

      // Se o token foi revogado ou expirou (401/403), limpa a sessão local e exige novo login (OWASP A07)
      if (response.status === 401 || response.status === 403) {
        await purgeLocalSession();
        return null;
      }

      if (response.ok) {
        const userObj = (await response.json()) as {
          id?: string;
          email?: string;
          created_at?: string;
          user_metadata?: { name?: string };
        };

        if (typeof userObj?.id === 'string' && userObj.id.length > 0) {
          const safeName = typeof userObj.user_metadata?.name === 'string'
            ? userObj.user_metadata.name.trim().slice(0, MAX_NAME_LENGTH)
            : '';
          const user: AuthUser = {
            id: userObj.id,
            name: safeName || userObj.email?.split('@')[0] || 'Usuário',
            email: userObj.email || '',
            createdAt: userObj.created_at || new Date().toISOString(),
          };
          await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
          return { user, accessToken: token };
        }
      }
    } catch {
      // Offline ou falha transitória: recorre ao cache local conforme o PDF da aula
    } finally {
      clearTimeout(timer);
    }
  }

  const cachedUserRaw = await AsyncStorage.getItem(USER_CACHE_KEY);
  if (cachedUserRaw) {
    try {
      const parsed: unknown = JSON.parse(cachedUserRaw);
      if (isValidAuthUser(parsed)) {
        return { user: parsed, accessToken: token };
      }
    } catch {
      // Ignora erro de JSON e remove cache corrompido
    }
    await AsyncStorage.removeItem(USER_CACHE_KEY);
  }

  return null;
}

/**
 * DELETE /auth/session — Desloga a sessão atual no Supabase e remove o token do `SecureStore`.
 */
export async function clearAuthSession(): Promise<void> {
  const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  const baseUrl = getSupabaseUrl();
  if (token && baseUrl && SUPABASE_ANON_KEY) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SESSION_RESTORE_TIMEOUT_MS);
    try {
      await fetch(`${baseUrl}/auth/v1/logout`, {
        method: 'POST',
        headers: buildSupabaseHeaders(token),
        signal: controller.signal,
      });
    } catch {
      // Prossegue mesmo se estiver offline
    } finally {
      clearTimeout(timer);
    }
  }
  await purgeLocalSession();
}

/**
 * Limpa toda a sessão localmente.
 */
export async function clearAllStoredAccounts(): Promise<void> {
  await clearAuthSession();
}
