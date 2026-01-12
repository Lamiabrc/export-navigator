import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandLogo } from "@/components/BrandLogo";

function getErrorMessage(err: unknown): string {
  if (!err) return "Une erreur inconnue est survenue.";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyErr = err as any;
  if (typeof anyErr?.message === "string") return anyErr.message;
  return "Une erreur est survenue. Réessaie.";
}

export default function SetPassword() {
  const { isAuthenticated, isLoading, setPassword } = useAuth();

  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [linkLoading, setLinkLoading] = useState(true);
  const [linkOk, setLinkOk] = useState(false);

  const navigate = useNavigate();

  const urlInfo = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const type = params.get("type"); // souvent "recovery"
    const errorDesc = params.get("error_description") || params.get("error");
    return { code, type, errorDesc };
  }, []);

  useEffect(() => {
    let alive = true;

    const init = async () => {
      setError(null);
      setLinkLoading(true);

      try {
        if (!SUPABASE_ENV_OK) throw new Error("Supabase non configuré.");

        // Si Supabase a déjà mis un message d'erreur dans l'URL (rare mais possible)
        if (urlInfo.errorDesc) {
          throw new Error(decodeURIComponent(urlInfo.errorDesc));
        }

        // ✅ Cas principal (PKCE): /set-password?code=...
        if (urlInfo.code) {
          const { error: exErr } = await supabase.auth.exchangeCodeForSession(urlInfo.code);
          if (exErr) throw exErr;

          // Nettoie l'URL pour éviter un re-exchange au refresh
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        // Vérifie qu'on a bien une session derrière
        const { data, error: sessErr } = await supabase.auth.getSession();
        if (sessErr) throw sessErr;

        if (!alive) return;
        const ok = !!data.session?.user;
        setLinkOk(ok);
        setLinkLoading(false);

        if (!ok) {
          setError("Lien invalide ou expiré. Redemande un lien depuis 'Mot de passe oublié'.");
        }
      } catch (e) {
        if (!alive) return;
        setLinkOk(false);
        setLinkLoading(false);
        setError(getErrorMessage(e));
      }
    };

    void init();
    return () => {
      alive = false;
    };
  }, [urlInfo.code, urlInfo.errorDesc]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (p1.length < 8) return setError("Mot de passe trop court (min 8).");
    if (p1 !== p2) return setError("Les mots de passe ne correspondent pas.");

    // ✅ garde-fou: il faut une session active (via exchange)
    if (!linkOk || !isAuthenticated) {
      return setError("Session manquante. Ouvre à nouveau le lien reçu par email ou redemande un lien.");
    }

    const { error } = await setPassword(p1);
    if (error) return setError(error);

    setDone(true);
    navigate("/hub", { replace: true });
  };

  // Loading global + loading lien
  if (isLoading || linkLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50">
        Chargement…
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-slate-50">
      <div className="w-full max-w-md space-y-4">
        <div className="flex justify-center">
          <BrandLogo
            className="justify-center"
            imageClassName="h-12 drop-shadow-lg"
            titleClassName="text-base font-semibold text-white"
            subtitleClassName="text-sm text-slate-200/80"
          />
        </div>

        <h1 className="text-xl font-semibold">Choisir un mot de passe</h1>

        {error ? <p className="text-sm text-red-300">{error}</p> : null}

        {done ? (
          <p>Mot de passe défini ✅ Redirection…</p>
        ) : !linkOk ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">
              Le lien n’est pas valide (ou a expiré). Redemande un lien depuis la page “Mot de passe oublié”.
            </p>
            <Button className="w-full" variant="outline" onClick={() => navigate("/forgot-password", { replace: true })}>
              Redemander un lien
            </Button>
            <Button className="w-full" onClick={() => navigate("/login", { replace: true })}>
              Retour login
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <Input
              type="password"
              required
              value={p1}
              onChange={(e) => setP1(e.target.value)}
              placeholder="Nouveau mot de passe"
              className="bg-slate-950 border-slate-800 text-white"
            />
            <Input
              type="password"
              required
              value={p2}
              onChange={(e) => setP2(e.target.value)}
              placeholder="Confirmer le mot de passe"
              className="bg-slate-950 border-slate-800 text-white"
            />
            <Button className="w-full" type="submit">
              Valider
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
