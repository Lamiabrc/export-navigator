import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Globe2, Target } from "lucide-react";

export default function WatchCommercial() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Veille commerciale & concurrentielle</p>
          <h1 className="text-2xl font-bold">Marchés, concurrents, prix observés</h1>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Concurrents
              </CardTitle>
              <CardDescription>Liste concurrents (AT, DonJoy, Gibaud…), régions, notes.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Géré via Supabase : tables competitors, competitor_products, price_observations. Ajoutez vos données dans Admin.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe2 className="h-5 w-5 text-primary" />
                Veille marché
              </CardTitle>
              <CardDescription>Sources commerciales, articles, signaux.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              watch_sources + watch_items (type=commercial). Gestion dans Admin. Affichage synthétique ici.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                IA Export
              </CardTitle>
              <CardDescription>Demandez prix observés, signaux, recommandations.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Le widget IA (Edge Function) peut consommer watch_items + price_observations pour synthèse.
              <div className="mt-2 flex gap-2">
                <Badge variant="outline">Bientôt</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
