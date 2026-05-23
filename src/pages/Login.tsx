import { FormEvent, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, LockKeyhole, ShieldCheck } from "lucide-react";

import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";
import { isAdminUser } from "@/lib/authz";

const ADMIN_EMAIL = "sabullelam@gmail.com";

function getErrorMessage(err: unknown): string {
  if (!err) return "Une erreur inconnue est survenue.";
  let msg = "";
  if (typeof err === "string") msg = err;
  else if (err instanceof Error) msg = err.message;
  else {
    const anyErr = err as { message?: string };
    if (typeof anyErr?.message === "string") msg = anyErr.message;
  }
  msg = msg.trim();
  return msg || "Une erreur est survenue. Reessaie.";
}

function safeNextPath(candidate: unknown, fallback = "/app/control-tower") {
  const v = typeof candidate === "string" ? candidate : "";
  if (!v || !v.startsWith("/")) return fallback;
  if (v === "/" || v === "/login" || v === "/register") return fallback;
  return v;
}

export default function Login() {
  const { signIn, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const envMissing = !SUPABASE_ENV_OK;

  const nextPath = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const qNext = params.get("next");
    const stateAny = location.state as { from?: { pathname?: string; search?: string }; next?: string } | null;
    const stateFromPath = stateAny?.from?.pathname;
    const stateFromSearch = stateAny?.from?.search || "";
    const stateNext = stateAny?.next;
    if (qNext) return safeNextPath(qNext, "/app/control-tower");
    if (stateFromPath) return safeNextPath(`${stateFromPath}${stateFromSearch}`, "/app/control-tower");
    if (stateNext) return safeNextPath(stateNext, "/app/control-tower");
    return "/app/control-tower";
  }, [location.search, location.state]);

  const denied = new URLSearchParams(location.search).get("denied") === "admin";

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail !== ADMIN_EMAIL) {
      setError(`Acces reserve au compte administrateur ${ADMIN_EMAIL}.`);
      return;
    }
    if (!password) {
      setError("Merci de renseigner le mot de passe administrateur.");
      return;
    }

    try {
      setPending(true);
      const { error: err, userId } = await signIn(normalizedEmail, password);
      if (err) {
        setError(getErrorMessage(err).trim() || "Connexion administrateur impossible.");
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!userId || !isAdminUser(data.session?.user)) {
        await supabase.auth.signOut().catch(() => undefined);
        setError(`Acces refuse. Seul ${ADMIN_EMAIL} peut ouvrir l'espace administrateur.`);
        return;
      }

      navigate(nextPath, { replace: true });
    } catch (e2) {
      setError(getErrorMessage(e2));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="min-h-screen grid bg-slate-950 text-slate-50 lg:grid-cols-2">
      <div className="relative hidden lg:block">
        <img src="/login-hero.svg" alt="Illustration" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-black/65 via-black/45 to-slate-900/75" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="space-y-4 px-10 text-center">
            <p className="font-semibold uppercase tracking-[0.3em] text-emerald-200">MPL Export Navigator</p>
            <h2 className="text-4xl font-bold text-white drop-shadow-lg">Acces administrateur</h2>
            <p className="mx-auto max-w-xl text-slate-100/80">
              Publication des annonces, analyse des opportunites et pilotage de l'accompagnement import-export France-Maghreb.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-6">
          <BrandLogo
            className="flex items-center gap-3"
            imageClassName="h-11 drop-shadow-lg"
            titleClassName="text-base font-semibold text-white"
            subtitleClassName="text-sm text-slate-200/80"
          />

          <Card className="border-slate-800 bg-slate-900/80 text-slate-50 shadow-xl shadow-emerald-500/10">
            <CardHeader className="space-y-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-100">
                <LockKeyhole className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Connexion administrateur</CardTitle>
                <CardDescription className="mt-2 text-slate-300">
                  Acces reserve au compte {ADMIN_EMAIL}.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent>
              <form className="space-y-4" onSubmit={onSubmit}>
                {envMissing && (
                  <div className="rounded-xl border border-amber-700/60 bg-amber-900/40 px-3 py-2 text-xs text-amber-200">
                    Connexion indisponible: variables Supabase manquantes en production.
                  </div>
                )}

                {denied && (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-700/60 bg-amber-900/40 px-3 py-2 text-sm text-amber-200">
                    <ShieldCheck className="mt-0.5 h-4 w-4" />
                    <span>Cette zone est reservee a l'administrateur MPL.</span>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm text-slate-200">Email administrateur</label>
                  <Input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    className="border-slate-800 bg-slate-950 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-slate-200">Mot de passe</label>
                  <Input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="********"
                    autoComplete="current-password"
                    className="border-slate-800 bg-slate-950 text-white"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => navigate("/forgot-password")}
                  className="text-sm text-emerald-200 hover:underline"
                >
                  Mot de passe oublie
                </button>

                {error && (
                  <div className="flex items-start gap-2 rounded-xl border border-red-800/70 bg-red-900/30 px-3 py-2 text-sm text-red-300">
                    <AlertCircle className="mt-0.5 h-4 w-4" />
                    <span>{error}</span>
                  </div>
                )}

                <Button type="submit" className="h-11 w-full font-semibold" disabled={pending || isLoading || envMissing}>
                  {pending || isLoading ? "Connexion..." : "Ouvrir l'espace admin"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="text-center text-sm text-slate-400">
            Besoin d'accompagnement import-export ?{" "}
            <button className="text-emerald-200 hover:underline" onClick={() => navigate("/contact")}>
              Aller au contact
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
