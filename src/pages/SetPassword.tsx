import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SetPassword() {
  const { isAuthenticated, isLoading, setPassword } = useAuth();
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Si l'utilisateur arrive depuis l'email, la session se crée automatiquement via l'URL,
    // puis isAuthenticated passera à true.
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (p1.length < 8) return setError("Mot de passe trop court (min 8).");
    if (p1 !== p2) return setError("Les mots de passe ne correspondent pas.");
    if (!isAuthenticated) return setError("Lien invalide ou expiré. Redemande un lien.");

    const { error } = await setPassword(p1);
    if (error) return setError(error);

    setDone(true);
    navigate("/hub", { replace: true });
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50">Chargement…</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-slate-50">
      <div className="w-full max-w-md space-y-4">
        <h1 className="text-xl font-semibold">Choisir un mot de passe</h1>

        {done ? (
          <p>Mot de passe défini ✅</p>
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
            {error && <p className="text-sm text-red-300">{error}</p>}
            <Button className="w-full" type="submit">Valider</Button>
          </form>
        )}
      </div>
    </div>
  );
}
