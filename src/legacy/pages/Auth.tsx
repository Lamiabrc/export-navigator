import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { BrandLogo } from "@/components/BrandLogo";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await signIn(email.trim().toLowerCase(), password);
      if (error) {
        toast.error(error);
      } else {
        toast.success("Connexion reussie");
        navigate("/");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-2xl border shadow-lg p-8">
          <div className="flex justify-center mb-6">
            <BrandLogo
              className="justify-center"
              imageClassName="h-16 drop-shadow-lg"
              titleClassName="text-lg font-semibold text-foreground"
              subtitleClassName="text-sm text-muted-foreground"
            />
          </div>

          <h1 className="text-2xl font-bold text-center text-foreground mb-2">Connexion</h1>
          <p className="text-center text-muted-foreground mb-6">
            Acces par inscription utilisateur.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Chargement..." : "Se connecter"}
            </Button>
          </form>

          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground text-center">Toutes les donnees sont stockees localement sur votre PC</p>
          </div>
        </div>
      </div>
    </div>
  );
}
