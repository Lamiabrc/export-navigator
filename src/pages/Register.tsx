import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
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

export default function Register() {
  const { signUp, isLoading } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Merci de renseigner un email.");
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
      const { error: err } = await signUp(normalizedEmail, password);
      if (err) {
        setError(getErrorMessage(err));
        return;
      }
      setSuccess("Compte cree. Verifie ta boite mail si la confirmation est activee.");
      setTimeout(() => navigate("/login"), 1200);
    } catch (e2) {
      setError(getErrorMessage(e2));
    } finally {
      setPending(false);
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
            </form>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-slate-400">
          Deja un compte ?{" "}
          <button className="text-cyan-200 hover:underline" onClick={() => navigate("/login")}>
            Se connecter
          </button>
        </div>
      </div>
    </div>
  );
}
