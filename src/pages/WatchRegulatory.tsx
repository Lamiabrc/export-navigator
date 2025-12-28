import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, FileSearch, Scale } from "lucide-react";

export default function WatchRegulatory() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Veille réglementaire export</p>
          <h1 className="text-2xl font-bold">Douane, DROM, UE, fiscalité</h1>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Réglementaire
              </CardTitle>
              <CardDescription>Événements/règles: reg_events (juridiction, impact, HS, zones).</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Renseignez reg_events + sources dans Admin. Les docs sont indexés via documents/document_chunks (Supabase).
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSearch className="h-5 w-5 text-primary" />
                Sources & docs
              </CardTitle>
              <CardDescription>watch_sources (type=regulatory) + documents stockés.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Ajoutez vos sources (Douane, Légifrance, UE) et documents. L’IA pourra citer les morceaux indexés.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-primary" />
                Fiscalité / OM
              </CardTitle>
              <CardDescription>Connexion au catalogue HS + OM/OMR + TVA.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Les calculs utilisent export_hs_catalog et reference_rates. Vérifiez dans Admin que les destinations/HS sont présents.
              <div className="mt-2 flex gap-2">
                <Badge variant="outline">Alertes</Badge>
                <Badge variant="secondary">Bientôt actions</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
