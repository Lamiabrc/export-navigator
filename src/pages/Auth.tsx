import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { BrandLogo } from '@/components/BrandLogo';

const FORCED_EMAIL = 'lamia.brechetighil@orliman.fr';
const DEFAULT_PASSWORD_HINT = 'Orliman2025!';

export default function AuthPage() {
  const [email] = useState(FORCED_EMAIL);
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await signIn(email, password);
      if (error) {
        toast.error(error);
      } else {
        toast.success('Connexion reussie');
        navigate('/');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-2xl border shadow-lg p-8">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <BrandLogo
              className="justify-center"
              imageClassName="h-16 drop-shadow-lg"
              titleClassName="text-lg font-semibold text-foreground"
              subtitleClassName="text-sm text-muted-foreground"
            />
          </div>

          <h1 className="text-2xl font-bold text-center text-foreground mb-2">
            Connexion
          </h1>
          <p className="text-center text-muted-foreground mb-6">
            Acces reserve - compte administrateur ORLIMAN
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email (verrouille)</Label>
              <Input
                id="email"
                type="email"
                value={email}
                disabled
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={DEFAULT_PASSWORD_HINT}
                required
                minLength={4}
              />
              <p className="text-xs text-muted-foreground">
                Mot de passe par defaut : {DEFAULT_PASSWORD_HINT}
              </p>
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Chargement...' : 'Se connecter'}
            </Button>
          </form>

          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground text-center">
              Toutes les donnees sont stockees localement sur votre PC
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
