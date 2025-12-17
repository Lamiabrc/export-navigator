import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import logoOrliman from '@/assets/logo-orliman.png';
import type { LocalUser } from '@/hooks/useLocalAuth';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<LocalUser['role']>('adv_export');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          toast.error(error);
        } else {
          toast.success('Connexion réussie');
          navigate('/');
        }
      } else {
        if (!name.trim()) {
          toast.error('Le nom est requis');
          setIsSubmitting(false);
          return;
        }
        const { error } = await signUp(email, password, name, role);
        if (error) {
          toast.error(error);
        } else {
          toast.success('Compte créé avec succès');
          navigate('/');
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const roleLabels: Record<LocalUser['role'], string> = {
    direction: 'Direction',
    adv_export: 'ADV Export',
    logistique: 'Logistique',
    finance: 'Finance/Compta',
    admin: 'Administrateur',
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-2xl border shadow-lg p-8">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <img 
              src={logoOrliman} 
              alt="ORLIMAN" 
              className="h-16 object-contain"
            />
          </div>

          <h1 className="text-2xl font-bold text-center text-foreground mb-2">
            {isLogin ? 'Connexion' : 'Créer un compte'}
          </h1>
          <p className="text-center text-muted-foreground mb-6">
            Gestion Export Orthopédie - 100% Local
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="name">Nom complet</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jean Dupont"
                  required={!isLogin}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@orliman.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={4}
              />
            </div>

            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="role">Rôle</Label>
                <Select value={role} onValueChange={(v) => setRole(v as LocalUser['role'])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(roleLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isSubmitting}
            >
              {isSubmitting 
                ? 'Chargement...' 
                : isLogin ? 'Se connecter' : 'Créer le compte'
              }
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-primary hover:underline"
            >
              {isLogin 
                ? "Pas de compte ? S'inscrire" 
                : 'Déjà un compte ? Se connecter'
              }
            </button>
          </div>

          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground text-center">
              🔒 Toutes les données sont stockées localement sur votre PC
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
