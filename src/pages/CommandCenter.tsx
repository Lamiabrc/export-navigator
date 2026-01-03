import * as React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";
import { useProducts } from "@/hooks/useProducts";
import { getZoneFromDestination } from "@/data/referenceRates";
import { fetchAllWithPagination } from "@/utils/supabasePagination";
import { BreakdownFilters, isMissingTableError } from "@/domain/calc";

import {
  Activity,
  FileCheck2,
  Calculator,
  Users,
  Package,
  Settings2,
  RefreshCw,
  ArrowRight,
  Globe,
  AlertTriangle,
  Landmark,
} from "lucide-react";
import { BenchmarkTable } from "@/components/competition/BenchmarkTable";
import { DromCompetitionCards } from "@/components/competition/DromCompetitionCards";
import { EventsFeed } from "@/components/competition/EventsFeed";
import { CompetitionAlerts } from "@/components/competition/CompetitionAlerts";
import { CsvImport } from "@/components/competition/CsvImport";
import { useCompetitors } from "@/hooks/useCompetitors";
import { useCompetitorSnapshots } from "@/hooks/useCompetitorSnapshots";
import { useCompetitorEvents } from "@/hooks/useCompetitorEvents";

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

type ClientStats = {
  total: number;
  UE: number;
  DROM: number;
  "Hors UE": number;
  direct: number;
  indirect: number;
  depositaire: number;
  unknownChannel: number;
};

type QueryResult<T> = {
  rows: T[];
  warning?: string;
};

type ClientResult = {
  stats: ClientStats;
  warning?: string;
};

type CompetitionSettings = {
  priceGapAlertPct: number;
  priceDropAlertPct: number;
  promoImpactScoreMin: number;
};

