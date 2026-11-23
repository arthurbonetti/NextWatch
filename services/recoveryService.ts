import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import {
  createEphemeralRecoveryClient,
  purgeLegacyAuthTokens,
  supabase,
} from '@/services/supabase';
import { isStrongPassword, MIN_PASSWORD_LENGTH } from '@/types/auth';
import { formatRecoveryLinkError, type RecoveryUrlParams } from '@/utils/recoveryUrl';

const APP_STORAGE_PREFIX = '@nextwatch/';
const PRESERVED_STORAGE_KEYS = new Set(['@nextwatch/theme-mode']);

const EXPIRED_RECOVERY_LINK_MESSAGE =
  'Este link de recuperação expirou ou já foi utilizado. Solicite um novo envio na tela de login.';
const RECOVERY_TIMEOUT_MS = 15_000;
const RECOVERY_TIMEOUT_MESSAGE =
  'Tempo esgotado ao validar o link. Verifique sua conexão e tente novamente.';

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

function formatRecoveryPasswordError(errorMsg?: string): string {
  if (!errorMsg) return 'Erro ao comunicar com o servidor de autenticação.';
  const lower = errorMsg.toLowerCase();
  if (lower.includes('same_password') || lower.includes('different from the old password')) {
    return 'A nova senha deve ser diferente da senha atual.';
  }
  if (lower.includes('password should be at least') || lower.includes('weak_password')) {
    return `A senha deve conter no mínimo ${MIN_PASSWORD_LENGTH} caracteres com letras e números.`;
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Muitas solicitações. Aguarde alguns instantes e tente novamente.';
  }
  return 'Não foi possível concluir a autenticação. Verifique os dados e tente novamente.';
}

async function clearLocalRecoverySession(): Promise<void> {
  if (supabase) {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // Ignora erro ao encerrar sessão local
    }
  }
  await purgeLegacyAuthTokens();
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

export function getPasswordResetRedirectUrl(): string | undefined {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${window.location.origin}/reset-password`;
    }
    return undefined;
  }
  return Linking.createURL('reset-password');
}

export function withRecoveryTimeout<T>(
  promise: Promise<T>,
  timeoutMs = RECOVERY_TIMEOUT_MS,
): Promise<T> {
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
      throw new Error(formatRecoveryPasswordError(error.message));
    }

    await handle.client.auth.signOut({ scope: 'local' }).catch(() => {});
    await clearLocalRecoverySession();
    return;
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    throw new Error(formatRecoveryPasswordError(error.message));
  }

  await clearLocalRecoverySession();
}
