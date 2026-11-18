import AsyncStorage from '@react-native-async-storage/async-storage';

import { SecureStore } from '@/services/secureStore';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

export type AuthStatus = 'idle' | 'loading' | 'success' | 'error';

type AuthSession = {
  user: AuthUser;
  accessToken: string;
};

type LoginCredentials = {
  email: string;
  password: string;
};

type RegisterPayload = {
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
const MAX_PASSWORD_LENGTH = 128;
const MAX_EMAIL_LENGTH = 254;
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

export type SupabaseOutcome = 'ok' | 'drop' | 'retry';

export function buildSupabaseHeaders(token?: string | null): Record<string, string> {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function classifySupabaseOutcome(response: Response): SupabaseOutcome {
  if (response.ok) return 'ok';
  if (
    response.status >= 400 &&
    response.status < 500 &&
    response.status !== 401 &&
    response.status !== 403 &&
    response.status !== 408 &&
    response.status !== 429
  ) {
    return 'drop';
  }
  return 'retry';
}

async function parseJsonSafe<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
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

type RawSupabaseUser = {
  id?: string;
  email?: string;
  created_at?: string;
  user_metadata?: { name?: unknown };
};

function toAuthUser(rawUser: RawSupabaseUser & { id: string }, fallbackEmail = '', fallbackName?: string): AuthUser {
  const metadataName = typeof rawUser.user_metadata?.name === 'string'
    ? rawUser.user_metadata.name.trim().slice(0, MAX_NAME_LENGTH)
    : '';
  const email = rawUser.email || fallbackEmail;
  return {
    id: rawUser.id,
    name: fallbackName || metadataName || email.split('@')[0] || 'Usuário',
    email,
    createdAt: rawUser.created_at || new Date().toISOString(),
  };
}

async function postAuth(path: string, body: Record<string, unknown>): Promise<SupabaseAuthResponse> {
  const baseUrl = getSupabaseUrl();
  if (!baseUrl || !SUPABASE_ANON_KEY) {
    throw new Error('Serviço de autenticação não configurado corretamente.');
  }

  checkAuthRateLimit();

  const response = await fetchWithTimeout(`${baseUrl}${path}`, {
    method: 'POST',
    headers: buildSupabaseHeaders(),
    body: JSON.stringify(body),
  });
  const data = await parseJsonSafe<SupabaseAuthResponse>(response);

  if (!response.ok || !data?.user) {
    const msg = data?.msg || data?.message || data?.error_description || data?.error;
    throw new Error(formatSupabaseError(msg));
  }

  return data;
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

  const data = await postAuth('/auth/v1/token?grant_type=password', {
    email: normalizedEmail,
    password,
  });
  if (!data.access_token || !data.user) {
    throw new Error(formatSupabaseError(data.msg || data.message || data.error_description || data.error));
  }

  const session: AuthSession = {
    user: toAuthUser(data.user, normalizedEmail),
    accessToken: data.access_token,
  };
  await persistSession(session);
  return session;
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

  const data = await postAuth('/auth/v1/signup', {
    email: normalizedEmail,
    password,
    data: { name: normalizedName },
  });

  if (data.access_token && data.user) {
    const session: AuthSession = {
      user: toAuthUser(data.user, normalizedEmail, normalizedName),
      accessToken: data.access_token,
    };
    await persistSession(session);
    return session;
  }

  // Se não devolveu o token imediatamente no signup, autentica na sequência:
  return loginWithCredentials({ email: normalizedEmail, password });
}

/**
 * GET /auth/me — Restaura a sessão validando o `accessToken` armazenado no `SecureStore`
 * com verificação online no Supabase `/auth/v1/user` e fallback offline no `AsyncStorage`.
 */
export async function restoreAuthSession(): Promise<AuthSession | null> {
  const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  if (!token) return null;

  const baseUrl = getSupabaseUrl();
  if (baseUrl && SUPABASE_ANON_KEY) {
    try {
      const response = await fetchWithTimeout(
        `${baseUrl}/auth/v1/user`,
        { method: 'GET', headers: buildSupabaseHeaders(token) },
        SESSION_RESTORE_TIMEOUT_MS,
      );

      // Se o token foi revogado ou expirou (401/403), limpa a sessão local e exige novo login (OWASP A07)
      if (response.status === 401 || response.status === 403) {
        await purgeLocalSession();
        return null;
      }

      if (response.ok) {
        const userObj = await parseJsonSafe<RawSupabaseUser>(response);
        if (typeof userObj?.id === 'string' && userObj.id.length > 0) {
          const user = toAuthUser({ ...userObj, id: userObj.id });
          await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
          return { user, accessToken: token };
        }
      }
    } catch {
      // Offline ou falha transitória: recorre ao cache local
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
    try {
      await fetchWithTimeout(
        `${baseUrl}/auth/v1/logout`,
        { method: 'POST', headers: buildSupabaseHeaders(token) },
        SESSION_RESTORE_TIMEOUT_MS,
      );
    } catch {
      // Prossegue mesmo se estiver offline
    }
  }
  await purgeLocalSession();
}
