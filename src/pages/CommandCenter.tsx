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
  Globe,
} from "lucide-react";

type Zone = "UE" | "DROM" | "Hors UE";

type FlowRow = {
  id: string;
  flow_code: string;
  data: any;
  created_at: string;
};

type ClientMini = {
  id: string;
  export_zone: string | null;
  drom_code: string | null;
  canal: string | null;
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

function zoneBadge(z: Zone) {
  if (z === "DROM") return <Badge variant="secondary">DROM</Badge>;
  if (z === "UE") return <Badge variant="outline">UE</Badge>;
  return <Badge variant="outline">Hors UE</Badge>;
}

export default function CommandCenter() {
  // Produits (Supabase) via hook existant
  const {
    stats: productStats,
    isLoading: productsLoading,
    error: productsError,
    refresh: refreshProducts,
  } = useProducts({ pageSize: 2000 });

  // Flows
  const [flowsLoading, setFlowsLoading] = React.useState(true);
  const [flowsError, setFlowsError] = React.useState("");
  const [recentFlows, setRecentFlows] = React.useState<FlowRow[]>([]);
  const [flowsByZone, setFlowsByZone] = React.useState<Record<Zone, number>>({
    UE: 0,
    DROM: 0,
    "Hors UE": 0,
  });

  // Clients (stats)
  const [clientsLoading, setClientsLoading] = React.useState(true);
  const [clientsError, setClientsError] = React.useState("");
  const [clientStats, setClientStats] = React.useState({
    total: 0,
    UE: 0,
    DROM: 0,
    "Hors UE": 0 as number,
    direct: 0,
    indirect: 0,
    depositaire: 0,
    unknownChannel: 0,
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
          z = getZoneFromDestination(dest as any) as Zone;
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

  const loadClientsStats = React.useCallback(async () => {
    setClientsLoading(true);
    setClientsError("");

    if (!SUPABASE_ENV_OK) {
      setClientsError("Supabase env manquantes (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).");
      setClientStats({
        total: 0,
        UE: 0,
        DROM: 0,
        "Hors UE": 0,
        direct: 0,
        indirect: 0,
        depositaire: 0,
        unknownChannel: 0,
      });
      setClientsLoading(false);
      return;
    }

    try {
      // On lit un set minimal. Si tu as énormément de clients, on remplacera par une VIEW agrégée.
      const { data, error } = await supabase
        .from("clients")
        .select("id, export_zone, drom_code, canal")
        .limit(10000);

      if (error) throw error;

      const rows = (data ?? []) as ClientMini[];
      const total = rows.length;

      const byZone: Record<Zone, number> = { UE: 0, DROM: 0, "Hors UE": 0 };
      let direct = 0;
      let indirect = 0;
      let depositaire = 0;
      let unknownChannel = 0;

      for (const c of rows) {
        const zRaw = (c.export_zone || "").toUpperCase().trim();
        let z: Zone = "Hors UE";
        if (zRaw.includes("DROM")) z = "DROM";
        else if (zRaw === "UE" || zRaw.includes("EU")) z = "UE";
        else if (zRaw.includes("HORS")) z = "Hors UE";

        // Si drom_code renseigné, on force DROM
        if (c.drom_code && safeText(c.drom_code).trim() !== "") z = "DROM";

        byZone[z] = (byZone[z] ?? 0) + 1;

        const canal = (c.canal || "").toLowerCase().trim();
        // On reste permissif : tu normaliseras plus tard via enum/table
        if (canal.includes("direct")) direct += 1;
        else if (canal.includes("indirect")) indirect += 1;
        else if (canal.includes("depos")) depositaire += 1;
        else unknownChannel += 1;
      }

      setClientStats({
        total,
        UE: byZone.UE,
        DROM: byZone.DROM,
        "Hors UE": byZone["Hors UE"],
        direct,
        indirect,
        depositaire,
        unknownChannel,
      });
    } catch (e: any) {
      setClientsError(e?.message || "Erreur chargement clients");
      setClientStats({
        total: 0,
        UE: 0,
        DROM: 0,
        "Hors UE": 0,
        direct: 0,
        indirect: 0,
        depositaire: 0,
        unknownChannel: 0,
      });
    } finally {
      setClientsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadFlows();
    void loadClientsStats();
  }, [loadFlows, loadClientsStats]);

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
              <Link to="/invoices">
                <FileCheck2 className="h-4 w-4" />
                Factures
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

        {/* Sources status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Statut des sources</CardTitle>
            <CardDescription>Vérifie rapidement si l’app lit bien Supabase</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Badge variant={SUPABASE_ENV_OK ? "default" : "destructive"}>
              Supabase env {SUPABASE_ENV_OK ? "OK" : "KO"}
            </Badge>
            <Badge variant="outline">products</Badge>
            <Badge variant="outline">clients</Badge>
            <Badge variant="outline">flows</Badge>
          </CardContent>
        </Card>

        {/* KPI row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Products */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="h-4 w-4" />
                Produits
              </CardTitle>
              <CardDescription>Table : products</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {productsError ? <p className="text-sm text-red-600">{productsError}</p> : null}

              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">{productsLoading ? "…" : productStats.total}</div>
                <Button variant="outline" size="sm" onClick={refreshProducts} disabled={productsLoading}>
                  <RefreshCw className={`h-4 w-4 ${productsLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">Nouveautés: {productStats.nouveautes}</Badge>
                <Badge variant="secondary">LPPR: {productStats.lppr}</Badge>
                <Badge variant="secondary">TVA OK: {productStats.withTva}</Badge>
              </div>

              <div className="pt-1">
                <Button asChild size="sm" variant="outline" className="w-full justify-between">
                  <Link to="/products">
                    Ouvrir référentiel produits <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Clients */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4" />
                Clients export
              </CardTitle>
              <CardDescription>Table : clients</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {clientsError ? <p className="text-sm text-red-600">{clientsError}</p> : null}

              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">{clientsLoading ? "…" : clientStats.total}</div>
                <Button variant="outline" size="sm" onClick={loadClientsStats} disabled={clientsLoading}>
                  <RefreshCw className={`h-4 w-4 ${clientsLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">UE: {clientStats.UE}</Badge>
                <Badge variant="outline">DROM: {clientStats.DROM}</Badge>
                <Badge variant="outline">Hors UE: {clientStats["Hors UE"]}</Badge>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">Direct: {clientStats.direct}</Badge>
                <Badge variant="secondary">Indirect: {clientStats.indirect}</Badge>
                <Badge variant="secondary">Dépositaire: {clientStats.depositaire}</Badge>
              </div>

              <div className="pt-1">
                <Button asChild size="sm" variant="outline" className="w-full justify-between">
                  <Link to="/clients">
                    Ouvrir base clients <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Invoice control */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileCheck2 className="h-4 w-4" />
                Contrôle facture
              </CardTitle>
              <CardDescription>Objectif : HT/TVA/TTC + Transit + OM/OMR</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Ici on centralise le “vrai” : produit + destination + client (+ groupement ensuite).
              </p>

              <div className="grid grid-cols-1 gap-2">
                <Button asChild className="justify-between">
                  <Link to="/invoice-verification">
                    Vérifier une facture <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>

                <Button asChild variant="outline" className="justify-between">
                  <Link to="/simulator">
                    Simuler un envoi export <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Prochaine brique : règles transit par destination + OM/OMR par HS code.
              </p>
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* Flows */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Derniers flux
            </CardTitle>
            <CardDescription>Lecture rapide par destination / zone (depuis flows.data)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {flowsError ? <p className="text-sm text-red-600">{flowsError}</p> : null}

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline">UE: {flowsByZone.UE}</Badge>
              <Badge variant="outline">DROM: {flowsByZone.DROM}</Badge>
              <Badge variant="outline">Hors UE: {flowsByZone["Hors UE"]}</Badge>

              <Button variant="outline" size="sm" onClick={loadFlows} disabled={flowsLoading} className="ml-auto">
                <RefreshCw className={`h-4 w-4 mr-2 ${flowsLoading ? "animate-spin" : ""}`} />
                Actualiser
              </Button>
            </div>

            {flowsLoading ? (
              <p className="text-sm text-muted-foreground">Chargement…</p>
            ) : recentFlows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun flux à afficher.</p>
            ) : (
              <div className="space-y-2">
                {recentFlows.slice(0, 16).map((f) => {
                  const dest = extractDestination(f.data);
                  let z: Zone = "Hors UE";
                  if (dest) {
                    try {
                      z = (getZoneFromDestination(dest as any) as Zone) || "Hors UE";
                    } catch {
                      z = "Hors UE";
                    }
                  }

                  return (
                    <div
                      key={f.id}
                      className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 rounded-lg border p-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{f.flow_code}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          Destination: {dest || "—"}{" "}
                          <span className="ml-2 inline-flex items-center gap-2">{zoneBadge(z)}</span>
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

            <div className="pt-2">
              <Button asChild variant="outline" className="w-full justify-between">
                <Link to="/flows">
                  Ouvrir la liste des flux <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
