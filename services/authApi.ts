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
  refreshToken?: string;
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
const REFRESH_TOKEN_KEY = 'refreshToken';
const USER_CACHE_KEY = '@nextwatch/auth-user';
const APP_STORAGE_PREFIX = '@nextwatch/';
const REQUEST_TIMEOUT_MS = 15000;
const SESSION_RESTORE_TIMEOUT_MS = 4000;
const TOKEN_REFRESH_BUFFER_MS = 30_000;

export const MIN_PASSWORD_LENGTH = 8;
export const MIN_LOGIN_PASSWORD_LENGTH = 6;
export const MAX_PASSWORD_LENGTH = 128;
export const MAX_EMAIL_LENGTH = 254;
export const MAX_NAME_LENGTH = 80;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Proteção auxiliar contra cliques repetidos no cliente (controle efetivo deve estar no Supabase Auth)
const AUTH_RATE_LIMIT_WINDOW_MS = 60_000;
const AUTH_RATE_LIMIT_MAX_ATTEMPTS = 5;
const authAttemptTimestamps: number[] = [];

type SessionInvalidatedListener = () => void;
type SessionRefreshedListener = (session: AuthSession) => void;

const sessionInvalidatedListeners = new Set<SessionInvalidatedListener>();
const sessionRefreshedListeners = new Set<SessionRefreshedListener>();
let activeRefreshPromise: Promise<AuthSession | null> | null = null;

export function subscribeSessionInvalidated(listener: SessionInvalidatedListener): () => void {
  sessionInvalidatedListeners.add(listener);
  return () => {
    sessionInvalidatedListeners.delete(listener);
  };
}

export function subscribeSessionRefreshed(listener: SessionRefreshedListener): () => void {
  sessionRefreshedListeners.add(listener);
  return () => {
    sessionRefreshedListeners.delete(listener);
  };
}

function notifySessionInvalidated(): void {
  for (const listener of sessionInvalidatedListeners) {
    listener();
  }
}

function notifySessionRefreshed(session: AuthSession): void {
  for (const listener of sessionRefreshedListeners) {
    listener(session);
  }
}

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

export function isStrongPassword(password: string): boolean {
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return false;
  }
  return /[a-zA-Z]/.test(password) && /\d/.test(password);
}

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
  const externalSignal = init.signal;
  const onExternalAbort = () => controller.abort();

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onExternalAbort);
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

function decodeBase64Url(input: string): string | null {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');

  try {
    if (typeof atob === 'function') {
      const binary = atob(padded);
      const bytes = Array.from(binary, (c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join('');
      return decodeURIComponent(bytes);
    }

    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let bits = 0;
    let bitCount = 0;
    const outputBytes: number[] = [];
    for (const char of padded) {
      if (char === '=') break;
      const val = alphabet.indexOf(char);
      if (val === -1) return null;
      bits = (bits << 6) | val;
      bitCount += 6;
      if (bitCount >= 8) {
        bitCount -= 8;
        outputBytes.push((bits >> bitCount) & 0xff);
      }
    }
    const percentEncoded = outputBytes.map((b) => `%${b.toString(16).padStart(2, '0')}`).join('');
    return decodeURIComponent(percentEncoded);
  } catch {
    return null;
  }
}

function decodeJwtPayload(token: string): { sub?: string; exp?: number } | null {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  const json = decodeBase64Url(parts[1]);
  if (!json) return null;
  try {
    return JSON.parse(json) as { sub?: string; exp?: number };
  } catch {
    return null;
  }
}

function isTokenUnexpired(token: string, bufferMs = 0): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return false;
  return payload.exp * 1000 > Date.now() + bufferMs;
}

async function persistSession(session: AuthSession): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, session.accessToken);
  if (session.refreshToken) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, session.refreshToken);
  }
  await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(session.user));
}

