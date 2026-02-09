import { FormEvent, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

function getErrorMessage(err: unknown): string {
  if (!err) return "Une erreur inconnue est survenue.";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  const anyErr = err as { message?: string };
  if (typeof anyErr?.message === "string") return anyErr.message;
  return "Une erreur est survenue. Reessaie.";
}

function safeNextPath(candidate: unknown, fallback = "/app/control-tower") {
  const v = typeof candidate === "string" ? candidate : "";
  return v && v.startsWith("/") ? v : fallback;
}

export default function Login() {
  const { signIn, resendSignUpEmail, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [resendPending, setResendPending] = useState(false);
  const [pending, setPending] = useState(false);

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

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Merci de renseigner un email.");
      return;
    }
    if (!password) {
      setError("Merci de renseigner un mot de passe.");
      return;
    }

    try {
      setPending(true);
      const { error: err, needsEmailConfirmation } = await signIn(normalizedEmail, password);
      if (err) {
        setNeedsConfirm(needsEmailConfirmation);
        setError(getErrorMessage(err));
        return;
      }
      navigate(nextPath, { replace: true });
    } catch (e2) {
      setError(getErrorMessage(e2));
    } finally {
      setPending(false);
    }
  };

  const handleResend = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Ajoute ton email pour renvoyer le lien.");
      return;
    }
    setResendPending(true);
    setError(null);
    setNotice(null);
    try {
      const emailRedirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/login?next=${encodeURIComponent(nextPath)}`
          : undefined;
      const { error: err } = await resendSignUpEmail(normalizedEmail, emailRedirectTo);
      if (err) {
        setError(getErrorMessage(err));
        return;
      }
      setNeedsConfirm(true);
      setNotice("Email de verification renvoye. Verifie aussi les spams.");
    } catch (e2) {
      setError(getErrorMessage(e2));
    } finally {
      setResendPending(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-950 text-slate-50">
      <div className="relative hidden lg:block">
        <img src="/login-hero.svg" alt="Illustration" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-black/40 to-slate-900/70" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center px-10 space-y-4">
            <p className="uppercase tracking-[0.3em] text-cyan-200 font-semibold">Export Navigator</p>
            <h2 className="text-4xl font-bold text-white drop-shadow-lg">Conformite, couts, veille</h2>
            <p className="text-slate-100/80 max-w-xl mx-auto">
              Analyse par HS code et pays. Outil universel pour tout exportateur francais.
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

          <Card className="bg-slate-900/80 border-slate-800 text-slate-50 shadow-xl shadow-cyan-500/10">
            <CardHeader>
              <CardTitle>Se connecter</CardTitle>
              <CardDescription className="text-slate-300">
                Connexion par compte utilisateur. Tu peux creer un compte gratuitement.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form className="space-y-4" onSubmit={onSubmit}>
                <div className="space-y-2">
                  <label className="text-sm text-slate-200">Email</label>
                  <Input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vous@exemple.com"
                    autoComplete="email"
                    className="bg-slate-950 border-slate-800 text-white"
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
                    className="bg-slate-950 border-slate-800 text-white"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => navigate("/forgot-password")}
                    className="text-sm text-cyan-200 hover:underline"
                  >
                    Mot de passe oublie
                  </button>

                  <span className="text-xs text-slate-500">-&gt; {nextPath}</span>
                </div>

                {error && (
                  <div className="flex items-start gap-2 text-sm text-red-300 bg-red-900/30 border border-red-800/70 rounded-xl px-3 py-2">
                    <AlertCircle className="h-4 w-4 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {notice && (
                  <div className="text-sm text-emerald-300 bg-emerald-900/30 border border-emerald-800/70 rounded-xl px-3 py-2">
                    {notice}
                  </div>
                )}

                {needsConfirm && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-200 space-y-2">
                    <div className="font-semibold">Email non confirme</div>
                    <div>1) Ouvre ta boite mail et clique sur "Confirmer".</div>
                    <div>2) Puis reconnecte-toi.</div>
                    <div>3) Si tu ne reçois rien: renvoie l'email.</div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={handleResend}
                      disabled={resendPending}
                    >
                      {resendPending ? "Renvoi..." : "Renvoyer l'email de verification"}
                    </Button>
                  </div>
                )}

                <Button type="submit" className="w-full h-11 font-semibold" disabled={pending || isLoading}>
                  {pending || isLoading ? "Connexion..." : "Se connecter"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="text-center text-sm text-slate-400">
            Pas de compte ?{" "}
            <button
              className="text-cyan-200 hover:underline"
              onClick={() => navigate(`/register?next=${encodeURIComponent(nextPath)}`)}
            >
              Creer un compte
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
