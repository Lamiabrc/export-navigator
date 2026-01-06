import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Download, Truck, Plane, Plus } from "lucide-react";

import { useCosts } from "@/hooks/useCosts";
import { supabase } from "@/integrations/supabase/client";
import { useDhlSalesQuotes } from "@/hooks/useDhlSalesQuotes";
import { ExportFiltersBar } from "@/components/export/ExportFiltersBar";
import { fetchKpis } from "@/domain/export/queries";
import { ExportFilters } from "@/domain/export/types";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { toast } from "sonner";

type PricingSummary = { territory: string; skuCount: number; avgPlv: number };

const DROM = ["GP", "MQ", "GF", "RE", "YT"];

const TERRITORIES: { code: string; label: string }[] = [
  { code: "FR", label: "Métropole" },
  { code: "GP", label: "Guadeloupe" },
  { code: "MQ", label: "Martinique" },
  { code: "GF", label: "Guyane" },
  { code: "RE", label: "Réunion" },
  { code: "YT", label: "Mayotte" },
  { code: "UE", label: "Union Européenne" },
];

function safeNumber(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(n: number, digits = 2) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: digits,
  }).format(Number.isFinite(n) ? n : 0);
}

function zoneForDestination(dest: string) {
  const up = (dest || "").toUpperCase();
  if (DROM.includes(up)) return "DROM";
  if (up === "FR") return "FR";
  return "UE";
}

function toCsv(rows: Record<string, any>[]) {
  if (!rows.length) return "";
  const headers = Array.from(
    rows.reduce((set, r) => {
      Object.keys(r).forEach((k) => set.add(k));
      return set;
    }, new Set<string>())
  );

  const esc = (v: any) => {
    const s = v === null || v === undefined ? "" : String(v);
    const needsQuotes = /[,"\n\r;]/.test(s);
    const normalized = s.replace(/"/g, '""');
    return needsQuotes ? `"${normalized}"` : normalized;
  };

  const lines = [
    headers.join(","), // header
    ...rows.map((r) => headers.map((h) => esc(r[h])).join(",")),
  ];
  return lines.join("\n");
}

function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3 bg-card/50">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold">{formatMoney(value, 0)}</div>
    </div>
  );
}

