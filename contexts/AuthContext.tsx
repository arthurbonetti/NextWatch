import { createContext, PropsWithChildren, useContext, useMemo, useState } from 'react';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  signIn: (email: string) => void;
  signUp: (name: string, email: string) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    signIn: (email) => {
      const normalizedEmail = email.trim().toLowerCase();
      const localPart = normalizedEmail.split('@')[0] ?? normalizedEmail;
      const name = localPart.charAt(0).toLocaleUpperCase() + localPart.slice(1);
      setUser({ id: normalizedEmail, name, email: normalizedEmail });
    },
    signUp: (name, email) => {
      const normalizedEmail = email.trim().toLowerCase();
      setUser({
        id: normalizedEmail,
        name: name.trim(),
        email: normalizedEmail,
      });
    },
    signOut: () => setUser(null),
  }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
