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

const USERS_KEY = 'orliman_users';
const SESSION_KEY = 'orliman_session';

export function useLocalAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Load session on mount
  useEffect(() => {
    const sessionData = localStorage.getItem(SESSION_KEY);
    if (sessionData) {
      try {
        const user = JSON.parse(sessionData) as LocalUser;
        setAuthState({ user, isAuthenticated: true, isLoading: false });
      } catch {
        localStorage.removeItem(SESSION_KEY);
        setAuthState({ user: null, isAuthenticated: false, isLoading: false });
      }
    } else {
      setAuthState({ user: null, isAuthenticated: false, isLoading: false });
    }
  }, []);

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

  const signUp = useCallback(async (
    email: string, 
    password: string, 
    name: string,
    role: LocalUser['role'] = 'adv_export'
  ): Promise<{ error: string | null }> => {
    const users = getUsers();
    
    // Check if user already exists
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      return { error: 'Un compte existe déjà avec cet email' };
    }

    // Create new user (password stored as hash in real app, but for local demo we skip)
    const newUser: LocalUser = {
      id: crypto.randomUUID(),
      email: email.toLowerCase(),
      name,
      role,
      createdAt: new Date().toISOString(),
    };

    // Store password separately (in real app, use proper hashing)
    const userPasswords = JSON.parse(localStorage.getItem('orliman_passwords') || '{}');
    userPasswords[newUser.id] = password;
    localStorage.setItem('orliman_passwords', JSON.stringify(userPasswords));

    users.push(newUser);
    saveUsers(users);

    // Auto login
    localStorage.setItem(SESSION_KEY, JSON.stringify(newUser));
    setAuthState({ user: newUser, isAuthenticated: true, isLoading: false });

    return { error: null };
  }, [getUsers, saveUsers]);

  const signIn = useCallback(async (
    email: string, 
    password: string
  ): Promise<{ error: string | null }> => {
    const users = getUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      return { error: 'Email ou mot de passe incorrect' };
    }

    // Verify password
    const userPasswords = JSON.parse(localStorage.getItem('orliman_passwords') || '{}');
    if (userPasswords[user.id] !== password) {
      return { error: 'Email ou mot de passe incorrect' };
    }

    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    setAuthState({ user, isAuthenticated: true, isLoading: false });

    return { error: null };
  }, [getUsers]);

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
