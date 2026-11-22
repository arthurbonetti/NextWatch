import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  AuthSession as SupabaseAuthSession,
  AuthUser as SupabaseAuthUser,
  SupabaseClient,
} from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { upsertUserProfile } from '@/services/repositories/profileRepo';
import {
  createEphemeralRecoveryClient,
  migrateLegacySupabaseSession,
  purgeLegacyAuthTokens,
  supabase,
} from '@/services/supabase';
import { formatRecoveryLinkError, type RecoveryUrlParams } from '@/utils/recoveryUrl';
import {
  type AuthSession,
  type AuthUser,
  isStrongPassword,
  isValidEmail,
  type LoginCredentials,
  MAX_NAME_LENGTH,
  MAX_PASSWORD_LENGTH,
  MIN_LOGIN_PASSWORD_LENGTH,
  MIN_NAME_LENGTH,
  MIN_PASSWORD_LENGTH,
  type RegisterPayload,
} from '@/types/auth';

export type AuthChangeEvent = Parameters<Parameters<SupabaseClient['auth']['onAuthStateChange']>[0]>[0];

const APP_STORAGE_PREFIX = '@nextwatch/';
const PRESERVED_STORAGE_KEYS = new Set(['@nextwatch/theme-mode']);

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
  if (lower.includes('same_password') || lower.includes('different from the old password')) {
    return 'A nova senha deve ser diferente da senha atual.';
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

async function purgeLocalStorageCaches(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const appKeys = keys.filter(
      (key) => key.startsWith(APP_STORAGE_PREFIX) && !PRESERVED_STORAGE_KEYS.has(key),
    );
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
    normalizedName.length < MIN_NAME_LENGTH ||
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

  const session = data.session
    ? toAuthSession(data.session, normalizedEmail, normalizedName)
    : await signInInternal(normalizedEmail, password, false);

  void upsertUserProfile(session.user.id, {
    displayName: normalizedName,
    avatarType: 'initials',
    avatarPreset: null,
    avatarPath: null,
  }).catch(() => {});

  return session;
}

export async function updateAuthDisplayName(name: string): Promise<void> {
  if (!supabase) {
    throw new Error('Serviço de autenticação não configurado corretamente.');
  }

  const normalizedName = name.trim().slice(0, MAX_NAME_LENGTH);
  if (normalizedName.length < MIN_NAME_LENGTH) {
    throw new Error(`Informe seu nome (pelo menos ${MIN_NAME_LENGTH} caracteres).`);
  }

  const { error } = await supabase.auth.updateUser({
    data: { name: normalizedName },
  });

  if (error) {
    throw new Error(formatSupabaseError(error.message));
  }
}

export async function changeUserPassword({
  email,
  currentPassword,
  newPassword,
}: {
  email: string;
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  if (!supabase) {
    throw new Error('Serviço de autenticação não configurado corretamente.');
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (
    !isValidEmail(normalizedEmail) ||
    currentPassword.length < MIN_LOGIN_PASSWORD_LENGTH ||
    currentPassword.length > MAX_PASSWORD_LENGTH
  ) {
    throw new Error('Informe sua senha atual corretamente.');
  }

  if (!isStrongPassword(newPassword)) {
    throw new Error(
      `A nova senha deve ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres com letras e números.`,
    );
  }

  if (newPassword === currentPassword) {
    throw new Error('A nova senha deve ser diferente da senha atual.');
  }

  checkAuthRateLimit();

  const { data: verifyData, error: verifyError } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password: currentPassword,
  });

  if (verifyError || !verifyData.session) {
    throw new Error('Senha atual incorreta. Verifique e tente novamente.');
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
    current_password: currentPassword,
  });

  if (updateError) {
    throw new Error(formatSupabaseError(updateError.message));
  }
}

