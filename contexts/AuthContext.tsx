import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import {
  changeUserPassword,
  clearAuthSession,
  loginWithCredentials,
  onAuthStateChange,
  registerAccount,
  restoreAuthSession,
} from '@/services/authService';
import { queryClient } from '@/services/queryClient';
import { clearSubscriptionsLocalCache } from '@/services/subscriptionsLocalCache';
import {
  type AuthSession,
  type AuthStatus,
  type AuthUser,
  type UpdatePasswordPayload,
} from '@/types/auth';

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  status: AuthStatus;
  errorMessage: string | null;
  isConnected: boolean | null;
  authReady: boolean;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (name: string, email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  updatePassword: (payload: UpdatePasswordPayload) => Promise<void>;
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

  useEffect(() => {
    let active = true;

    const unsubscribeAuth = onAuthStateChange((event, session) => {
      if (!active) return;
      if (session) {
        setUser((prev) => mergeSessionUser(prev, session.user));
        setToken(session.accessToken);
        setStatus('success');
      } else if (event === 'SIGNED_OUT') {
        clearSubscriptionsLocalCache();
        queryClient.clear();
        setUser(null);
        setToken(null);
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
  }, []);

  const clearAuthError = useCallback(() => {
    setErrorMessage(null);
    setStatus((current) => (current === 'error' ? 'idle' : current));
  }, []);

  const runAuthAction = useCallback(async (action: () => Promise<AuthSession>, fallbackMessage: string) => {
    setStatus('loading');
    setErrorMessage(null);

    try {
      const session = await action();
      setUser((prev) => mergeSessionUser(prev, session.user));
      setToken(session.accessToken);
      setStatus('success');
      return true;
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : fallbackMessage);
      return false;
    }
  }, []);

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
    setErrorMessage(null);
    setStatus('idle');
  }, []);

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

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      status,
      errorMessage,
      isConnected,
      authReady,
      signIn,
      signUp,
      signOut,
      updatePassword,
      clearAuthError,
    }),
    [
      authReady,
      clearAuthError,
      errorMessage,
      isConnected,
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
