import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Admin() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Administration</p>
          <h1 className="text-2xl font-bold">Référentiels & veille (Supabase)</h1>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Produits & coûts</CardTitle>
              <CardDescription>products, product_costs, export_hs_catalog</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>Ajoutez hs_code, coûts de revient, OM/OMR par destination + HS.</p>
              <Badge variant="outline">CRUD à implémenter</Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Transport & règles</CardTitle>
              <CardDescription>transport_rates, export_destinations, export_incoterms</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>Tarifs transport par destination/mode, frais minimums, fuel surcharge.</p>
              <Badge variant="outline">CRUD à implémenter</Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Veille & documents</CardTitle>
              <CardDescription>watch_sources, watch_items, documents, reg_events</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>Sources commerciales/réglementaires, items, documents et événements réglementaires.</p>
              <Badge variant="outline">CRUD à implémenter</Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Playbooks & contenus</CardTitle>
              <CardDescription>playbooks, playbook_sections, guide export</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>Structure guide export / contenus versionnes pour l'IA et le Guide.</p>
              <Badge variant="outline">CRUD à implémenter</Badge>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}