const COMPETITION_SQL = `-- Tables concurrence (idempotent)
create table if not exists public.competitors (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  brand text,
  notes text,
  active bool default true,
  created_at timestamp with time zone default now()
);

create table if not exists public.competitor_presence (
  id uuid default gen_random_uuid() primary key,
  competitor_id uuid references public.competitors(id) on delete cascade,
  territory_code text,
  channel text,
  distributor text,
  active bool default true
);

create table if not exists public.competitor_snapshots (
  id uuid default gen_random_uuid() primary key,
  snapshot_date date default current_date,
  competitor_id uuid references public.competitors(id) on delete set null,
  territory_code text,
  product_ref text,
  product_name text,
  list_price numeric,
  net_price_est numeric,
  currency text,
  incoterm text,
  promo_flag bool,
  promo_details text,
  availability text,
  source text,
  confidence int default 50,
  created_at timestamp with time zone default now()
);

create table if not exists public.competitor_events (
  id uuid default gen_random_uuid() primary key,
  event_date date default current_date,
  competitor_id uuid references public.competitors(id) on delete set null,
  territory_code text,
  kind text,
  title text,
  details text,
  source text,
  impact_score int default 0,
  created_at timestamp with time zone default now()
);

create index if not exists idx_comp_snapshots_prod_territory on public.competitor_snapshots(product_ref, territory_code);
create index if not exists idx_comp_events_date on public.competitor_events(event_date desc);`;

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
  const [activeTab, setActiveTab] = React.useState<"overview" | "competitors">("overview");
  const [filters, setFilters] = React.useState<BreakdownFilters>({});
  const [competitionFilters, setCompetitionFilters] = React.useState({
    from: "",
    to: "",
    territory: "",
    productQuery: "",
    dromOnly: true,
  });
  const [competitionSettings, setCompetitionSettings] = React.useState<CompetitionSettings>({
    priceGapAlertPct: 10,
    priceDropAlertPct: 8,
    promoImpactScoreMin: 7,
  });
  const [showSql, setShowSql] = React.useState(false);
  const [simulateRow, setSimulateRow] = React.useState<{ product_ref: string; territory: string; ourPrice: number | null; bestPrice: number | null; gapPct: number | null } | null>(null);

  const {
    stats: productStats,
    isLoading: productsLoading,
    error: productsError,
    refresh: refreshProducts,
  } = useProducts({ pageSize: 2000 });

  const emptyStats: ClientStats = {
    total: 0,
    UE: 0,
    DROM: 0,
    "Hors UE": 0,
    direct: 0,
    indirect: 0,
    depositaire: 0,
    unknownChannel: 0,
  };

  const flowsQuery = useQuery<QueryResult<FlowRow>>({
    queryKey: ["command-center", "flows"],
    queryFn: async () => {
      if (!SUPABASE_ENV_OK) {
        return { rows: [], warning: "Supabase env manquantes (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)." };
      }

      const { data, error } = await supabase
        .from("flows")
        .select("id, flow_code, data, created_at")
        .order("created_at", { ascending: false })
        .limit(40);

      if (error) {
        if (isMissingTableError(error)) return { rows: [], warning: "Table flows manquante côté Supabase." };
        throw error;
      }

      return { rows: (data ?? []) as FlowRow[] };
    },
    staleTime: 30_000,
  });

  const clientsQuery = useQuery<ClientResult>({
    queryKey: ["command-center", "clients"],
    queryFn: async () => {
      if (!SUPABASE_ENV_OK) {
        return { stats: emptyStats, warning: "Supabase env manquantes (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)." };
      }

      try {
        const pageSize = 1000;

        const rows = await fetchAllWithPagination<ClientMini>(
          (from, to) =>
            supabase
              .from("clients")
              .select("id, export_zone, drom_code, canal")
              .order("id", { ascending: true })
              .range(from, to),
          pageSize,
        );

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

          if (c.drom_code && safeText(c.drom_code).trim() !== "") z = "DROM";

          byZone[z] = (byZone[z] ?? 0) + 1;

          const canal = (c.canal || "").toLowerCase().trim();
          if (canal.includes("direct")) direct += 1;
          else if (canal.includes("indirect")) indirect += 1;
          else if (canal.includes("depos")) depositaire += 1;
          else unknownChannel += 1;
        }

        return {
          stats: {
            total,
            UE: byZone.UE,
            DROM: byZone.DROM,
            "Hors UE": byZone["Hors UE"],
            direct,
            indirect,
            depositaire,
            unknownChannel,
          },
        };
      } catch (err: any) {
        return { stats: emptyStats, warning: err?.message || "Erreur chargement clients" };
      }
    },
    staleTime: 30_000,
  });

  const flowsByZone: Record<Zone, number> = { UE: 0, DROM: 0, "Hors UE": 0 };
  const recentFlows = flowsQuery.data?.rows ?? [];
  for (const f of recentFlows) {
    const dest = extractDestination(f.data);
    let z: Zone = "Hors UE";
    if (dest) {
      try {
        z = (getZoneFromDestination(dest as any) as Zone) || "Hors UE";
      } catch {
        z = "Hors UE";
      }
    }
    flowsByZone[z] = (flowsByZone[z] ?? 0) + 1;
  }

  const clientStats = clientsQuery.data?.stats ?? emptyStats;
  const number = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
  const warning = productsError || clientsQuery.data?.warning || flowsQuery.data?.warning;
  const filteredFlows = recentFlows.filter((f) => {
    const dest = extractDestination(f.data);
    if (filters.destination && dest !== filters.destination) return false;
    return true;
  });

  const destinationEntries = Object.entries(
    filteredFlows.reduce<Record<string, { caHt: number; costs: number; margin: number }>>((acc, flow) => {
      const dest = extractDestination(flow.data) || "NA";
      const values = acc[dest] || { caHt: 0, costs: 0, margin: 0 };
      values.caHt += Number(flow.data?.ca_ht || flow.data?.amount_ht || 0);
      values.costs += Number(flow.data?.costs || 0);
      values.margin += Number(flow.data?.margin || 0);
      acc[dest] = values;
      return acc;
    }, {}),
  );

  const zoneEntries = Object.entries(
    filteredFlows.reduce<Record<string, { caHt: number; costs: number; margin: number }>>((acc, flow) => {
      const dest = extractDestination(flow.data);
      let z: Zone = "Hors UE";
      if (dest) {
        try {
          z = (getZoneFromDestination(dest as any) as Zone) || "Hors UE";
        } catch {
          z = "Hors UE";
        }
      }
      const values = acc[z] || { caHt: 0, costs: 0, margin: 0 };
      values.caHt += Number(flow.data?.ca_ht || flow.data?.amount_ht || 0);
      values.costs += Number(flow.data?.costs || 0);
      values.margin += Number(flow.data?.margin || 0);
      acc[z] = values;
      return acc;
    }, {}),
  );

  const { competitors, presence, competitorsById } = useCompetitors();

  const { state: snapshotsState, bulkInsert } = useCompetitorSnapshots({
    from: competitionFilters.from || undefined,
    to: competitionFilters.to || undefined,
    territories: competitionFilters.dromOnly ? ["GP", "MQ", "GF", "RE", "YT"] : competitionFilters.territory ? [competitionFilters.territory] : undefined,
    productQuery: competitionFilters.productQuery || undefined,
  });
  const { state: eventsState } = useCompetitorEvents({
    from: competitionFilters.from || undefined,
    to: competitionFilters.to || undefined,
    territories: competitionFilters.dromOnly ? ["GP", "MQ", "GF", "RE", "YT"] : competitionFilters.territory ? [competitionFilters.territory] : undefined,
  });

  const [ourPriceMap, setOurPriceMap] = React.useState<Map<string, number>>(new Map());
  React.useEffect(() => {
    let active = true;
    const load = async () => {
      if (!SUPABASE_ENV_OK) return;
      const map = new Map<string, number>();
      try {
        const { data, error } = await supabase
          .from("sales")
          .select("product_ref, territory_code, amount_ttc, sale_date")
          .order("sale_date", { ascending: false })
          .limit(400);
        if (error) return;
        (data || []).forEach((row: any) => {
          const key = `${row.product_ref || ""}::${row.territory_code || ""}`;
          if (!map.has(key)) map.set(key, Number(row.amount_ttc || 0));
          const terrKey = `${row.territory_code || ""}::latest`;
          if (!map.has(terrKey)) map.set(terrKey, Number(row.amount_ttc || 0));
        });
        if (active) setOurPriceMap(map);
      } catch {
        if (active) setOurPriceMap(map);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [competitionFilters.dromOnly, competitionFilters.territory]);

  React.useEffect(() => {
    const loadSettings = async () => {
      if (!SUPABASE_ENV_OK) return;
      const { data } = await supabase.from("export_settings").select("key,data").eq("key", "competition").maybeSingle();
      const payload = (data?.data || {}) as any;
      setCompetitionSettings((prev) => ({
        priceGapAlertPct: Number(payload?.price_gap_alert_pct ?? payload?.priceGapAlertPct ?? prev.priceGapAlertPct),
        priceDropAlertPct: Number(payload?.price_drop_alert_pct ?? payload?.priceDropAlertPct ?? prev.priceDropAlertPct),
        promoImpactScoreMin: Number(payload?.promo_impact_score_min ?? payload?.promoImpactScoreMin ?? prev.promoImpactScoreMin),
      }));
    };
    void loadSettings();
  }, []);

  const competitionWarning = snapshotsState.warning || eventsState.warning || competitors.warning || presence.warning;

  const dromPressure = React.useMemo(() => {
    const dromRows = snapshotsState.data.filter((s) => ["GP", "MQ", "GF", "RE", "YT"].includes((s.territory_code || "").toUpperCase()));
    let risky = 0;
    let base = 0;
    dromRows.forEach((r) => {
      if (r.list_price && r.net_price_est) {
        base += 1;
        if (r.list_price > r.net_price_est * (1 + competitionSettings.priceGapAlertPct / 100)) risky += 1;
      }
    });
    return base === 0 ? 0 : Math.round((risky / base) * 100);
  }, [snapshotsState.data, competitionSettings.priceGapAlertPct]);

  const alertCount = React.useMemo(() => {
    const eventsStrong = eventsState.data.filter((e) => (e.impact_score || 0) >= competitionSettings.promoImpactScoreMin).length;
    return eventsStrong;
  }, [eventsState.data, competitionSettings.promoImpactScoreMin]);

  const handleSimulate = (row: { product_ref: string; territory: string; ourPrice: number | null; bestPrice: number | null; gapPct: number | null }) => {
    setSimulateRow(row);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Tour de contrôle Export / Facturation</p>
            <h1 className="text-2xl font-bold">Command Center</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/simulator">
                <Calculator className="h-4 w-4 mr-2" />
                Simulateur
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/verifier">
                <FileCheck2 className="h-4 w-4 mr-2" />
                Vérifier facture
              </Link>
            </Button>
          </div>
        </div>

        {warning ? (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <div>
              <div className="font-semibold">Mode dégradé</div>
              <p>{warning}</p>
            </div>
          </div>
        ) : null}

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="competitors">Concurrents</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Activity className="h-4 w-4" />
                    Flux récents
                  </CardTitle>
                  <CardDescription>Table flows</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="outline">UE: {flowsByZone.UE}</Badge>
                    <Badge variant="outline">DROM: {flowsByZone.DROM}</Badge>
                    <Badge variant="outline">Hors UE: {flowsByZone["Hors UE"]}</Badge>
                  </div>
                  <div className="pt-1">
                    <Button asChild size="sm" variant="outline" className="w-full justify-between">
                      <Link to="/flows">
                        Ouvrir <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Produits
                  </CardTitle>
                  <CardDescription>Référentiel Supabase products</CardDescription>
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
                      <Link to={`/products${filters.productId ? `?q=${encodeURIComponent(filters.productId)}` : ""}`}>
                        Ouvrir référentiel produits <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Clients export
                  </CardTitle>
                  <CardDescription>Référentiel Supabase clients</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold">
                      {clientsQuery.isLoading ? "…" : clientStats.total}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => clientsQuery.refetch()}
                      disabled={clientsQuery.isLoading}
                    >
                      <RefreshCw className={`h-4 w-4 ${clientsQuery.isLoading ? "animate-spin" : ""}`} />
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
                      <Link to={`/clients${filters.clientId ? `?q=${encodeURIComponent(filters.clientId)}` : ""}`}>
                        Ouvrir base clients <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Landmark className="h-4 w-4" />
                    Pression concurrentielle
                  </CardTitle>
                  <CardDescription>DROM uniquement</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-2xl font-bold">{dromPressure}% produits > seuil</div>
                  <div className="text-sm text-muted-foreground">{alertCount} alertes fortes</div>
                  <Button asChild size="sm" variant="outline" className="w-full justify-between">
                    <Link to="/command-center#competitors">
                      Voir onglet Concurrents <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Derniers flux
                </CardTitle>
                <CardDescription>Lecture rapide par destination / zone (flows)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline">UE: {flowsByZone.UE}</Badge>
                  <Badge variant="outline">DROM: {flowsByZone.DROM}</Badge>
                  <Badge variant="outline">Hors UE: {flowsByZone["Hors UE"]}</Badge>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => flowsQuery.refetch()}
                    disabled={flowsQuery.isLoading}
                    className="ml-auto"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${flowsQuery.isLoading ? "animate-spin" : ""}`} />
                    Actualiser
                  </Button>
                </div>

                {flowsQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Chargement…</p>
                ) : recentFlows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun flux à afficher.</p>
                ) : (
                  <div className="space-y-2">
                    {recentFlows.map((f) => {
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
                              Destination: {dest || "–"}{" "}
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
          </TabsContent>

          <TabsContent value="competitors" className="space-y-4" id="competitors">
            <Card>
              <CardHeader className="flex flex-col gap-2">
                <CardTitle className="text-lg">Market & Concurrents</CardTitle>
                <CardDescription>Benchmark prix, veille événements, alertes.</CardDescription>
                {competitionWarning ? (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5" />
                    <div>
                      <div className="font-semibold">Veille concurrence non configurée</div>
                      <p>{competitionWarning}</p>
                    </div>
                  </div>
                ) : null}
                <div className="grid gap-3 md:grid-cols-5">
                  <div className="col-span-2">
                    <Label className="text-xs">Période</Label>
                    <div className="flex gap-2">
                      <Input
                        type="date"
                        value={competitionFilters.from}
                        onChange={(e) => setCompetitionFilters((f) => ({ ...f, from: e.target.value }))}
                      />
                      <Input
                        type="date"
                        value={competitionFilters.to}
                        onChange={(e) => setCompetitionFilters((f) => ({ ...f, to: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Territoire</Label>
                    <Input
                      placeholder="FR / GP / MQ..."
                      value={competitionFilters.territory}
                      onChange={(e) => setCompetitionFilters((f) => ({ ...f, territory: e.target.value.toUpperCase() }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Produit</Label>
                    <Input
                      placeholder="Réf produit"
                      value={competitionFilters.productQuery}
                      onChange={(e) => setCompetitionFilters((f) => ({ ...f, productQuery: e.target.value }))}
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <Switch
                      checked={competitionFilters.dromOnly}
                      onCheckedChange={(checked) => setCompetitionFilters((f) => ({ ...f, dromOnly: checked }))}
                    />
                    <Label className="text-xs">DROM only</Label>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <BenchmarkTable
              snapshots={snapshotsState.data}
              competitorsById={competitorsById}
              ourPrices={ourPriceMap}
              thresholds={{
                priceGapAlertPct: competitionSettings.priceGapAlertPct,
                priceDropAlertPct: competitionSettings.priceDropAlertPct,
              }}
              onSimulate={handleSimulate}
            />

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-4">
                <DromCompetitionCards
                  snapshots={snapshotsState.data}
                  events={eventsState.data}
                  ourPrices={ourPriceMap}
                  thresholds={{
                    priceGapAlertPct: competitionSettings.priceGapAlertPct,
                    promoImpactScoreMin: competitionSettings.promoImpactScoreMin,
                  }}
                />
                <EventsFeed events={eventsState.data} competitorsById={competitorsById} />
              </div>
              <div className="space-y-4">
                <CompetitionAlerts
                  snapshots={snapshotsState.data}
                  events={eventsState.data}
                  competitorsById={competitorsById}
                  thresholds={{
                    priceGapAlertPct: competitionSettings.priceGapAlertPct,
                    priceDropAlertPct: competitionSettings.priceDropAlertPct,
                    promoImpactScoreMin: competitionSettings.promoImpactScoreMin,
                  }}
                />

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Simulateur alignement</CardTitle>
                    <CardDescription>Impact rapide si on s'aligne sur le meilleur prix.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {simulateRow ? (
                      <>
                        <div className="text-sm font-semibold">{simulateRow.product_ref} / {simulateRow.territory}</div>
                        <div className="text-sm text-muted-foreground">Notre prix: {simulateRow.ourPrice ?? "?"}</div>
                        <div className="text-sm text-muted-foreground">Best concurrent: {simulateRow.bestPrice ?? "?"}</div>
                        <div className="text-sm">
                          Écart: {simulateRow.gapPct !== null ? `${simulateRow.gapPct.toFixed(1)}%` : "n/a"}
                        </div>
                        {simulateRow.bestPrice && simulateRow.ourPrice ? (
                          <div className="rounded-lg bg-muted/50 p-2 text-sm">
                            Baisse nécessaire: {(simulateRow.ourPrice - simulateRow.bestPrice).toFixed(2)}.
                            Impact marge unitaire: {(simulateRow.bestPrice - simulateRow.ourPrice).toFixed(2)}.
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">Sélectionner "Simuler alignement" dans la table.</p>
                    )}
                  </CardContent>
                </Card>

                <CsvImport loading={snapshotsState.loading} onImport={async (rows) => { await bulkInsert(rows); }} />

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Settings2 className="h-4 w-4" />
                      SQL tables concurrence
                    </CardTitle>
                    <CardDescription>Si tables absentes, copier ce SQL.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button variant="outline" size="sm" onClick={() => setShowSql((v) => !v)}>
                      {showSql ? "Masquer" : "Afficher"} SQL
                    </Button>
                    {showSql ? <Textarea className="text-xs" value={COMPETITION_SQL} readOnly /> : null}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
