import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { isAvatarPresetId } from '@/constants/avatars';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import {
  changeUserPassword,
  clearAuthSession,
  loginWithCredentials,
  onAuthStateChange,
  registerAccount,
  restoreAuthSession,
  updateAuthDisplayName,
} from '@/services/authService';
import { queryClient } from '@/services/queryClient';
import {
  deleteCustomAvatar,
  fetchUserProfile,
  readCachedUserProfile,
  uploadCustomAvatar,
  upsertUserProfile,
  type UserProfileRecord,
  writeCachedUserProfile,
} from '@/services/repositories/profileRepo';
import { clearSubscriptionsLocalCache } from '@/services/subscriptionsLocalCache';
import {
  type AuthSession,
  type AuthStatus,
  type AuthUser,
  MAX_NAME_LENGTH,
  MIN_NAME_LENGTH,
  type UpdatePasswordPayload,
  type UpdateProfilePayload,
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
  updateProfile: (payload: UpdateProfilePayload) => Promise<void>;
  updatePassword: (payload: UpdatePasswordPayload) => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearAuthError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function mergeSessionUser(previous: AuthUser | null, incoming: AuthUser): AuthUser {
  if (!previous || previous.id !== incoming.id) {
    return incoming;
  }
  return {
    ...incoming,
    name: previous.name || incoming.name,
    avatarType: previous.avatarType,
    avatarPreset: previous.avatarPreset,
    avatarPath: previous.avatarPath,
    avatarUrl: previous.avatarUrl,
  };
}

function applyProfileToUser(current: AuthUser | null, profile: UserProfileRecord): AuthUser | null {
  if (!current || current.id !== profile.userId) {
    return current;
  }
  return {
    ...current,
    name: profile.displayName || current.name,
    avatarType: profile.avatarType,
    avatarPreset: profile.avatarPreset,
    avatarPath: profile.avatarPath,
    avatarUrl: profile.avatarUrl,
  };
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

  const currentUserId = user?.id ?? null;

  useEffect(() => {
    if (!currentUserId) return;
    let active = true;

    void readCachedUserProfile(currentUserId).then((cached) => {
      if (!active || !cached) return;
      setUser((prev) => applyProfileToUser(prev, cached));
    });

    void fetchUserProfile(currentUserId).then((remote) => {
      if (!active || !remote) return;
      setUser((prev) => applyProfileToUser(prev, remote));
      void writeCachedUserProfile(currentUserId, remote);
    });

    return () => {
      active = false;
    };
  }, [currentUserId]);

  const refreshProfile = useCallback(async () => {
    if (!currentUserId) return;
    const remote = await fetchUserProfile(currentUserId);
    if (!remote) return;
    setUser((prev) => applyProfileToUser(prev, remote));
    await writeCachedUserProfile(currentUserId, remote);
  }, [currentUserId]);

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

  const updateProfile = useCallback(
    async (payload: UpdateProfilePayload) => {
      if (!user) {
        throw new Error('Sua sessão expirou. Faça login novamente.');
      }

      const normalizedName = payload.name.trim().slice(0, MAX_NAME_LENGTH);
      if (normalizedName.length < MIN_NAME_LENGTH) {
        throw new Error(`Informe um nome com pelo menos ${MIN_NAME_LENGTH} caracteres.`);
      }

      const previousPath = user.avatarPath;
      let nextType = payload.avatarType;
      let nextPreset = payload.avatarPreset;
      let nextPath: string | null = null;
      let newlyUploadedPath: string | null = null;

      if (nextType === 'custom') {
        if (payload.pendingUpload) {
          const uploaded = await uploadCustomAvatar(user.id, payload.pendingUpload);
          newlyUploadedPath = uploaded.path;
          nextPath = uploaded.path;
          nextPreset = null;
        } else if (previousPath) {
          nextPath = previousPath;
          nextPreset = null;
        } else {
          throw new Error('Selecione uma imagem para fazer upload.');
        }
      } else if (nextType === 'preset') {
        if (!isAvatarPresetId(nextPreset)) {
          throw new Error('Selecione um ícone válido.');
        }
        nextPath = null;
      } else {
        nextType = 'initials';
        nextPreset = null;
        nextPath = null;
      }

      let savedProfile: UserProfileRecord;
      try {
        savedProfile = await upsertUserProfile(user.id, {
          displayName: normalizedName,
          avatarType: nextType,
          avatarPreset: nextPreset,
          avatarPath: nextPath,
        });
      } catch (error) {
        if (newlyUploadedPath) {
          await deleteCustomAvatar(newlyUploadedPath);
        }
        throw error;
      }

      if (previousPath && previousPath !== savedProfile.avatarPath) {
        void deleteCustomAvatar(previousPath);
      }

      setUser((prev) => applyProfileToUser(prev, savedProfile));
      await writeCachedUserProfile(user.id, savedProfile);

      if (normalizedName !== user.name) {
        await updateAuthDisplayName(normalizedName).catch(() => {});
      }
    },
    [user],
  );

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
      updateProfile,
      updatePassword,
      refreshProfile,
      clearAuthError,
    }),
    [
      authReady,
      clearAuthError,
      errorMessage,
      isConnected,
      refreshProfile,
      signIn,
      signOut,
      signUp,
      status,
      token,
      updatePassword,
      updateProfile,
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
