import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import {
  changeUserPassword,
  clearAuthSession,
  clearLocalAuthSessionOnly,
  loginWithCredentials,
  onAuthStateChange,
  registerAccount,
  requestPasswordReset,
  restoreAuthSession,
} from '@/services/authService';
import { queryClient } from '@/services/queryClient';
import {
  completePasswordRecovery as completePasswordRecoveryService,
  type RecoverySessionHandle,
} from '@/services/recoveryService';
import { clearSubscriptionsLocalCache } from '@/services/subscriptionsLocalCache';
import {
  type AuthSession,
  type AuthStatus,
  type AuthUser,
  type UpdatePasswordPayload,
} from '@/types/auth';

const RECOVERY_LOCK_STORAGE_KEY = 'nextwatch_password_recovery_lock';

function readPersistedRecoveryLock(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.sessionStorage) {
    return false;
  }
  try {
    return window.sessionStorage.getItem(RECOVERY_LOCK_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writePersistedRecoveryLock(locked: boolean): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.sessionStorage) {
    return;
  }
  try {
    if (locked) {
      window.sessionStorage.setItem(RECOVERY_LOCK_STORAGE_KEY, '1');
    } else {
      window.sessionStorage.removeItem(RECOVERY_LOCK_STORAGE_KEY);
    }
  } catch {
    // Ignora falha de acesso ao sessionStorage
  }
}

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  status: AuthStatus;
  errorMessage: string | null;
  isConnected: boolean | null;
  authReady: boolean;
  isPasswordRecovery: boolean;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (name: string, email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  updatePassword: (payload: UpdatePasswordPayload) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  beginPasswordRecoveryLock: () => void;
  cancelPasswordRecovery: () => Promise<void>;
  completePasswordRecovery: (newPassword: string, handle?: RecoverySessionHandle | null) => Promise<void>;
  clearAuthError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function mergeSessionUser(previous: AuthUser | null, incoming: AuthUser): AuthUser {
  if (
    previous &&
    previous.id === incoming.id &&
    previous.name === incoming.name &&
    previous.email === incoming.email &&
    previous.createdAt === incoming.createdAt
  ) {
    return previous;
  }
  return incoming;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const { isConnected } = useNetworkStatus();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<AuthStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(() => readPersistedRecoveryLock());

  const setRecoveryLocked = useCallback((locked: boolean) => {
    writePersistedRecoveryLock(locked);
    setIsPasswordRecovery(locked);
  }, []);

  useEffect(() => {
    let active = true;

    const unsubscribeAuth = onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryLocked(true);
      }
      if (session) {
        setUser((prev) => mergeSessionUser(prev, session.user));
        setToken(session.accessToken);
        setStatus('success');
      } else if (event === 'SIGNED_OUT') {
        clearSubscriptionsLocalCache();
        queryClient.clear();
        setUser(null);
        setToken(null);
        setRecoveryLocked(false);
        setStatus('idle');
      }
    });

    restoreAuthSession()
      .then((session) => {
        if (!active) return;
        if (session) {
          setUser((prev) => mergeSessionUser(prev, session.user));
          setToken(session.accessToken);
          setStatus('success');
        } else {
          setRecoveryLocked(false);
          setStatus('idle');
        }
      })
      .catch(() => {
        if (active) setStatus('idle');
      })
      .finally(() => {
        if (active) setAuthReady(true);
      });

    return () => {
      active = false;
      unsubscribeAuth();
    };
  }, [setRecoveryLocked]);

  const clearAuthError = useCallback(() => {
    setErrorMessage(null);
    setStatus((current) => (current === 'error' ? 'idle' : current));
  }, []);

  const runAuthAction = useCallback(
    async (action: () => Promise<AuthSession>, fallbackMessage: string) => {
      setStatus('loading');
      setErrorMessage(null);

      try {
        const session = await action();
        setRecoveryLocked(false);
        setUser((prev) => mergeSessionUser(prev, session.user));
        setToken(session.accessToken);
        setStatus('success');
        return true;
      } catch (error) {
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : fallbackMessage);
        return false;
      }
    },
    [setRecoveryLocked],
  );

  const signIn = useCallback(
    (email: string, password: string) =>
      runAuthAction(
        () => loginWithCredentials({ email, password }),
        'Não foi possível autenticar. Verifique sua conexão e tente novamente.',
      ),
    [runAuthAction],
  );

  const signUp = useCallback(
    (name: string, email: string, password: string) =>
      runAuthAction(
        () => registerAccount({ name, email, password }),
        'Não foi possível criar sua conta. Tente novamente.',
      ),
    [runAuthAction],
  );

  const signOut = useCallback(async () => {
    clearSubscriptionsLocalCache();
    queryClient.clear();
    await clearAuthSession();
    clearSubscriptionsLocalCache();
    queryClient.clear();
    setUser(null);
    setToken(null);
    setRecoveryLocked(false);
    setErrorMessage(null);
    setStatus('idle');
  }, [setRecoveryLocked]);

  const updatePassword = useCallback(
    async (payload: UpdatePasswordPayload) => {
      if (!user) {
        throw new Error('Sua sessão expirou. Faça login novamente.');
      }
      await changeUserPassword({
        email: user.email,
        currentPassword: payload.currentPassword,
        newPassword: payload.newPassword,
      });
    },
    [user],
  );

  const sendPasswordReset = useCallback(async (email: string) => {
    await requestPasswordReset(email);
  }, []);

  const beginPasswordRecoveryLock = useCallback(() => {
    setRecoveryLocked(true);
  }, [setRecoveryLocked]);

  const cancelPasswordRecovery = useCallback(async () => {
    const hadRecoveryLock = isPasswordRecovery || readPersistedRecoveryLock();
    setRecoveryLocked(false);
    if (hadRecoveryLock) {
      clearSubscriptionsLocalCache();
      queryClient.clear();
      await clearLocalAuthSessionOnly();
      setUser(null);
      setToken(null);
      setErrorMessage(null);
      setStatus('idle');
    }
  }, [isPasswordRecovery, setRecoveryLocked]);

  const completePasswordRecovery = useCallback(
    async (newPassword: string, handle?: RecoverySessionHandle | null) => {
      await completePasswordRecoveryService(newPassword, handle);
      clearSubscriptionsLocalCache();
      queryClient.clear();
      setRecoveryLocked(false);
      setUser(null);
      setToken(null);
      setErrorMessage(null);
      setStatus('idle');
    },
    [setRecoveryLocked],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      status,
      errorMessage,
      isConnected,
      authReady,
      isPasswordRecovery,
      signIn,
      signUp,
      signOut,
      updatePassword,
      sendPasswordReset,
      beginPasswordRecoveryLock,
      cancelPasswordRecovery,
      completePasswordRecovery,
      clearAuthError,
    }),
    [
      authReady,
      beginPasswordRecoveryLock,
      cancelPasswordRecovery,
      clearAuthError,
      completePasswordRecovery,
      errorMessage,
      isConnected,
      isPasswordRecovery,
      sendPasswordReset,
      signIn,
      signOut,
      signUp,
      status,
      token,
      updatePassword,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
