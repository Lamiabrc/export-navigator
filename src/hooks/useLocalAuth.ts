import { useState, useEffect, useCallback } from "react";

export interface LocalUser {
  id: string;
  email: string;
  name: string;
  role: "direction" | "adv_export" | "logistique" | "finance" | "admin";
  createdAt: string;
}

interface AuthState {
  user: LocalUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const USERS_KEY = "mpl_users";
const SESSION_KEY = "mpl_session";
const PASSWORD_KEY = "mpl_passwords";

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

  useEffect(() => {
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
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, name: string, role: LocalUser["role"] = "adv_export") => {
      const normalizedEmail = email.trim().toLowerCase();
      const users = getUsers();
      if (users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
        return { error: "Compte deja existant." };
      }

      const newUser: LocalUser = {
        id: `local-${Date.now()}`,
        email: normalizedEmail,
        name: name || normalizedEmail.split("@")[0],
        role,
        createdAt: new Date().toISOString(),
      };

      saveUsers([...users, newUser]);
      const passwords = JSON.parse(localStorage.getItem(PASSWORD_KEY) || "{}");
      passwords[newUser.id] = password;
      localStorage.setItem(PASSWORD_KEY, JSON.stringify(passwords));
      localStorage.setItem(SESSION_KEY, JSON.stringify(newUser));
      setAuthState({ user: newUser, isAuthenticated: true, isLoading: false });
      return { error: null };
    },
    [getUsers, saveUsers]
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      const normalizedEmail = email.trim().toLowerCase();
      const users = getUsers();
      const user = users.find((u) => u.email.toLowerCase() === normalizedEmail);
      if (!user) return { error: "Compte introuvable." };

      const userPasswords = JSON.parse(localStorage.getItem(PASSWORD_KEY) || "{}");
      if (userPasswords[user.id] !== password) {
        return { error: "Email ou mot de passe incorrect." };
      }

      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      setAuthState({ user, isAuthenticated: true, isLoading: false });
      return { error: null };
    },
    [getUsers]
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
