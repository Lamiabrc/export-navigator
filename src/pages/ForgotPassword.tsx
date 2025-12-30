import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandLogo } from "@/components/BrandLogo";

export default function ForgotPassword() {
  const { sendPasswordLink } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const { error } = await sendPasswordLink(email.trim().toLowerCase());
    if (error) return setError(error);
    setSent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-slate-50">
      <div className="w-full max-w-md space-y-4">
        <div className="flex justify-center">
          <BrandLogo
            className="justify-center"
            size="lg"
            imageClassName="drop-shadow-lg"
            titleClassName="text-white"
            subtitleClassName="text-slate-200/80"
            locationClassName="text-xs text-slate-200/80"
          />
        </div>

        <h1 className="text-xl font-semibold">Définir / réinitialiser le mot de passe</h1>

        {sent ? (
          <>
            <p className="text-slate-300">
              Email envoyé. Clique sur le lien pour choisir ton mot de passe.
            </p>
            <Button onClick={() => navigate("/welcome")}>Retour</Button>
          </>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.com"
              className="bg-slate-950 border-slate-800 text-white"
            />
            {error && <p className="text-sm text-red-300">{error}</p>}
            <Button className="w-full" type="submit">Envoyer le lien</Button>
          </form>
        )}
      </div>
    </div>
  );
}
