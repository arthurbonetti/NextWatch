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

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';

const ACCESS_TOKEN_KEY = 'accessToken';
const USER_CACHE_KEY = '@nextwatch/auth-user';
const REQUEST_TIMEOUT_MS = 10000;

function buildSupabaseHeaders(token?: string | null): Record<string, string> {
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

function formatSupabaseError(errorMsg?: string): string {
  if (!errorMsg) return 'Erro ao comunicar com o servidor de autenticação.';
  const lower = errorMsg.toLowerCase();
  if (lower.includes('invalid login credentials') || lower.includes('invalid_grant')) {
    return 'E-mail ou senha incorretos. Verifique suas credenciais.';
  }
  if (lower.includes('user already registered') || lower.includes('already exists')) {
    return 'Este e-mail já está cadastrado. Faça login com sua senha.';
  }
  if (lower.includes('password should be at least')) {
    return 'A senha deve conter no mínimo 6 caracteres.';
  }
  if (lower.includes('email not confirmed')) {
    return 'E-mail ainda não confirmado. Verifique as configurações de autenticação no Supabase.';
  }
  return errorMsg;
}

/**
 * POST /auth/login — Autentica o usuário no Supabase Auth via REST API.
 * Salva o `accessToken` via `SecureStore` (conforme exigido na disciplina) e o perfil em `AsyncStorage`.
 */
export async function loginWithCredentials({ email, password }: LoginCredentials): Promise<AuthSession> {
  const normalizedEmail = email.trim().toLowerCase();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
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

    const session: AuthSession = {
      user: {
        id: data.user.id,
        name: data.user.user_metadata?.name || normalizedEmail.split('@')[0],
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
  const normalizedName = name.trim();
  const normalizedEmail = email.trim().toLowerCase();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'GET',
      headers: buildSupabaseHeaders(token),
      signal: controller.signal,
    });

    if (response.ok) {
      const userObj = (await response.json()) as {
        id: string;
        email?: string;
        created_at?: string;
        user_metadata?: { name?: string };
      };

      if (userObj?.id) {
        const user: AuthUser = {
          id: userObj.id,
          name: userObj.user_metadata?.name || userObj.email?.split('@')[0] || 'Usuário',
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

  const cachedUserRaw = await AsyncStorage.getItem(USER_CACHE_KEY);
  if (cachedUserRaw) {
    try {
      const cachedUser = JSON.parse(cachedUserRaw) as AuthUser;
      if (cachedUser?.id && cachedUser?.email) {
        return { user: cachedUser, accessToken: token };
      }
    } catch {
      // Ignora erro de JSON
    }
  }

  return null;
}

/**
 * DELETE /auth/session — Desloga a sessão atual no Supabase e remove o token do `SecureStore`.
 */
export async function clearAuthSession(): Promise<void> {
  const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  if (token) {
    try {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: buildSupabaseHeaders(token),
      });
    } catch {
      // Prossegue mesmo se estiver offline
    }
  }
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await AsyncStorage.removeItem(USER_CACHE_KEY);
}

/**
 * Limpa toda a sessão localmente.
 */
export async function clearAllStoredAccounts(): Promise<void> {
  await clearAuthSession();
}
