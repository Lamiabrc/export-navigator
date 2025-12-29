import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
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
    // charge la session au démarrage + écoute les changements
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
      setIsLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setIsLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      session,
      isAuthenticated: !!session,
      isLoading,

      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password }); // :contentReference[oaicite:1]{index=1}
        return { error: error ? error.message : null };
      },

      async signOut() {
        await supabase.auth.signOut();
      },

      async sendPasswordLink(email) {
        const redirectTo = `${window.location.origin}/set-password`;
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo }); // :contentReference[oaicite:2]{index=2}
        return { error: error ? error.message : null };
      },

      async setPassword(newPassword) {
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
