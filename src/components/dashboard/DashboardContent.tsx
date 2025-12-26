import { useEffect, useMemo, useState } from "react";
import { KPICard } from "@/components/dashboard/KPICard";
import { FlowsChart } from "@/components/dashboard/FlowsChart";
import { CostsBarChart } from "@/components/dashboard/CostsBarChart";
import { RecentFlowsTable } from "@/components/dashboard/RecentFlowsTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useFlows } from "@/hooks/useFlows";
import { SUPABASE_ENV_OK, supabase } from "@/integrations/supabase/client";
import {
  AlertTriangle,
  Euro,
  FileCheck,
  MapPin,
  Package,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";

type SalesByZoneRow = { export_zone: string; flows_count: number; sales_value_ht: number };
type SalesByDestinationRow = { destination: string; flows_count: number; sales_value_ht: number };
type ClientsByZoneRow = { export_zone: string; clients_count: number };
type TopProductsByZoneRow = {
  export_zone: string;
  code_article: string;
  libelle_article: string | null;
  qty_total: number;
  ca_catalogue_ht: number;
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(
    Number.isFinite(amount) ? amount : 0
  );

export function DashboardContent({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const { flows, isLoading } = useFlows();

  // --------- Local KPIs (flows localStorage) ----------
  const totalFlows = flows.length;

  const totalGoodsValue = useMemo(
    () => flows.reduce((sum, f: any) => sum + (Number(f.goods_value) || 0), 0),
    [flows]
  );

  const totalCosts = useMemo(
    () =>
      flows.reduce((sum, f: any) => {
        const t =
          (Number(f.cost_transport) || 0) +
          (Number(f.cost_customs_clearance) || 0) +
          (Number(f.cost_duties) || 0) +
          (Number(f.cost_import_vat) || 0) +
          (Number(f.cost_octroi_mer) || 0) +
          (Number(f.cost_octroi_mer_regional) || 0) +
          (Number(f.cost_other) || 0);
        return sum + t;
      }, 0),
    [flows]
  );

  const totalOM = useMemo(
    () =>
      flows.reduce((sum, f: any) => sum + (Number(f.cost_octroi_mer) || 0) + (Number(f.cost_octroi_mer_regional) || 0), 0),
    [flows]
  );

  const riskyFlows = useMemo(
    () => flows.filter((f: any) => (f.risk_level || "").toLowerCase() === "risque").length,
    [flows]
  );

  const incotermData = useMemo(() => {
    const pick = (code: string) => flows.filter((f: any) => f.incoterm === code).length;
    const data = [
      { name: "EXW", value: pick("EXW"), color: "hsl(var(--primary))" },
      { name: "FCA", value: pick("FCA"), color: "hsl(var(--status-ok))" },
      { name: "DAP", value: pick("DAP"), color: "hsl(var(--status-warning))" },
      { name: "DDP", value: pick("DDP"), color: "hsl(var(--status-risk))" },
    ];
    return data.filter((d) => d.value > 0);
  }, [flows]);

  const costsByDestination = useMemo(() => {
    const agg = new Map<string, { destination: string; transport: number; douane: number; om: number }>();
    flows.forEach((f: any) => {
      const key = String(f.destination || "UNKNOWN");
      const prev = agg.get(key) || { destination: key, transport: 0, douane: 0, om: 0 };
      prev.transport += Number(f.cost_transport) || 0;
      prev.douane += (Number(f.cost_customs_clearance) || 0) + (Number(f.cost_duties) || 0);
      prev.om += (Number(f.cost_octroi_mer) || 0) + (Number(f.cost_octroi_mer_regional) || 0);
      agg.set(key, prev);
    });
    return Array.from(agg.values())
      .sort((a, b) => b.transport + b.douane + b.om - (a.transport + a.douane + a.om))
      .slice(0, 6);
  }, [flows]);

  // --------- Supabase insights (optional) ----------
  const [sbLoading, setSbLoading] = useState(false);
  const [sbError, setSbError] = useState<string>("");

  const [salesByZone, setSalesByZone] = useState<SalesByZoneRow[]>([]);
  const [salesByDestination, setSalesByDestination] = useState<SalesByDestinationRow[]>([]);
  const [clientsByZone, setClientsByZone] = useState<ClientsByZoneRow[]>([]);
  const [topProductsByZone, setTopProductsByZone] = useState<TopProductsByZoneRow[]>([]);

  const refreshSupabaseInsights = async () => {
    if (!SUPABASE_ENV_OK) return;

    setSbLoading(true);
    setSbError("");

    try {
      const r1 = await supabase.from("v_kpi_sales_by_zone").select("*");
      if (r1.error) throw r1.error;
      setSalesByZone((r1.data ?? []) as SalesByZoneRow[]);

      const r2 = await supabase.from("v_kpi_sales_by_destination").select("*");
      if (r2.error) throw r2.error;
      setSalesByDestination((r2.data ?? []) as SalesByDestinationRow[]);

      const r3 = await supabase.from("v_kpi_clients_by_zone").select("*");
      if (r3.error) throw r3.error;
      setClientsByZone((r3.data ?? []) as ClientsByZoneRow[]);

      // optional view
      const r4 = await supabase.from("v_kpi_top_products_by_zone").select("*").limit(50);
      if (!r4.error) {
        setTopProductsByZone((r4.data ?? []) as TopProductsByZoneRow[]);
      } else {
        // si la vue n’existe pas encore, on ignore
        setTopProductsByZone([]);
      }
    } catch (e: any) {
      setSbError(e?.message || "Erreur Supabase (KPIs).");
    } finally {
      setSbLoading(false);
    }
  };

  useEffect(() => {
    // auto load once
    if (SUPABASE_ENV_OK) void refreshSupabaseInsights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bestZoneSales = salesByZone?.[0];
  const bestZoneClients = [...clientsByZone].sort((a, b) => (b.clients_count || 0) - (a.clients_count || 0))[0];
  const bestDestinationSales = salesByDestination?.[0];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-56" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!embedded ? null : (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Insights</h2>
            <Badge variant="secondary">local + supabase</Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={refreshSupabaseInsights}
              disabled={!SUPABASE_ENV_OK || sbLoading}
              title={!SUPABASE_ENV_OK ? "Configurer VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY" : "Rafraîchir"}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${sbLoading ? "animate-spin" : ""}`} />
              Rafraîchir
            </Button>
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard title="Flux" value={totalFlows} subtitle="Total" icon={Package} />
        <KPICard title="Valeur marchandises" value={`${(totalGoodsValue / 1000).toFixed(0)}k €`} subtitle="HT" icon={TrendingUp} />
        <KPICard
          title="Charges"
          value={`${(totalCosts / 1000).toFixed(1)}k €`}
          subtitle={`dont ${(totalOM / 1000).toFixed(1)}k € OM/OMR`}
          icon={Euro}
        />
        <KPICard
          title="Flux à risque"
          value={riskyFlows}
          subtitle="À prioriser"
          icon={AlertTriangle}
          className={riskyFlows > 0 ? "border-status-risk/30" : ""}
        />
      </div>

      {/* charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FlowsChart data={incotermData} title="Répartition par Incoterm" />
        <CostsBarChart data={costsByDestination} title="Coûts par destination (Top 6)" />
      </div>

      {/* recent flows */}
      <RecentFlowsTable flows={flows.slice(0, 8)} />

      {/* supabase insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            KPIs Supabase (zones / clients / ventes)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!SUPABASE_ENV_OK ? (
            <div className="text-sm text-muted-foreground">
              Supabase non configuré (env manquantes) → insights désactivés.
            </div>
          ) : sbError ? (
            <div className="text-sm text-red-600">{sbError}</div>
          ) : sbLoading ? (
            <div className="text-sm text-muted-foreground">Chargement des KPIs…</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-xl border p-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Zone</Badge>
                  <span className="text-sm text-muted-foreground">+ CA</span>
                </div>
                <div className="mt-2 text-lg font-semibold">
                  {bestZoneSales?.export_zone || "—"}
                </div>
                <div className="text-sm text-muted-foreground">
                  {bestZoneSales ? `${formatCurrency(bestZoneSales.sales_value_ht)} • ${bestZoneSales.flows_count} flows` : "—"}
                </div>
              </div>

              <div className="rounded-xl border p-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Zone</Badge>
                  <span className="text-sm text-muted-foreground">+ clients</span>
                </div>
                <div className="mt-2 text-lg font-semibold">
                  {bestZoneClients?.export_zone || "—"}
                </div>
                <div className="text-sm text-muted-foreground">
                  {bestZoneClients ? `${bestZoneClients.clients_count} clients` : "—"}
                </div>
              </div>

              <div className="rounded-xl border p-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Destination</Badge>
                  <span className="text-sm text-muted-foreground">+ CA</span>
                </div>
                <div className="mt-2 text-lg font-semibold">
                  {bestDestinationSales?.destination || "—"}
                </div>
                <div className="text-sm text-muted-foreground">
                  {bestDestinationSales ? `${formatCurrency(bestDestinationSales.sales_value_ht)} • ${bestDestinationSales.flows_count} flows` : "—"}
                </div>
              </div>
            </div>
          )}

          {SUPABASE_ENV_OK && topProductsByZone.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Top produits (par zone)</div>
                <Badge variant="secondary">{topProductsByZone.length} lignes</Badge>
              </div>
              <div className="rounded-xl border overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="text-left p-3">Zone</th>
                      <th className="text-left p-3">Code</th>
                      <th className="text-left p-3">Libellé</th>
                      <th className="text-right p-3">Qté</th>
                      <th className="text-right p-3">CA catalogue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProductsByZone.slice(0, 20).map((r, idx) => (
                      <tr key={`${r.export_zone}-${r.code_article}-${idx}`} className="border-t">
                        <td className="p-3">{r.export_zone}</td>
                        <td className="p-3 font-mono">{r.code_article}</td>
                        <td className="p-3">{r.libelle_article || "—"}</td>
                        <td className="p-3 text-right">{r.qty_total}</td>
                        <td className="p-3 text-right">{formatCurrency(r.ca_catalogue_ht)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="text-xs text-muted-foreground">
                *Cette vue dépend de <code className="font-mono">flows.data.lines</code>. Si tu ne l’as pas encore, on la branche ensuite.
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* placeholder for invoices KPIs later */}
      <Card className="opacity-90">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            Rapprochement factures (prochain step)
            <Badge variant="secondary" className="ml-2">
              bientôt
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          On rebranche ensuite tes imports factures / coûts (tu as déjà les briques côté app). Je l’ai isolé pour avancer vite sur “produit + zone + client”.
        </CardContent>
      </Card>

      {/* small alert */}
      {totalFlows === 0 ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldAlert className="h-4 w-4" />
          Aucun flow : importe/crée des opérations pour alimenter les KPIs.
        </div>
      ) : null}
    </div>
  );
}
