import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase"; // ton client supabase
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const redirectTo = `${window.location.origin}/set-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });

    if (error) return setError(error.message);
    setSent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4">
        <h1 className="text-xl font-semibold">Définir / réinitialiser le mot de passe</h1>

        {sent ? (
          <div className="space-y-3">
            <p>Un email vient d’être envoyé. Ouvre le lien pour définir ton mot de passe.</p>
            <Button onClick={() => navigate("/")}>Retour connexion</Button>
          </div>
        ) : (
          <form className="space-y-3" onSubmit={onSubmit}>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.com"
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <Button className="w-full" type="submit">Envoyer le lien</Button>
          </form>
        )}
      </div>
    </div>
  );
}
