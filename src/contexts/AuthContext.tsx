import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  sendPasswordLink: (email: string) => Promise<{ error: string | null }>;
  setPassword: (newPassword: string) => Promise<{ error: string | null }>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    const init = async () => {
      try {
        if (!SUPABASE_ENV_OK) {
          if (!alive) return;
          setSession(null);
          setUser(null);
          setIsLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.getSession();
        if (!alive) return;

        if (error) {
          setSession(null);
          setUser(null);
        } else {
          setSession(data.session ?? null);
          setUser(data.session?.user ?? null);
        }

        setIsLoading(false);
      } catch {
        if (!alive) return;
        setSession(null);
        setUser(null);
        setIsLoading(false);
      }
    };

    void init();

    if (!SUPABASE_ENV_OK) {
      return () => {
        alive = false;
      };
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!alive) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setIsLoading(false);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      session,
      isAuthenticated: !!session?.user,
      isLoading,

      async signUp(email, password) {
        if (!SUPABASE_ENV_OK) return { error: "Supabase non configure." };
        const { error } = await supabase.auth.signUp({ email, password });
        return { error: error ? error.message : null };
      },

      async signIn(email, password) {
        if (!SUPABASE_ENV_OK) return { error: "Supabase non configure." };
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error ? error.message : null };
      },

      async signOut() {
        if (!SUPABASE_ENV_OK) return;
        await supabase.auth.signOut();
      },

      async sendPasswordLink(email) {
        if (!SUPABASE_ENV_OK) return { error: "Supabase non configure." };
        const redirectTo = `${window.location.origin}/set-password`;
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
        return { error: error ? error.message : null };
      },

      async setPassword(newPassword) {
        if (!SUPABASE_ENV_OK) return { error: "Supabase non configure." };
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        return { error: error ? error.message : null };
      },
    }),
    [user, session, isLoading]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
