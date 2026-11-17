import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import {
  type AuthStatus,
  type AuthUser,
  clearAuthSession,
  loginWithCredentials,
  registerAccount,
  restoreAuthSession,
} from '@/services/authApi';

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
  clearAuthError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const { isConnected } = useNetworkStatus();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<AuthStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let active = true;

    restoreAuthSession()
      .then((session) => {
        if (!active) return;
        if (session) {
          setUser(session.user);
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
    };
  }, []);

  const clearAuthError = useCallback(() => {
    setErrorMessage(null);
    setStatus((current) => (current === 'error' ? 'idle' : current));
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<boolean> => {
    setStatus('loading');
    setErrorMessage(null);

    try {
      const session = await loginWithCredentials({ email, password });
      setUser(session.user);
      setToken(session.accessToken);
      setStatus('success');
      return true;
    } catch (error) {
      setStatus('error');
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível autenticar. Verifique sua conexão e tente novamente.',
      );
      return false;
    }
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string): Promise<boolean> => {
    setStatus('loading');
    setErrorMessage(null);

    try {
      const session = await registerAccount({ name, email, password });
      setUser(session.user);
      setToken(session.accessToken);
      setStatus('success');
      return true;
    } catch (error) {
      setStatus('error');
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível criar sua conta. Tente novamente.',
      );
      return false;
    }
  }, []);

  const signOut = useCallback(async () => {
    await clearAuthSession();
    setUser(null);
    setToken(null);
    setErrorMessage(null);
    setStatus('idle');
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    token,
    status,
    errorMessage,
    isConnected,
    authReady,
    signIn,
    signUp,
    signOut,
    clearAuthError,
  }), [authReady, clearAuthError, errorMessage, isConnected, signIn, signOut, signUp, status, token, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
