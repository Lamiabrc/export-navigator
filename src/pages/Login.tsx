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

function safeNextPath(candidate: unknown, fallback = "/control-tower") {
  const v = typeof candidate === "string" ? candidate : "";
  return v && v.startsWith("/") ? v : fallback;
}

export default function Login() {
  const { signIn, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const nextPath = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const qNext = params.get("next");
    const stateAny = location.state as { from?: { pathname?: string; search?: string }; next?: string } | null;
    const stateFromPath = stateAny?.from?.pathname;
    const stateFromSearch = stateAny?.from?.search || "";
    const stateNext = stateAny?.next;
    if (qNext) return safeNextPath(qNext, "/control-tower");
    if (stateFromPath) return safeNextPath(`${stateFromPath}${stateFromSearch}`, "/control-tower");
    if (stateNext) return safeNextPath(stateNext, "/control-tower");
    return "/control-tower";
  }, [location.search, location.state]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

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
      const { error: err } = await signIn(normalizedEmail, password);
      if (err) {
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

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-950 text-slate-50">
      <div className="relative hidden lg:block">
        <img src="/assets/sea-login.jpg" alt="Ocean" className="h-full w-full object-cover" />
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

                  <span className="text-xs text-slate-500">-> {nextPath}</span>
                </div>

                {error && (
                  <div className="flex items-start gap-2 text-sm text-red-300 bg-red-900/30 border border-red-800/70 rounded-xl px-3 py-2">
                    <AlertCircle className="h-4 w-4 mt-0.5" />
                    <span>{error}</span>
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
            <button className="text-cyan-200 hover:underline" onClick={() => navigate("/register")}>
              Creer un compte
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