export default function Costs() {
  const { resolvedRange, variables } = useGlobalFilters();
  const [filters, setFilters] = React.useState<ExportFilters>({
    from: resolvedRange.from,
    to: resolvedRange.to,
    territory: variables.territory_code || undefined,
    clientId: variables.client_id || undefined,
  });

  React.useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      from: resolvedRange.from,
      to: resolvedRange.to,
      territory: variables.territory_code || prev.territory,
      clientId: variables.client_id || prev.clientId,
    }));
  }, [resolvedRange.from, resolvedRange.to, variables.territory_code, variables.client_id]);

  const kpisQuery = useQuery({
    queryKey: ["export-costs-kpis", filters],
    queryFn: () => fetchKpis(filters),
  });

  React.useEffect(() => {
    if (kpisQuery.error) toast.error((kpisQuery.error as Error).message);
  }, [kpisQuery.error]);

  // -------------------- Charges (table costs via hook) --------------------
  const { rows, isLoading, error, warning, refresh } = useCosts();

  const [q, setQ] = React.useState("");
  const filtered = React.useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return rows;

    return rows.filter((r: any) => {
      const hay = [
        r.date,
        r.cost_type,
        r.amount,
        r.currency,
        r.market_zone,
        r.destination,
        r.incoterm,
        r.order_id,
        r.client_id,
        r.product_id,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(query);
    });
  }, [rows, q]);

  const totalCharges = React.useMemo(
    () => filtered.reduce((s: number, r: any) => s + safeNumber(r.amount), 0),
    [filtered]
  );

  function exportChargesCsv() {
    const csv = toCsv(
      filtered.map((r: any) => ({
        date: r.date ?? "",
        cost_type: r.cost_type ?? "",
        amount: r.amount ?? 0,
        currency: r.currency ?? "",
        market_zone: r.market_zone ?? "",
        destination: r.destination ?? "",
        incoterm: r.incoterm ?? "",
        order_id: r.order_id ?? "",
        client_id: r.client_id ?? "",
        product_id: r.product_id ?? "",
      }))
    );

    downloadText(csv, `costs_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  // -------------------- DHL quotes --------------------
  const [destinations, setDestinations] = React.useState<{ id: string; name: string | null }[]>([]);
  const [dhlDestinationId, setDhlDestinationId] = React.useState<string>("all");

  const {
    data: dhlQuotes,
    loading: dhlLoading,
    error: dhlError,
    refetch: refetchDhl,
  } = useDhlSalesQuotes({
    destinationId: dhlDestinationId === "all" ? undefined : dhlDestinationId,
  });

  React.useEffect(() => {
    let mounted = true;

    supabase
      .from("export_destinations")
      .select("id,name")
      .order("name", { ascending: true })
      .limit(1000)
      .then(({ data, error: destError }) => {
        if (!mounted) return;
        if (!destError && data) setDestinations(data as any);
      })
      .catch(console.error);

    return () => {
      mounted = false;
    };
  }, []);

  const dhlTotal = React.useMemo(
    () => (dhlQuotes || []).reduce((s: number, x: any) => s + safeNumber(x?.dhl_transport_eur), 0),
    [dhlQuotes]
  );

  function exportDhlCsv() {
    if (!dhlQuotes?.length) return;
    const csv = toCsv(
      dhlQuotes.map((x: any) => ({
        sale_id: x.sale_id ?? "",
        sale_date: x.sale_date ?? "",
        destination_name: x.destination_name ?? "",
        dhl_zone: x.dhl_zone ?? "",
        quantity: x.quantity ?? "",
        total_actual_weight_kg: x.total_actual_weight_kg ?? "",
        dhl_transport_eur: x.dhl_transport_eur ?? "",
      }))
    );
    downloadText(csv, `dhl_quotes_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  // -------------------- Form: add order charges --------------------
  const [orderId, setOrderId] = React.useState("");
  const [transportAmount, setTransportAmount] = React.useState<string>("");
  const [dossierAmount, setDossierAmount] = React.useState<string>("");
  const [currency, setCurrency] = React.useState("EUR");
  const [destination, setDestination] = React.useState("FR");
  const [incoterm, setIncoterm] = React.useState("DAP");
  const [isSavingOrderCharges, setIsSavingOrderCharges] = React.useState(false);

  async function addOrderCharges() {
    const oid = orderId.trim();
    if (!oid) {
      alert("Merci de renseigner un ID de commande.");
      return;
    }

    const t = safeNumber(transportAmount);
    const d = safeNumber(dossierAmount);
    if (t <= 0 && d <= 0) {
      alert("Renseigne au moins un montant (transport ou dossier).");
      return;
    }

    const market_zone = zoneForDestination(destination);

    const payload: any[] = [];
    const today = new Date().toISOString().slice(0, 10);

    if (t > 0) {
      payload.push({
        date: today,
        cost_type: "TRANSPORT",
        amount: t,
        currency: currency || "EUR",
        market_zone,
        destination: destination || null,
        incoterm: incoterm || null,
        order_id: oid,
      });
    }
    if (d > 0) {
      payload.push({
        date: today,
        cost_type: "DOSSIER",
        amount: d,
        currency: currency || "EUR",
        market_zone,
        destination: destination || null,
        incoterm: incoterm || null,
        order_id: oid,
      });
    }

    setIsSavingOrderCharges(true);
    try {
      const { error } = await supabase.from("costs").insert(payload);
      if (error) throw error;

      setOrderId("");
      setTransportAmount("");
      setDossierAmount("");

      await refresh?.();
      alert("Charges ajoutées ✅");
    } catch (e: any) {
      alert(e?.message || "Erreur lors de l'ajout des charges.");
    } finally {
      setIsSavingOrderCharges(false);
    }
  }

  // -------------------- Pricing export + mini dashboard (v_export_pricing) --------------------
  const [pricingTerritory, setPricingTerritory] = React.useState<string>("FR");
  const [isExportPricing, setIsExportPricing] = React.useState(false);
  const [pricingWarning, setPricingWarning] = React.useState<string>("");
  const [pricingDashboard, setPricingDashboard] = React.useState<PricingSummary[]>([]);

  async function exportPricingCsv() {
    setIsExportPricing(true);
    setPricingWarning("");
    try {
      // On exporte tout le catalogue, éventuellement filtrable (si la vue a un champ territory_code)
      const { data, error } = await supabase
        .from("v_export_pricing")
        .select("*")
        .limit(20000);

      if (error) throw error;

      const filtered = (data || []).filter((r: any) => {
        if (!pricingTerritory) return true;
        const terr = String(r?.territory_code ?? r?.territory ?? "").toUpperCase();
        return pricingTerritory === "UE" ? terr === "UE" : terr === pricingTerritory;
      });

      const csv = toCsv(
        filtered.map((r: any) => ({
          territory_code: r.territory_code ?? "",
          sku: r.sku ?? r.code_article ?? "",
          name: r.name ?? r.libelle_article ?? "",
          plv_metropole_ttc: r.plv_metropole_ttc ?? "",
          plv_om_ttc: r.plv_om_ttc ?? "",
          vat_rate: r.vat_rate ?? "",
          om: r.om ?? "",
          omr: r.omr ?? "",
          lppr: r.lppr ?? r.tarif_lppr_eur ?? "",
          competitor_price: r.competitor_price ?? "",
        }))
      );

      downloadText(csv, `export_pricing_${pricingTerritory}_${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (e: any) {
      setPricingWarning(e?.message || "Erreur export v_export_pricing");
    } finally {
      setIsExportPricing(false);
    }
  }

  React.useEffect(() => {
    // Dashboard simple (avg PLV) depuis v_export_pricing
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from("v_export_pricing")
          .select("territory_code,plv_metropole_ttc,plv_om_ttc,sku")
          .limit(5000);

        if (error) throw error;

        const agg = new Map<string, { sum: number; count: number }>();
        (data || []).forEach((r: any) => {
          const terr = String(r.territory_code || "FR").toUpperCase();
          const val = safeNumber(r.plv_om_ttc ?? r.plv_metropole_ttc ?? 0);
          const cur = agg.get(terr) || { sum: 0, count: 0 };
          cur.sum += val;
          cur.count += 1;
          agg.set(terr, cur);
        });

        const res: PricingSummary[] = Array.from(agg.entries()).map(([territory, v]) => ({
          territory,
          skuCount: v.count,
          avgPlv: v.count ? v.sum / v.count : 0,
        }));

        setPricingDashboard(res.sort((a, b) => a.territory.localeCompare(b.territory)));
      } catch (err: any) {
        setPricingWarning(err?.message || "Erreur lecture v_export_pricing");
      }
    };

    void load();
  }, []);

  const estimatedCosts = kpisQuery.data?.estimatedExportCosts;
  const transitGap = (kpisQuery.data?.totalTransit ?? 0) - (estimatedCosts?.total ?? 0);

  // -------------------- UI --------------------
  return (
    <MainLayout contentClassName="md:p-8">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Coûts export</p>
            <h1 className="text-2xl font-bold">Costs</h1>
            <p className="text-sm text-muted-foreground">Charges, estimation DHL, et export du catalogue pricing.</p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={refresh} disabled={isLoading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
            <Button variant="outline" onClick={exportChargesCsv} disabled={isLoading || filtered.length === 0} className="gap-2">
              <Download className="h-4 w-4" />
              Export charges (CSV)
            </Button>
          </div>
        </div>

        <ExportFiltersBar value={filters} onChange={setFilters} onRefresh={() => { kpisQuery.refetch(); refresh(); }} loading={kpisQuery.isLoading} />

        <Card>
          <CardHeader>
            <CardTitle>Coûts export estimés (factures)</CardTitle>
            <CardDescription>Basé sur OM / octroi / TVA des tables Supabase, filtre période + territoire + client.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <SummaryTile label="OM" value={estimatedCosts?.om ?? 0} />
            <SummaryTile label="Octroi" value={estimatedCosts?.octroi ?? 0} />
            <SummaryTile label="TVA" value={estimatedCosts?.vat ?? 0} />
            <SummaryTile label="Autres règles" value={estimatedCosts?.extraRules ?? 0} />
            <SummaryTile label="Total coûts export" value={estimatedCosts?.total ?? 0} />
            <div className="md:col-span-5 rounded-lg border p-3 bg-muted/30 flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Écart transit vs coûts export estimés</div>
                <div className="text-sm text-muted-foreground">Transit inclut dans invoice_ht, pas dans transport_cost_eur.</div>
              </div>
              <div className="text-xl font-semibold">{formatMoney(transitGap, 0)}</div>
            </div>
          </CardContent>
        </Card>

        {kpisQuery.data?.warning ? (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-4 text-sm text-amber-800">{kpisQuery.data.warning}</CardContent>
          </Card>
        ) : null}

        {/* ERRORS */}
        {error || warning ? (
          <Card className={(warning || "").toLowerCase().includes("manquante") ? "border-amber-300 bg-amber-50" : "border-red-200"}>
            <CardContent className="pt-6 text-sm text-foreground">{error || warning}</CardContent>
          </Card>
        ) : null}

        {/* Charges list */}
        <Card>
          <CardHeader>
            <CardTitle>Charges</CardTitle>
            <CardDescription>Recherche, total, et export CSV.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col md:flex-row md:items-end gap-3">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Recherche</p>
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ex: TRANSPORT, RE, DAP, CMD-2026…" />
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">Lignes: {filtered.length}</Badge>
                <Badge variant="secondary">Total: {formatMoney(totalCharges, 2)}</Badge>
              </div>
            </div>

            <div className="overflow-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2 px-3 text-left font-medium">Date</th>
                    <th className="py-2 px-3 text-left font-medium">Type</th>
                    <th className="py-2 px-3 text-left font-medium">Zone</th>
                    <th className="py-2 px-3 text-left font-medium">Destination</th>
                    <th className="py-2 px-3 text-left font-medium">Incoterm</th>
                    <th className="py-2 px-3 text-left font-medium">Commande</th>
                    <th className="py-2 px-3 text-right font-medium">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="py-4 px-3 text-center text-muted-foreground">
                        Chargement…
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-4 px-3 text-center text-muted-foreground">
                        Aucune charge.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((r: any) => (
                      <tr key={r.id ?? `${r.date}-${r.cost_type}-${r.order_id}-${r.amount}`} className="border-b last:border-0">
                        <td className="py-2 px-3">{r.date ?? "—"}</td>
                        <td className="py-2 px-3">{r.cost_type ?? "—"}</td>
                        <td className="py-2 px-3">{r.market_zone ?? "—"}</td>
                        <td className="py-2 px-3">{r.destination ?? "—"}</td>
                        <td className="py-2 px-3">{r.incoterm ?? "—"}</td>
                        <td className="py-2 px-3">{r.order_id ?? "—"}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{formatMoney(safeNumber(r.amount), 2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Add order charges */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Transport & traitement de dossier (par commande)
            </CardTitle>
            <CardDescription>Ajoute 1 ou 2 lignes dans la table <code className="text-xs">costs</code>.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">ID commande</p>
                <Input value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="Ex: CMD-2026-0001" />
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Destination</p>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                >
                  {["FR", ...DROM, "UE"].map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <div className="text-[11px] text-muted-foreground mt-1">Zone: {zoneForDestination(destination)}</div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Incoterm</p>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={incoterm}
                  onChange={(e) => setIncoterm(e.target.value)}
                >
                  {["EXW", "FCA", "DAP", "DDP"].map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Devise</p>
                <Input value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="EUR" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Transport (€)</p>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={transportAmount}
                  onChange={(e) => setTransportAmount(e.target.value)}
                  placeholder="Ex: 12.50"
                />
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Frais dossier (€)</p>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={dossierAmount}
                  onChange={(e) => setDossierAmount(e.target.value)}
                  placeholder="Ex: 3.00"
                />
              </div>

              <div className="flex items-end">
                <Button onClick={addOrderCharges} disabled={isSavingOrderCharges} className="gap-2 w-full">
                  <Plus className="h-4 w-4" />
                  {isSavingOrderCharges ? "Ajout..." : "Ajouter"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* DHL ESTIMATION */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plane className="h-5 w-5" />
              Estimation DHL (Economy Select • Export)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-end gap-3">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Destination</p>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={dhlDestinationId}
                  onChange={(e) => setDhlDestinationId(e.target.value)}
                >
                  <option value="all">Toutes</option>
                  {destinations.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name ?? d.id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={refetchDhl} disabled={dhlLoading} className="gap-2">
                  <RefreshCw className={`h-4 w-4 ${dhlLoading ? "animate-spin" : ""}`} />
                  Actualiser DHL
                </Button>
                <Button variant="outline" onClick={exportDhlCsv} disabled={dhlLoading || (dhlQuotes?.length ?? 0) === 0} className="gap-2">
                  <Download className="h-4 w-4" />
                  Export DHL (CSV)
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">Lignes: {dhlQuotes?.length ?? 0}</Badge>
              <Badge variant="secondary">Total estimé: {formatMoney(dhlTotal, 2)}</Badge>
            </div>

            {dhlError ? (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="pt-4 text-sm text-foreground">{dhlError}</CardContent>
              </Card>
            ) : null}

            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2 text-left font-medium">Vente</th>
                    <th className="py-2 text-left font-medium">Date</th>
                    <th className="py-2 text-left font-medium">Destination</th>
                    <th className="py-2 text-left font-medium">Zone DHL</th>
                    <th className="py-2 text-right font-medium">Qté</th>
                    <th className="py-2 text-right font-medium">Poids (kg)</th>
                    <th className="py-2 text-right font-medium">Transport (€)</th>
                  </tr>
                </thead>
                <tbody>
                  {dhlLoading ? (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-muted-foreground">
                        Chargement…
                      </td>
                    </tr>
                  ) : (dhlQuotes?.length ?? 0) === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-muted-foreground">
                        Pas de devis DHL : vérifier destination_id, mapping zone, poids produit.
                      </td>
                    </tr>
                  ) : (
                    dhlQuotes.map((x: any) => (
                      <tr key={x.sale_id ?? `${x.sale_date}-${x.destination_name}-${x.dhl_zone}`} className="border-b last:border-0">
                        <td className="py-2">{x.sale_id ?? "—"}</td>
                        <td className="py-2">{x.sale_date ?? "—"}</td>
                        <td className="py-2">{x.destination_name ?? "—"}</td>
                        <td className="py-2">{x.dhl_zone ?? "—"}</td>
                        <td className="py-2 text-right tabular-nums">{x.quantity ?? "—"}</td>
                        <td className="py-2 text-right tabular-nums">{x.total_actual_weight_kg ?? "—"}</td>
                        <td className="py-2 text-right tabular-nums">
                          {safeNumber(x.dhl_transport_eur).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* PRIX (v_export_pricing) */}
        <Card>
          <CardHeader>
            <CardTitle>Prix catalogue (export par territoire)</CardTitle>
            <CardDescription>
              Exporte depuis <code className="text-xs">v_export_pricing</code> (TVA, OM/OMR, TR/LPPR majoré, concurrence…).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col md:flex-row md:items-end gap-3">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Territoire</p>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={pricingTerritory}
                  onChange={(e) => setPricingTerritory(e.target.value)}
                >
                  {TERRITORIES.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.code} — {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <Button onClick={exportPricingCsv} disabled={isExportPricing} className="gap-2">
                  <Download className="h-4 w-4" />
                  {isExportPricing ? "Export..." : "Exporter le catalogue (CSV)"}
                </Button>
              </div>
            </div>

            {pricingWarning ? <p className="text-sm text-amber-600">{pricingWarning}</p> : null}
          </CardContent>
        </Card>

        {/* Pricing dashboard */}
        <Card>
          <CardHeader>
            <CardTitle>Dashboard pricing (avg PLV)</CardTitle>
            <CardDescription>Résumé rapide depuis v_export_pricing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {pricingDashboard.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune donnée.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-3">
                {pricingDashboard.map((row) => (
                  <div key={row.territory} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold">{row.territory}</span>
                      <Badge variant="outline">{row.skuCount} SKU</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">PLV moyenne: {formatMoney(row.avgPlv, 2)}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
