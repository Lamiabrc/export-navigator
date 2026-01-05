import { Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calculator, FileCheck2, Activity, AlertTriangle, Bot, Gauge } from "lucide-react";
import { useReferenceRates } from "@/hooks/useReferenceRates";
import { useProducts } from "@/hooks/useProducts";
import { useClients } from "@/hooks/useClients";

export default function Hub() {
  const { octroiMerRates, transportCosts, vatRates, isLoading: refLoading } = useReferenceRates();
  const { products, isLoading: prodLoading } = useProducts({ enabled: true, pageSize: 50 });
  const { clients, isLoading: clientLoading } = useClients();

  const hsMissing = products.filter((p) => !(p as any).hs_code).length;
  const transportMissing = transportCosts.length === 0;
  const ratesMissing = vatRates.length === 0 || octroiMerRates.length === 0;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Check rapide</p>
            <h1 className="text-2xl font-bold">Simulateur & Vérificateur</h1>
          </div>
          <Link to="/assistant">
            <Button variant="outline" className="gap-2">
              <Bot className="h-4 w-4" />
              IA Export
            </Button>
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Simulateur</CardTitle>
                <CardDescription>Estimation rapide : HT, transport, OM/OMR, marge.</CardDescription>
              </div>
              <Calculator className="h-6 w-6 text-primary" />
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground max-w-sm">
                Utilise les rates Supabase (VAT, transport, OM par HS). HS code obligatoire pour OM/OMR.
              </div>
              <Link to="/simulator">
                <Button>Ouvrir</Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Vérificateur</CardTitle>
                <CardDescription>Contrôle facture réelle, sauvegarde invoice_control.</CardDescription>
              </div>
              <FileCheck2 className="h-6 w-6 text-primary" />
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground max-w-sm">
                Saisir client/destination/incoterm/transport + lignes produits. Calcule marge HT, OM/OMR, transport.
              </div>
              <Link to="/verifier">
                <Button variant="secondary">Contrôler</Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle>État des données</CardTitle>
              <CardDescription>Vérifie la complétude des référentiels Supabase.</CardDescription>
            </div>
            <Gauge className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-4">
            <HealthTile
              label="Produits (HS)"
              value={`${hsMissing} HS manquants`}
              ok={!prodLoading && hsMissing === 0}
              loading={prodLoading}
            />
            <HealthTile
              label="Transport rates"
              value={transportMissing ? "Aucun tarif" : `${transportCosts.length} lignes`}
              ok={!transportMissing}
              loading={refLoading}
            />
            <HealthTile
              label="VAT / OM"
              value={ratesMissing ? "Rates incomplets" : "OK"}
              ok={!ratesMissing}
              loading={refLoading}
            />
            <HealthTile
              label="Clients"
              value={clientLoading ? "Chargement..." : `${clients.length} clients`}
              ok={!clientLoading && clients.length > 0}
              loading={clientLoading}
            />
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

function HealthTile({
  label,
  value,
  ok,
  loading,
}: {
  label: string;
  value: string;
  ok: boolean;
  loading?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border p-4 bg-muted/40">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold">{loading ? "..." : value}</p>
        </div>
        {ok ? (
          <div className="h-10 w-10 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
            <Activity className="h-5 w-5" />
          </div>
        ) : (
          <div className="h-10 w-10 rounded-full bg-amber-500/15 text-amber-500 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}
