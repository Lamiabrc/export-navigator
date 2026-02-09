import { FormEvent, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

function getErrorMessage(err: unknown): string {
  if (!err) return "Une erreur inconnue est survenue.";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  const anyErr = err as { message?: string };
  if (typeof anyErr?.message === "string") return anyErr.message;
  return "Une erreur est survenue. Reessaie.";
}

function safeNextPath(candidate: unknown, fallback = "/") {
  const v = typeof candidate === "string" ? candidate : "";
  return v && v.startsWith("/") ? v : fallback;
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
    return safeNextPath(qNext, "/");
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
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50 px-6 py-12">
      <div className="w-full max-w-md space-y-6">
        <BrandLogo
          className="flex items-center gap-3 justify-center"
          imageClassName="h-11 drop-shadow-lg"
          titleClassName="text-base font-semibold text-white"
          subtitleClassName="text-sm text-slate-200/80"
        />

        <Card className="bg-slate-900/80 border-slate-800 text-slate-50 shadow-xl shadow-cyan-500/10">
          <CardHeader>
            <CardTitle>Creer un compte</CardTitle>
            <CardDescription className="text-slate-300">
              Inscription gratuite. L'outil est accessible apres creation.
            </CardDescription>
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
                  className="bg-slate-950 border-slate-800 text-white"
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
                  autoComplete="new-password"
                  className="bg-slate-950 border-slate-800 text-white"
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
                  className="bg-slate-950 border-slate-800 text-white"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 text-sm text-red-300 bg-red-900/30 border border-red-800/70 rounded-xl px-3 py-2">
                  <AlertCircle className="h-4 w-4 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="flex items-start gap-2 text-sm text-emerald-300 bg-emerald-900/30 border border-emerald-800/70 rounded-xl px-3 py-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5" />
                  <span>{success}</span>
                </div>
              )}

              <Button type="submit" className="w-full h-11 font-semibold" disabled={pending || isLoading}>
                {pending || isLoading ? "Creation..." : "Creer un compte"}
              </Button>

              {awaitingEmail && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-200 space-y-2">
                  <div className="font-semibold">Etape suivante</div>
                  <div>1) Ouvre ta boite mail et clique sur "Confirmer".</div>
                  <div>2) Puis reconnecte-toi.</div>
                  <div>3) Si tu ne reçois rien: renvoie l'email ci-dessous.</div>
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
  );
}
