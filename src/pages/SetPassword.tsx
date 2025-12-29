import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SetPassword() {
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Important : laisse Supabase “récupérer” la session depuis l’URL (reset/invite)
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      // Si la session est déjà là, on est ready.
      setReady(!!data.session);
    };

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      // Quand l’utilisateur arrive depuis un lien recovery/invite, session peut apparaître ici.
      setReady(!!session);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) return setError("Mot de passe trop court (min 8).");
    if (password !== password2) return setError("Les mots de passe ne correspondent pas.");

    const { data } = await supabase.auth.getSession();
    if (!data.session) return setError("Lien invalide ou expiré. Demandez un nouveau lien.");

    const { error } = await supabase.auth.updateUser({ password });
    if (error) return setError(error.message);

    setDone(true);
    // au choix: rediriger direct vers hub
    setTimeout(() => navigate("/hub"), 500);
  };

  if (!ready && !done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p>Chargement… (si rien ne se passe, lien expiré)</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4">
        <h1 className="text-xl font-semibold">Choisir un mot de passe</h1>

        {done ? (
          <p>Mot de passe défini ✅ Redirection…</p>
        ) : (
          <form className="space-y-3" onSubmit={onSubmit}>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nouveau mot de passe"
              required
            />
            <Input
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              placeholder="Confirmer le mot de passe"
              required
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <Button className="w-full" type="submit">Valider</Button>
          </form>
        )}
      </div>
    </div>
  );
}
