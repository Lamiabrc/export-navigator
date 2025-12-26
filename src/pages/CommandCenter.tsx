import * as React from "react";
import { Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";
import { useProducts } from "@/hooks/useProducts";
import { getZoneFromDestination } from "@/data/referenceRates";
import type { Zone } from "@/types";

import {
  Activity,
  FileCheck2,
  Calculator,
  Users,
  Package,
  BookOpen,
  Settings2,
  RefreshCw,
  ArrowRight,
} from "lucide-react";

type FlowRow = {
  id: string;
  flow_code: string;
  data: any;
  created_at: string;
};

function safeText(v: any): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function extractDestination(data: any): string {
  return (
    safeText(data?.destination) ||
    safeText(data?.destination_name) ||
    safeText(data?.shipping?.destination) ||
    safeText(data?.meta?.destination) ||
    ""
  );
}

export default function CommandCenter() {
  const { stats, isLoading: productsLoading, error: productsError, refresh: refreshProducts } = useProducts({ pageSize: 2000 });

  const [flowsLoading, setFlowsLoading] = React.useState(true);
  const [flowsError, setFlowsError] = React.useState("");
  const [recentFlows, setRecentFlows] = React.useState<FlowRow[]>([]);
  const [flowsByZone, setFlowsByZone] = React.useState<Record<Zone, number>>({
    UE: 0,
    DROM: 0,
    "Hors UE": 0,
  });

  const loadFlows = React.useCallback(async () => {
    setFlowsLoading(true);
    setFlowsError("");

    if (!SUPABASE_ENV_OK) {
      setFlowsError("Supabase env manquantes (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).");
      setRecentFlows([]);
      setFlowsByZone({ UE: 0, DROM: 0, "Hors UE": 0 });
      setFlowsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("flows")
        .select("id, flow_code, data, created_at")
        .order("created_at", { ascending: false })
        .limit(40);

      if (error) throw error;

      const rows = (data ?? []) as FlowRow[];
      setRecentFlows(rows);

      const zoneCount: Record<Zone, number> = { UE: 0, DROM: 0, "Hors UE": 0 };
      for (const r of rows) {
        const dest = extractDestination(r.data);
        if (!dest) continue;

        let z: Zone;
        try {
          z = getZoneFromDestination(dest as any);
        } catch {
          z = "Hors UE";
        }
        zoneCount[z] = (zoneCount[z] ?? 0) + 1;
      }
      setFlowsByZone(zoneCount);
    } catch (e: any) {
      setFlowsError(e?.message || "Erreur chargement flows");
      setRecentFlows([]);
      setFlowsByZone({ UE: 0, DROM: 0, "Hors UE": 0 });
    } finally {
      setFlowsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadFlows();
  }, [loadFlows]);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="h-6 w-6 text-accent" />
              Tour de contrôle Export
            </h1>
            <p className="text-muted-foreground mt-1">
              Hub unique : contrôle facture + simulation export + référentiels (Supabase).
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild className="gap-2">
              <Link to="/invoice-verification">
                <FileCheck2 className="h-4 w-4" />
                Contrôle facture
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link to="/simulator">
                <Calculator className="h-4 w-4" />
                Simulation export
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link to="/clients">
                <Users className="h-4 w-4" />
                Clients
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link to="/products">
                <Package className="h-4 w-4" />
                Produits
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link to="/guide">
                <BookOpen className="h-4 w-4" />
                Guide (incl. DROM)
              </Link>
            </Button>
            <Button asChild variant="ghost" className="gap-2">
              <Link to="/settings">
                <Settings2 className="h-4 w-4" />
                Réglages
              </Link>
            </Button>
          </div>
        </div>

        {/* KPI */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="h-4 w-4" />
                Produits
              </CardTitle>
              <CardDescription>Table Supabase : products</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {productsError ? <p className="text-sm text-red-600">{productsError}</p> : null}
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">{productsLoading ? "…" : stats.total}</div>
                <Button variant="outline" size="sm" onClick={refreshProducts} disabled={productsLoading}>
                  <RefreshCw className={`h-4 w-4 ${productsLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">Nouveautés: {stats.nouveautes}</Badge>
                <Badge variant="secondary">LPPR: {stats.lppr}</Badge>
                <Badge variant="secondary">TVA OK: {stats.withTva}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Prochaine étape : ajouter <code>hs_code</code> pour OM/OMR par code douanier.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Flux (40 derniers)
              </CardTitle>
              <CardDescription>Table Supabase : flows</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {flowsError ? <p className="text-sm text-red-600">{flowsError}</p> : null}
              <div className="text-2xl font-bold">{flowsLoading ? "…" : recentFlows.length}</div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">UE: {flowsByZone.UE}</Badge>
                <Badge variant="outline">DROM: {flowsByZone.DROM}</Badge>
                <Badge variant="outline">Hors UE: {flowsByZone["Hors UE"]}</Badge>
              </div>
              <Button variant="outline" size="sm" onClick={loadFlows} disabled={flowsLoading} className="w-full">
                <RefreshCw className={`h-4 w-4 mr-2 ${flowsLoading ? "animate-spin" : ""}`} />
                Actualiser
              </Button>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileCheck2 className="h-4 w-4" />
                Contrôle facture
              </CardTitle>
              <CardDescription>Comparer facture vs calcul interne</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Recalcul HT/TVA/TTC + frais transit + OM/OMR + TVA export/import.
              </p>
              <div className="grid grid-cols-1 gap-2">
                <Button asChild className="justify-between">
                  <Link to="/invoice-verification">
                    Vérifier une facture <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="justify-between">
                  <Link to="/simulator">
                    Simuler un envoi <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* Derniers flux */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Derniers flux</CardTitle>
            <CardDescription>Lecture rapide (destination / zone)</CardDescription>
          </CardHeader>
          <CardContent>
            {recentFlows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun flux à afficher.</p>
            ) : (
              <div className="space-y-2">
                {recentFlows.slice(0, 14).map((f) => {
                  const dest = extractDestination(f.data);
                  let z: Zone | "" = "";
                  try {
                    z = dest ? getZoneFromDestination(dest as any) : "";
                  } catch {
                    z = "";
                  }

                  return (
                    <div
                      key={f.id}
                      className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 rounded-lg border p-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{f.flow_code}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          Destination: {dest || "—"} {z ? `• Zone: ${z}` : ""}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(f.created_at).toLocaleString("fr-FR")}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