async function purgeLocalSession(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY).catch(() => {});
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => {});
  try {
    const keys = await AsyncStorage.getAllKeys();
    const appKeys = keys.filter((key) => key.startsWith(APP_STORAGE_PREFIX));
    if (appKeys.length > 0) {
      await AsyncStorage.multiRemove(appKeys);
    }
  } catch {
    await AsyncStorage.removeItem(USER_CACHE_KEY).catch(() => {});
  }
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

type RawSupabaseUser = {
  id?: string;
  email?: string;
  created_at?: string;
  user_metadata?: {
    name?: unknown;
    [key: string]: unknown;
  };
};

type SupabaseAuthResponse = {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  user?: RawSupabaseUser & { id: string };
  msg?: string;
  message?: string;
  error_description?: string;
  error?: string;
};

function toAuthUser(rawUser: RawSupabaseUser & { id: string }, fallbackEmail = '', fallbackName?: string): AuthUser {
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

function buildSessionFromAuthResponse(
  data: SupabaseAuthResponse,
  fallbackEmail: string,
  fallbackName?: string,
): AuthSession | null {
  if (!data.access_token || !data.user?.id) return null;

  return {
    user: toAuthUser(data.user, fallbackEmail, fallbackName),
    accessToken: data.access_token,
    ...(typeof data.refresh_token === 'string' && data.refresh_token ? { refreshToken: data.refresh_token } : {}),
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
 * Salva `accessToken` e `refreshToken` no `SecureStore` e o perfil em cache no `AsyncStorage`.
 */
export async function loginWithCredentials({ email, password }: LoginCredentials): Promise<AuthSession> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!isValidEmail(normalizedEmail) || password.length < MIN_LOGIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    throw new Error('E-mail ou senha inválidos.');
  }

  const data = await postAuth('/auth/v1/token?grant_type=password', {
    email: normalizedEmail,
    password,
  });

  const session = buildSessionFromAuthResponse(data, normalizedEmail);
  if (!session) {
    const msg = data.msg || data.message || data.error_description || data.error;
    throw new Error(formatSupabaseError(msg));
  }

  await persistSession(session);
  return session;
}

/**
 * POST /auth/register — Cria uma nova conta no Supabase Auth via REST API.
 */
export async function registerAccount({ name, email, password }: RegisterPayload): Promise<AuthSession> {
  const normalizedName = name.trim().slice(0, MAX_NAME_LENGTH);
  const normalizedEmail = email.trim().toLowerCase();
  if (
    normalizedName.length < 2 ||
    !isValidEmail(normalizedEmail) ||
    !isStrongPassword(password)
  ) {
    throw new Error(`Verifique os dados informados. A senha precisa ter ao menos ${MIN_PASSWORD_LENGTH} caracteres com letras e números.`);
  }

  const data = await postAuth('/auth/v1/signup', {
    email: normalizedEmail,
    password,
    data: { name: normalizedName },
  });

  const session = buildSessionFromAuthResponse(data, normalizedEmail, normalizedName);
  if (session) {
    await persistSession(session);
    return session;
  }

  // Se não devolveu o token imediatamente no signup, autentica na sequência:
  return loginWithCredentials({ email: normalizedEmail, password });
}

/**
 * Renova a sessão atual utilizando `refresh_token` armazenado no `SecureStore` (single-flight).
 */
export async function refreshAuthSession(): Promise<AuthSession | null> {
  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  activeRefreshPromise = (async () => {
    const baseUrl = getSupabaseUrl();
    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    if (!baseUrl || !SUPABASE_ANON_KEY || !refreshToken) {
      return null;
    }

    try {
      const response = await fetchWithTimeout(`${baseUrl}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: buildSupabaseHeaders(),
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (response.status === 400 || response.status === 401 || response.status === 403) {
        await purgeLocalSession();
        notifySessionInvalidated();
        return null;
      }

      if (!response.ok) {
        return null;
      }

      const data = await parseJsonSafe<SupabaseAuthResponse>(response);
      if (!data) return null;
      const session = buildSessionFromAuthResponse(data, '');
      if (!session) {
        return null;
      }

      await persistSession(session);
      notifySessionRefreshed(session);
      return session;
    } catch {
      return null;
    } finally {
      activeRefreshPromise = null;
    }
  })();

  return activeRefreshPromise;
}

/**
 * Retorna um `accessToken` não expirado; tenta renovar automaticamente quando próximo da expiração.
 */
export async function getValidAccessToken(): Promise<string | null> {
  const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  if (token && isTokenUnexpired(token, TOKEN_REFRESH_BUFFER_MS)) {
    return token;
  }

  const refreshed = await refreshAuthSession();
  if (refreshed) {
    return refreshed.accessToken;
  }

  if (token && isTokenUnexpired(token)) {
    return token;
  }

  return null;
}

/**
 * Executa uma requisição autenticada contra o Supabase (REST / Edge Functions),
 * garantindo token válido e tentativa única de renovação em caso de 401.
 */
export async function supabaseRestFetch(
  pathWithQuery: string,
  init: RequestInit = {},
  fallbackToken?: string | null,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response | null> {
  const baseUrl = getSupabaseUrl();
  if (!baseUrl || !hasSupabaseConfig()) return null;

  const accessToken = (await getValidAccessToken()) ?? fallbackToken ?? null;
  if (!accessToken) return null;

  const extraHeaders = (init.headers ?? {}) as Record<string, string>;
  const makeRequest = (bearer: string) =>
    fetchWithTimeout(
      `${baseUrl}${pathWithQuery}`,
      {
        ...init,
        headers: {
          ...buildSupabaseHeaders(bearer),
          ...extraHeaders,
        },
      },
      timeoutMs,
    );

  const response = await makeRequest(accessToken);
  if (response.status === 401) {
    const refreshed = await refreshAuthSession();
    if (!refreshed) return response;
    return makeRequest(refreshed.accessToken);
  }
  return response;
}

/**
 * GET /auth/me — Restaura a sessão validando `accessToken` e `refreshToken` no `SecureStore`
 * com verificação online no Supabase e fallback offline apenas quando o JWT ainda não expirou.
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

      if (response.status === 401 || response.status === 403) {
        const refreshed = await refreshAuthSession();
        if (refreshed) return refreshed;
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
      // Offline ou falha transitória: prossegue para validação estrita de expiração local
    }
  }

  // Se o accessToken local expirou, tenta renovar antes de invalidar a sessão
  if (!isTokenUnexpired(token)) {
    const refreshed = await refreshAuthSession();
    if (refreshed) return refreshed;
    await purgeLocalSession();
    return null;
  }

  const jwtPayload = decodeJwtPayload(token);
  const cachedUserRaw = await AsyncStorage.getItem(USER_CACHE_KEY);
  if (cachedUserRaw && jwtPayload?.sub) {
    try {
      const parsed: unknown = JSON.parse(cachedUserRaw);
      if (isValidAuthUser(parsed) && parsed.id === jwtPayload.sub) {
        return { user: parsed, accessToken: token };
      }
    } catch {
      // Ignora JSON inválido e limpa cache
    }
  }

  await purgeLocalSession();
  return null;
}

/**
 * DELETE /auth/session — Desloga a sessão no Supabase e remove tokens e caches locais do usuário.
 */
export async function clearAuthSession(): Promise<void> {
  const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  const baseUrl = getSupabaseUrl();
  if (token && baseUrl && SUPABASE_ANON_KEY) {
    try {
      await fetchWithTimeout(
        `${baseUrl}/auth/v1/logout?scope=global`,
        { method: 'POST', headers: buildSupabaseHeaders(token) },
        SESSION_RESTORE_TIMEOUT_MS,
      );
    } catch {
      // Prossegue com limpeza local mesmo se offline
    }
  }
  await purgeLocalSession();
}

/**
 * Limpa toda a sessão e os caches locais.
 */
export async function clearAllStoredAccounts(): Promise<void> {
  await clearAuthSession();
}
