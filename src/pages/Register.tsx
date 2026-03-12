import { FormEvent, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, BriefcaseBusiness, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";

import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";

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
  if (v === "/" || v === "/register" || v === "/login") return fallback;
  return v;
}

export default function Register() {
  const { signUp, resendSignUpEmail, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [companyName, setCompanyName] = useState("");
  const [country, setCountry] = useState("FR");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [awaitingEmail, setAwaitingEmail] = useState(false);
  const [resendPending, setResendPending] = useState(false);
  const [lastSignupEmail, setLastSignupEmail] = useState("");

  const nextPath = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const qNext = params.get("next");
    return safeNextPath(qNext, "/app/control-tower");
  }, [location.search]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Merci de renseigner un email.");
      return;
    }
    if (!companyName.trim()) {
      setError("Merci de renseigner le nom de l'entreprise.");
      return;
    }
    if (!password || password.length < 6) {
      setError("Mot de passe trop court (min 6 caracteres).");
      return;
    }
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    try {
      setPending(true);
      const emailRedirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/login?next=${encodeURIComponent(nextPath)}`
          : undefined;
      const { error: err, needsEmailConfirmation } = await signUp(normalizedEmail, password, {
        data: {
          company_name: companyName.trim(),
          country: country.trim().toUpperCase(),
        },
        emailRedirectTo,
      });
      if (err) {
        setError(getErrorMessage(err));
        return;
      }
      setLastSignupEmail(normalizedEmail);
      if (needsEmailConfirmation) {
        setAwaitingEmail(true);
        setSuccess(
          "Compte cree. Un email de verification vient d'etre envoye. Ouvre-le pour activer ton compte."
        );
        return;
      }
      setSuccess("Compte cree. Connexion en cours...");
      setTimeout(() => navigate(nextPath), 900);
    } catch (e2) {
      setError(getErrorMessage(e2));
    } finally {
      setPending(false);
    }
  };

  const handleResend = async () => {
    if (!lastSignupEmail) return;
    setResendPending(true);
    setError(null);
    setSuccess(null);
    try {
      const emailRedirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/login?next=${encodeURIComponent(nextPath)}`
          : undefined;
      const { error: err } = await resendSignUpEmail(lastSignupEmail, emailRedirectTo);
      if (err) {
        setError(getErrorMessage(err));
        return;
      }
      setSuccess("Email de verification renvoye. Verifie aussi les spams.");
    } catch (e2) {
      setError(getErrorMessage(e2));
    } finally {
      setResendPending(false);
    }
  };

  return (
    <div className="min-h-screen grid bg-slate-950 text-slate-50 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="relative hidden overflow-hidden border-r border-slate-900 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.18),transparent_42%),linear-gradient(135deg,#020617_0%,#071328_45%,#0f172a_100%)]" />
        <div className="relative flex h-full flex-col justify-between px-10 py-12">
          <BrandLogo
            className="flex items-center gap-3"
            imageClassName="h-11 drop-shadow-lg"
            titleClassName="text-base font-semibold text-white"
            subtitleClassName="text-sm text-slate-200/80"
          />

          <div className="max-w-xl space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-100">
              <Sparkles className="h-3.5 w-3.5" />
              Compte gratuit
            </div>
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold leading-tight text-white">
                Creez un compte pour publier sur le coin business et entrer dans l'outil.
              </h1>
              <p className="text-base text-slate-200/85">
                Le compte gratuit donne une raison concrete de revenir: publier une opportunite, suivre vos premiers signaux business et acceder aux outils d'aide a la decision export.
              </p>
            </div>

            <div className="grid gap-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-start gap-3">
                  <BriefcaseBusiness className="mt-0.5 h-5 w-5 text-cyan-200" />
                  <div>
                    <div className="font-semibold text-white">Publier une proposition d'affaires</div>
                    <div className="mt-1 text-sm text-slate-300">
                      Recherche d'acheteur, distribution, sourcing ou partenariat visible sur le board public.
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 text-cyan-200" />
                  <div>
                    <div className="font-semibold text-white">Sans carte bancaire</div>
                    <div className="mt-1 text-sm text-slate-300">
                      Inscription gratuite, puis acces aux outils gratuits et au parcours de veille.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="rounded-full bg-white text-slate-950 hover:bg-slate-100"
                onClick={() => navigate("/coin-business")}
              >
                Voir le coin business
              </Button>
              <Button
                variant="outline"
                className="rounded-full border-slate-700 bg-transparent text-white hover:bg-slate-900"
                onClick={() => navigate(`/login?next=${encodeURIComponent(nextPath)}`)}
              >
                J'ai deja un compte
              </Button>
            </div>
          </div>

          <div className="text-xs uppercase tracking-[0.28em] text-slate-400">MPL Export Navigator</div>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden">
            <BrandLogo
              className="flex items-center gap-3 justify-center"
              imageClassName="h-11 drop-shadow-lg"
              titleClassName="text-base font-semibold text-white"
              subtitleClassName="text-sm text-slate-200/80"
            />
          </div>

          <Card className="border-slate-800 bg-slate-900/80 text-slate-50 shadow-xl shadow-cyan-500/10">
            <CardHeader className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-cyan-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">
                  Gratuit
                </span>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">
                  Sans CB
                </span>
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">
                  Coin business inclus
                </span>
              </div>
              <div>
                <CardTitle>Creer un compte</CardTitle>
                <CardDescription className="mt-2 text-slate-300">
                  Creation en quelques minutes. Vous pourrez publier une proposition d'affaires et acceder aux parcours gratuits.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent>
              <form className="space-y-4" onSubmit={onSubmit}>
                <div className="space-y-2">
                  <label className="text-sm text-slate-200">Entreprise</label>
                  <Input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Nom de l'entreprise"
                    autoComplete="organization"
                    className="border-slate-800 bg-slate-950 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-slate-200">Pays</label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="flex h-10 w-full items-center rounded-md border border-slate-800 bg-slate-950 px-3 text-sm text-white transition focus:border-slate-400 focus:outline-none"
                  >
                    <option value="FR">France</option>
                    <option value="BE">Belgique</option>
                    <option value="DE">Allemagne</option>
                    <option value="NL">Pays-Bas</option>
                    <option value="CH">Suisse</option>
                    <option value="GB">Royaume-Uni</option>
                    <option value="US">Etats-Unis</option>
                    <option value="CA">Canada</option>
                    <option value="ES">Espagne</option>
                    <option value="IT">Italie</option>
                    <option value="MA">Maroc</option>
                    <option value="AE">Emirats arabes unis</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-slate-200">Email</label>
                  <Input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vous@exemple.com"
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
                    autoComplete="new-password"
                    className="border-slate-800 bg-slate-950 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-slate-200">Confirmer</label>
                  <Input
                    type="password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="********"
                    autoComplete="new-password"
                    className="border-slate-800 bg-slate-950 text-white"
                  />
                </div>

                {error && (
                  <div className="flex items-start gap-2 rounded-xl border border-red-800/70 bg-red-900/30 px-3 py-2 text-sm text-red-300">
                    <AlertCircle className="mt-0.5 h-4 w-4" />
                    <span>{error}</span>
                  </div>
                )}

                {success && (
                  <div className="flex items-start gap-2 rounded-xl border border-emerald-800/70 bg-emerald-900/30 px-3 py-2 text-sm text-emerald-300">
                    <CheckCircle2 className="mt-0.5 h-4 w-4" />
                    <span>{success}</span>
                  </div>
                )}

                <Button type="submit" className="h-11 w-full font-semibold" disabled={pending || isLoading}>
                  {pending || isLoading ? "Creation..." : "Creer mon compte gratuit"}
                </Button>

                {awaitingEmail && (
                  <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-200">
                    <div className="font-semibold">Etape suivante</div>
                    <div>1) Ouvre ta boite mail et clique sur "Confirmer".</div>
                    <div>2) Puis reconnecte-toi.</div>
                    <div>3) Si tu ne recois rien: renvoie l'email ci-dessous.</div>
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
              </form>
            </CardContent>
          </Card>

          <div className="text-center text-sm text-slate-400">
            Deja un compte ?{" "}
            <button
              className="text-cyan-200 hover:underline"
              onClick={() => navigate(`/login?next=${encodeURIComponent(nextPath)}`)}
            >
              Se connecter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
