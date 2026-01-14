import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Download, Plus, Truck, Receipt } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { ExportFiltersBar } from "@/components/export/ExportFiltersBar";
import { fetchKpis } from "@/domain/export/queries";
import { ExportFilters } from "@/domain/export/types";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { toast } from "sonner";
import { useCosts } from "@/hooks/useCosts";

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

function formatMoney(n: number, digits = 0) {
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

function normalizeCostType(t: unknown) {
  return String(t || "").trim().toUpperCase();
}

const TRANSPORT_TYPES = new Set([
  "TRANSPORT",
  "FRET",
  "SHIPPING",
  "TRANSPORT_DHL",
  "TRANSPORT_FEDEX",
  "TRANSPORT_UPS",
]);

const TRANSIT_TYPES = new Set([
  "TRANSIT",
  "FRAIS_TRANSIT",
  "FRAIS DE TRANSIT",
  "TRANSITAIRE",
]);

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

  const lines = [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))];
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

function KpiTile({
  icon,
  label,
  value,
  hint,
  accent = "border-slate-200",
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className={`rounded-xl border ${accent} bg-card/60 p-3`}>
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{label}</div>
        {icon ? <div className="text-muted-foreground">{icon}</div> : null}
      </div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      {hint ? <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div> : null}
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

  // KPI export: taxes estimées + transit total (si exposé par fetchKpis)
  const kpisQuery = useQuery({
    queryKey: ["costs-kpis-nonrepercutes", filters],
    queryFn: () => fetchKpis(filters),
  });

  React.useEffect(() => {
    if (kpisQuery.error) toast.error((kpisQuery.error as Error).message);
  }, [kpisQuery.error]);

  // Charges réelles: cost_lines filtrées (période/territoire/client)
  const { rows, isLoading, error, warning, refresh } = useCosts({
    from: filters.from,
    to: filters.to,
    territory: filters.territory,
    clientId: filters.clientId,
  });

  // Recherche sur charges
  const [q, setQ] = React.useState("");
  const filteredRows = React.useMemo(() => {
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

  // Agrégats charges
  const chargesTotals = React.useMemo(() => {
    const total = filteredRows.reduce((s, r) => s + safeNumber(r.amount), 0);

    const transport = filteredRows.reduce((s, r) => {
      const t = normalizeCostType(r.cost_type);
      return s + (TRANSPORT_TYPES.has(t) ? safeNumber(r.amount) : 0);
    }, 0);

    const transitFees = filteredRows.reduce((s, r) => {
      const t = normalizeCostType(r.cost_type);
      return s + (TRANSIT_TYPES.has(t) ? safeNumber(r.amount) : 0);
    }, 0);

    const byType: Record<string, number> = {};
    filteredRows.forEach((r) => {
      const t = normalizeCostType(r.cost_type) || "AUTRE";
      byType[t] = (byType[t] || 0) + safeNumber(r.amount);
    });

    return { total, transport, transitFees, byType };
  }, [filteredRows]);

  // Taxes estimées (depuis fetchKpis)
  const estimatedCosts = kpisQuery.data?.estimatedExportCosts;
  const estOM = safeNumber(estimatedCosts?.om);
  const estOMR = safeNumber(estimatedCosts?.octroi); // selon ton modèle actuel (souvent OMR / octroi régional)
  const taxesOMTotal = estOM + estOMR;

  // Transit facturé (depuis KPI export)
  const totalTransitFacture = safeNumber(kpisQuery.data?.totalTransit);

  // ✅ KPI demandé
  // Coût non répercuté = (Transport + Taxes OM/OMR) - Transit facturé
  const kpiNonRepercute = React.useMemo(() => {
    return chargesTotals.transport + taxesOMTotal - totalTransitFacture;
  }, [chargesTotals.transport, taxesOMTotal, totalTransitFacture]);

  // Export CSV charges
  function exportChargesCsv() {
    const csv = toCsv(
      filteredRows.map((r: any) => ({
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
    downloadText(csv, `charges_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  // Ajout charge (table canonique = cost_lines)
  const [orderId, setOrderId] = React.useState("");
  const [transportAmount, setTransportAmount] = React.useState<string>("");
  const [dossierAmount, setDossierAmount] = React.useState<string>("");
  const [transitAmount, setTransitAmount] = React.useState<string>("");
  const [currency, setCurrency] = React.useState("EUR");
  const [destination, setDestination] = React.useState(filters.territory || "FR");
  const [incoterm, setIncoterm] = React.useState("DAP");
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    setDestination(filters.territory || "FR");
  }, [filters.territory]);

  async function addCharges() {
    const oid = orderId.trim();
    if (!oid) {
      toast.error("Merci de renseigner un ID de commande.");
      return;
    }

    const t = safeNumber(transportAmount);
    const d = safeNumber(dossierAmount);
    const tr = safeNumber(transitAmount);

    if (t <= 0 && d <= 0 && tr <= 0) {
      toast.error("Renseigne au moins un montant (transport, dossier, transit).");
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const market_zone = zoneForDestination(destination);

    const payload: any[] = [];

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

    // Optionnel: si tu saisis aussi le “frais transit” payé au transitaire
    if (tr > 0) {
      payload.push({
        date: today,
        cost_type: "FRAIS_TRANSIT",
        amount: tr,
        currency: currency || "EUR",
        market_zone,
        destination: destination || null,
        incoterm: incoterm || null,
        order_id: oid,
      });
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.from("cost_lines").insert(payload);
      if (error) throw error;

      setOrderId("");
      setTransportAmount("");
      setDossierAmount("");
      setTransitAmount("");

      await refresh();
      await kpisQuery.refetch();
      toast.success("Charges ajoutées ✅");
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de l'ajout des charges.");
    } finally {
      setIsSaving(false);
    }
  }

  // Synthèse par destination (pratique pour “où je perds”)
  const byDestination = React.useMemo(() => {
    const agg = new Map<string, { total: number; transport: number; transit: number; lines: number }>();
    filteredRows.forEach((r: any) => {
      const code = String(r.destination || "—").toUpperCase();
      const cur = agg.get(code) || { total: 0, transport: 0, transit: 0, lines: 0 };
      const amt = safeNumber(r.amount);
      const t = normalizeCostType(r.cost_type);
      cur.total += amt;
      cur.lines += 1;
      if (TRANSPORT_TYPES.has(t)) cur.transport += amt;
      if (TRANSIT_TYPES.has(t)) cur.transit += amt;
      agg.set(code, cur);
    });

    return Array.from(agg.entries())
      .map(([destination, v]) => ({ destination, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [filteredRows]);

  const territoryLabel =
    TERRITORIES.find((t) => t.code === (filters.territory || "FR"))?.label ||
    (filters.territory ? filters.territory : "Toutes");

  return (
    <MainLayout contentClassName="md:p-8">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Charges & coûts non répercutés</p>
            <h1 className="text-2xl font-bold">Costs</h1>
            <p className="text-sm text-muted-foreground">
              Suivi des charges réelles + taxes OM/OMR estimées, et KPI “Transport + OM − Transit”.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                kpisQuery.refetch();
                refresh();
              }}
              disabled={isLoading || kpisQuery.isLoading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${(isLoading || kpisQuery.isLoading) ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
            <Button
              variant="outline"
              onClick={exportChargesCsv}
              disabled={isLoading || filteredRows.length === 0}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Export charges (CSV)
            </Button>
          </div>
        </div>

        <ExportFiltersBar
          value={filters}
          onChange={setFilters}
          onRefresh={() => {
            kpisQuery.refetch();
            refresh();
          }}
          loading={kpisQuery.isLoading || isLoading}
        />

        {/* KPI */}
        <Card>
          <CardHeader>
            <CardTitle>KPI “coûts non répercutés”</CardTitle>
            <CardDescription>
              Période : <b>{filters.from}</b> → <b>{filters.to}</b> • Territoire : <b>{territoryLabel}</b>
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <KpiTile
              icon={<Truck className="h-4 w-4" />}
              label="Transport (charges réelles)"
              value={formatMoney(chargesTotals.transport, 0)}
              hint="Somme cost_lines où cost_type=TRANSPORT/FRET/SHIPPING…"
              accent="border-cyan-200"
            />

            <KpiTile
              icon={<Receipt className="h-4 w-4" />}
              label="Taxes OM/OMR estimées"
              value={formatMoney(taxesOMTotal, 0)}
              hint={`OM: ${formatMoney(estOM, 0)} • OMR/Octroi: ${formatMoney(estOMR, 0)}`}
              accent="border-amber-200"
            />

            <KpiTile
              label="Frais de transit facturés"
              value={formatMoney(totalTransitFacture, 0)}
              hint="Vient des KPI export (totalTransit)"
              accent="border-emerald-200"
            />

            <KpiTile
              label="✅ Coût non répercuté"
              value={formatMoney(kpiNonRepercute, 0)}
              hint="(Transport + OM/OMR) − Transit facturé"
              accent="border-rose-200"
            />

            <div className="md:col-span-4 rounded-xl border bg-muted/30 p-3 text-sm">
              <div className="text-muted-foreground">
                Lecture : si le KPI est <b>positif</b>, tu absorbes du coût. S’il est <b>négatif</b>, le transit couvre
                plus que (transport+OM).
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Warnings / errors */}
        {kpisQuery.data?.warning ? (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-4 text-sm text-amber-800">{kpisQuery.data.warning}</CardContent>
          </Card>
        ) : null}

        {error || warning ? (
          <Card className={(warning || "").toLowerCase().includes("manquante") ? "border-amber-300 bg-amber-50" : "border-red-200"}>
            <CardContent className="pt-6 text-sm text-foreground">{error || warning}</CardContent>
          </Card>
        ) : null}

        {/* Charges list */}
        <Card>
          <CardHeader>
            <CardTitle>Charges (cost_lines)</CardTitle>
            <CardDescription>Recherche, total, synthèse par destination, et export CSV.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col md:flex-row md:items-end gap-3">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Recherche</p>
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Ex: TRANSPORT, FRAIS_TRANSIT, RE, DAP, CMD-2026…"
                />
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">Lignes: {filteredRows.length}</Badge>
                <Badge variant="secondary">Total charges: {formatMoney(chargesTotals.total, 0)}</Badge>
                <Badge variant="secondary">Transit (charges): {formatMoney(chargesTotals.transitFees, 0)}</Badge>
              </div>
            </div>

            {/* Mini synthèse destination */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {byDestination.slice(0, 6).map((row) => (
                <div key={row.destination} className="rounded-xl border p-3 bg-card/50">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{row.destination}</div>
                    <Badge variant="outline">{row.lines} lignes</Badge>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Total: <b className="text-foreground">{formatMoney(row.total, 0)}</b>
                  </div>
                  <div className="text-[12px] text-muted-foreground">
                    Transport: {formatMoney(row.transport, 0)} • Transit: {formatMoney(row.transit, 0)}
                  </div>
                </div>
              ))}
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
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-4 px-3 text-center text-muted-foreground">
                        Aucune charge.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((r: any) => (
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

        {/* Add charges */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Ajouter des charges (par commande)
            </CardTitle>
            <CardDescription>
              Ajoute 1 à 3 lignes dans <code className="text-xs">cost_lines</code> : transport / dossier / frais transit.
            </CardDescription>
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

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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

              <div>
                <p className="text-xs text-muted-foreground mb-1">Frais transit (€)</p>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={transitAmount}
                  onChange={(e) => setTransitAmount(e.target.value)}
                  placeholder="Ex: 8.00"
                />
              </div>

              <div className="flex items-end">
                <Button onClick={addCharges} disabled={isSaving} className="gap-2 w-full">
                  <Plus className="h-4 w-4" />
                  {isSaving ? "Ajout..." : "Ajouter"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