function getPasswordResetRedirectUrl(): string | undefined {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${window.location.origin}/reset-password`;
    }
    return undefined;
  }
  return Linking.createURL('reset-password');
}

export async function requestPasswordReset(email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!isValidEmail(normalizedEmail)) {
    throw new Error('Informe um e-mail válido.');
  }
  if (!supabase) {
    throw new Error('Serviço de autenticação não configurado corretamente.');
  }

  checkAuthRateLimit();

  const redirectTo = getPasswordResetRedirectUrl();
  const { error } = await supabase.auth.resetPasswordForEmail(
    normalizedEmail,
    redirectTo ? { redirectTo } : undefined,
  );

  if (error) {
    throw new Error(formatSupabaseError(error.message));
  }
}

const EXPIRED_RECOVERY_LINK_MESSAGE =
  'Este link de recuperação expirou ou já foi utilizado. Solicite um novo envio na tela de login.';
const RECOVERY_TIMEOUT_MS = 15_000;
const RECOVERY_TIMEOUT_MESSAGE =
  'Tempo esgotado ao validar o link. Verifique sua conexão e tente novamente.';

function withRecoveryTimeout<T>(promise: Promise<T>, timeoutMs = RECOVERY_TIMEOUT_MS): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('RECOVERY_TIMEOUT'));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  });
}

export type RecoverySessionHandle =
  | {
      kind: 'ephemeral';
      client: SupabaseClient;
      accessToken?: string;
      refreshToken?: string;
      sessionEstablished: boolean;
    }
  | {
      kind: 'main-recovery';
    };

export type PrepareRecoveryResult =
  | { ok: true; handle: RecoverySessionHandle }
  | { ok: false; errorMessage: string };

/**
 * Valida o link de recuperação de senha SEM autenticar o usuário no cliente principal.
 * Para fluxo implícito (#access_token/#refresh_token) e token_hash, tudo roda em um cliente
 * efêmero isolado (`persistSession: false`), evitando entrada indevida no app antes da troca.
 */
export async function validateAndPrepareRecoverySession(
  params: RecoveryUrlParams,
  options?: { allowExistingRecoverySession?: boolean; onRequireMainRecoveryLock?: () => void },
): Promise<PrepareRecoveryResult> {
  const linkError = formatRecoveryLinkError(params);
  if (linkError) {
    return { ok: false, errorMessage: linkError };
  }

  if (!supabase) {
    return { ok: false, errorMessage: 'Serviço de autenticação não configurado corretamente.' };
  }

  const ephemeralClient = createEphemeralRecoveryClient();
  if (!ephemeralClient) {
    return { ok: false, errorMessage: 'Serviço de autenticação não configurado corretamente.' };
  }

  try {
    const accessToken = params.accessToken?.trim();
    const refreshToken = params.refreshToken?.trim();
    if (accessToken && refreshToken) {
      const { data, error } = await withRecoveryTimeout(ephemeralClient.auth.getUser(accessToken));
      if (!error && data.user) {
        return {
          ok: true,
          handle: {
            kind: 'ephemeral',
            client: ephemeralClient,
            accessToken,
            refreshToken,
            sessionEstablished: false,
          },
        };
      }
      return { ok: false, errorMessage: EXPIRED_RECOVERY_LINK_MESSAGE };
    }

    const tokenHash = params.tokenHash?.trim();
    if (tokenHash) {
      const { data, error } = await withRecoveryTimeout(
        ephemeralClient.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'recovery',
        }),
      );
      if (!error && data.session) {
        return {
          ok: true,
          handle: {
            kind: 'ephemeral',
            client: ephemeralClient,
            sessionEstablished: true,
          },
        };
      }
      return { ok: false, errorMessage: EXPIRED_RECOVERY_LINK_MESSAGE };
    }

    const code = params.code?.trim();
    if (code) {
      options?.onRequireMainRecoveryLock?.();
      const { data, error } = await withRecoveryTimeout(supabase.auth.exchangeCodeForSession(code));
      if (!error && data.session) {
        return {
          ok: true,
          handle: { kind: 'main-recovery' },
        };
      }
      return { ok: false, errorMessage: EXPIRED_RECOVERY_LINK_MESSAGE };
    }

    if (options?.allowExistingRecoverySession) {
      const { data } = await withRecoveryTimeout(supabase.auth.getSession());
      if (data.session) {
        return { ok: true, handle: { kind: 'main-recovery' } };
      }
    }

    return { ok: false, errorMessage: EXPIRED_RECOVERY_LINK_MESSAGE };
  } catch (error) {
    if (error instanceof Error && error.message === 'RECOVERY_TIMEOUT') {
      return { ok: false, errorMessage: RECOVERY_TIMEOUT_MESSAGE };
    }
    return { ok: false, errorMessage: EXPIRED_RECOVERY_LINK_MESSAGE };
  }
}

export async function completePasswordRecovery(
  newPassword: string,
  handle?: RecoverySessionHandle | null,
): Promise<void> {
  if (!supabase) {
    throw new Error('Serviço de autenticação não configurado corretamente.');
  }
  if (!isStrongPassword(newPassword)) {
    throw new Error(
      `A nova senha deve ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres com letras e números.`,
    );
  }

  if (handle?.kind === 'ephemeral') {
    if (!handle.sessionEstablished) {
      if (!handle.accessToken || !handle.refreshToken) {
        throw new Error(EXPIRED_RECOVERY_LINK_MESSAGE);
      }
      const { data: sessionData, error: sessionError } = await handle.client.auth.setSession({
        access_token: handle.accessToken,
        refresh_token: handle.refreshToken,
      });
      if (sessionError || !sessionData.session) {
        throw new Error(EXPIRED_RECOVERY_LINK_MESSAGE);
      }
      handle.sessionEstablished = true;
      handle.accessToken = sessionData.session.access_token;
      handle.refreshToken = sessionData.session.refresh_token;
    }

    const { error } = await handle.client.auth.updateUser({
      password: newPassword,
    });
    if (error) {
      throw new Error(formatSupabaseError(error.message));
    }

    await handle.client.auth.signOut({ scope: 'local' }).catch(() => {});
    await clearLocalAuthSessionOnly();
    return;
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    throw new Error(formatSupabaseError(error.message));
  }

  await clearLocalAuthSessionOnly();
}

export async function clearLocalAuthSessionOnly(): Promise<void> {
  if (supabase) {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // Ignora erro ao encerrar sessão local
    }
  }
  await purgeLegacyAuthTokens();
  await purgeLocalStorageCaches();
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

  const migratedSession = await migrateLegacySupabaseSession();
  if (migratedSession?.user) {
    return toAuthSession(migratedSession);
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
  await purgeLegacyAuthTokens();
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
