import { useState, useEffect, useCallback } from 'react';

export interface LocalUser {
  id: string;
  email: string;
  name: string;
  role: 'direction' | 'adv_export' | 'logistique' | 'finance' | 'admin';
  createdAt: string;
}

interface AuthState {
  user: LocalUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const USERS_KEY = 'mpl_users';
const SESSION_KEY = 'mpl_session';
const PASSWORD_KEY = 'mpl_passwords';
const DEFAULT_USER: LocalUser = {
  id: 'lamia-admin',
  email: 'lamia.brechetighil@mpl.fr',
  name: 'Lamia Brechetighil',
  role: 'admin',
  createdAt: new Date('2024-01-01').toISOString(),
};
const DEFAULT_PASSWORD = 'MPL Conseil Export2025!';

export function useLocalAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  const getUsers = useCallback((): LocalUser[] => {
    const usersData = localStorage.getItem(USERS_KEY);
    if (usersData) {
      try {
        return JSON.parse(usersData);
      } catch {
        return [];
      }
    }
    return [];
  }, []);

  const saveUsers = useCallback((users: LocalUser[]) => {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }, []);

  const ensureDefaultUserExists = useCallback((): LocalUser => {
    const users = getUsers();
    const existing = users.find((u) => u.email === DEFAULT_USER.email);
    let targetUser = existing ?? { ...DEFAULT_USER, createdAt: new Date().toISOString() };

    if (!existing) {
      saveUsers([...users, targetUser]);
    }

    const passwords = JSON.parse(localStorage.getItem(PASSWORD_KEY) || '{}');
    if (!passwords[targetUser.id]) {
      passwords[targetUser.id] = DEFAULT_PASSWORD;
      localStorage.setItem(PASSWORD_KEY, JSON.stringify(passwords));
    }

    return targetUser;
  }, [getUsers, saveUsers]);

  // Load session on mount
  useEffect(() => {
    ensureDefaultUserExists();
    const sessionData = localStorage.getItem(SESSION_KEY);
    if (sessionData) {
      try {
        const user = JSON.parse(sessionData) as LocalUser;
        setAuthState({ user, isAuthenticated: true, isLoading: false });
        return;
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }
    }
    setAuthState({ user: null, isAuthenticated: false, isLoading: false });
  }, [ensureDefaultUserExists]);

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      _name: string,
      _role: LocalUser['role'] = 'adv_export'
    ): Promise<{ error: string | null }> => {
      if (email.toLowerCase() !== DEFAULT_USER.email) {
        return { error: 'La creation de compte est desactivee. Utilisez le compte administrateur.' };
      }

      const targetUser = ensureDefaultUserExists();
      const userPasswords = JSON.parse(localStorage.getItem(PASSWORD_KEY) || '{}');
      userPasswords[targetUser.id] = password;
      localStorage.setItem(PASSWORD_KEY, JSON.stringify(userPasswords));
      localStorage.setItem(SESSION_KEY, JSON.stringify(targetUser));
      setAuthState({ user: targetUser, isAuthenticated: true, isLoading: false });
      return { error: null };
    },
    [ensureDefaultUserExists]
  );

  const signIn = useCallback(
    async (email: string, password: string): Promise<{ error: string | null }> => {
      const normalizedEmail = email.toLowerCase();
      if (normalizedEmail !== DEFAULT_USER.email) {
        return { error: 'Acces reserve au compte administrateur MPL.' };
      }

      const user = ensureDefaultUserExists();
      const userPasswords = JSON.parse(localStorage.getItem(PASSWORD_KEY) || '{}');
      if (userPasswords[user.id] !== password) {
        return { error: 'Email ou mot de passe incorrect' };
      }

      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      setAuthState({ user, isAuthenticated: true, isLoading: false });

      return { error: null };
    },
    [ensureDefaultUserExists]
  );

  const signOut = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setAuthState({ user: null, isAuthenticated: false, isLoading: false });
  }, []);

  return {
    ...authState,
    signUp,
    signIn,
    signOut,
  };
}
