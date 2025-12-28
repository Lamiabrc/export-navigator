import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function Login() {
  const { signIn, isLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error: err } = await signIn(email.trim(), password);
    setPending(false);
    if (err) {
      setError(err);
      return;
    }
    navigate("/hub");
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-950 text-slate-50">
      <div className="relative hidden lg:block">
        <img
          src="/assets/sea-login.jpg"
          alt="Mer et îles"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-black/40 to-slate-900/70" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center px-10 space-y-4">
            <p className="uppercase tracking-[0.3em] text-cyan-200 font-semibold">Contrôle Export</p>
            <h2 className="text-4xl font-bold text-white drop-shadow-lg">Pilotage DROM / UE / Hors UE</h2>
            <p className="text-slate-100/80 max-w-xl mx-auto">
              Factures, OM/OMR, transport, concurrence, veille réglementaire, IA Export. Données sécurisées Supabase.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-cyan-500/20 border border-cyan-300/40 flex items-center justify-center text-cyan-100 font-semibold">
              OR
            </div>
            <div>
              <p className="text-sm text-slate-200/80">Orliman Export</p>
              <p className="text-lg font-semibold text-white">Connexion sécurisée</p>
            </div>
          </div>

          <Card className="bg-slate-900/80 border-slate-800 text-slate-50 shadow-xl shadow-cyan-500/10">
            <CardHeader>
              <CardTitle>Se connecter</CardTitle>
              <CardDescription className="text-slate-300">
                Email + mot de passe (Supabase Auth). Après connexion : redirection vers le Hub.
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
                    placeholder="••••••••"
                    className="bg-slate-950 border-slate-800 text-white"
                  />
                </div>

                {error && (
                  <div className="flex items-start gap-2 text-sm text-red-300 bg-red-900/30 border border-red-800/70 rounded-xl px-3 py-2">
                    <AlertCircle className="h-4 w-4 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-11 font-semibold"
                  disabled={pending || isLoading}
                >
                  {pending ? "Connexion..." : "Se connecter"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="text-center text-sm text-slate-400">
            Pas de compte ? Demandez une création dans Supabase Auth (admin) ou utilisez le compte existant.
          </div>
        </div>
      </div>
    </div>
  );
}
