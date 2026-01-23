import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw, Download, Plus } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { ExportFiltersBar } from "@/components/export/ExportFiltersBar";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

import { supabase } from "@/integrations/supabase/client";
import { useCosts } from "@/hooks/useCosts";
import type { ExportFilters } from "@/domain/export/types";

type InvoiceRawRow = {
  id: string;
  client_name: string | null;
  island: string | null;
  entered_date: string | null;
  packages_count: number | null;
  packages_label: string | null;
  transport_cost_ht: number | null;
  invoice_refs: string | null;
  transit_fees_ht: number | null;
  invoice_amount_ht: number | null;
  products_amount_ht: number | null;
  source: string | null;
};

type OmMaxRateRow = {
  territory_code: string;
  om_rate_max: number | null;
  omr_rate_max: number | null;
  om_total_rate_max: number | null;
  year: number | null;
};

const TERRITORIES = [
  { code: "FR", label: "Métropole" },
  { code: "GP", label: "Guadeloupe" },
  { code: "MQ", label: "Martinique" },
  { code: "GF", label: "Guyane" },
  { code: "RE", label: "Réunion" },
  { code: "YT", label: "Mayotte" },
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

function normalizeIslandToTerritoryCode(island: string | null | undefined): string {
  const s = String(island ?? "").trim().toLowerCase();
  if (!s) return "UNK";

  if (["gp", "guadeloupe"].some((x) => s === x || s.includes(x))) return "GP";
  if (["mq", "martinique"].some((x) => s === x || s.includes(x))) return "MQ";
  if (["gf", "guyane", "guyane française", "guyane francaise"].some((x) => s === x || s.includes(x))) return "GF";
  if (["re", "réunion", "reunion"].some((x) => s === x || s.includes(x))) return "RE";
  if (["yt", "mayotte"].some((x) => s === x || s.includes(x))) return "YT";

  if (["fr", "metropole", "métropole", "france"].some((x) => s === x || s.includes(x))) return "FR";

  if (s.includes("971")) return "GP";
  if (s.includes("972")) return "MQ";
  if (s.includes("973")) return "GF";
  if (s.includes("974")) return "RE";
  if (s.includes("976")) return "YT";

  return "UNK";
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

  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
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

function makeId(): string {
  // cost_lines.id est TEXT
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = typeof crypto !== "undefined" ? crypto : null;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function SummaryTile({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-lg border p-3 bg-card/50">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold">{formatMoney(value, 0)}</div>
      {hint ? <div className="text-[11px] text-muted-foreground mt-1">{hint}</div> : null}
    </div>
  );
}

async function fetchInvoicesRaw(filters: ExportFilters): Promise<InvoiceRawRow[]> {
  let q = supabase
    .from("sales_invoices_raw")
    .select(
      "id,client_name,island,entered_date,packages_count,packages_label,transport_cost_ht,invoice_refs,transit_fees_ht,invoice_amount_ht,products_amount_ht,source"
    )
    .order("entered_date", { ascending: false })
    .limit(5000);

  if (filters.from) q = q.gte("entered_date", filters.from);
  if (filters.to) q = q.lte("entered_date", filters.to);

  const { data, error } = await q;
  if (error) throw error;

  const rows = (data || []) as any as InvoiceRawRow[];

  const terr = (filters.territory || "").toUpperCase();
  return terr ? rows.filter((r) => normalizeIslandToTerritoryCode(r.island) === terr) : rows;
}

async function fetchOmMaxRates(): Promise<OmMaxRateRow[]> {
  const { data, error } = await supabase
    .from("v_om_max_rate_by_territory")
    .select("territory_code,om_rate_max,omr_rate_max,om_total_rate_max,year")
    .limit(5000);

  if (error) throw error;
  return (data || []) as any;
}

export default function Costs() {
  const { resolvedRange, variables } = useGlobalFilters();

  const [filters, setFilters] = React.useState<ExportFilters>({
    from: resolvedRange.from,
    to: resolvedRange.to,
    territory: variables.territory_code || undefined,
  });

  React.useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      from: resolvedRange.from,
      to: resolvedRange.to,
      territory: variables.territory_code || prev.territory,
    }));
  }, [resolvedRange.from, resolvedRange.to, variables.territory_code]);

  const invoicesQuery = useQuery({
    queryKey: ["costs-sales-invoices-raw", filters.from, filters.to, filters.territory],
    queryFn: () => fetchInvoicesRaw(filters),
  });

  const omRatesQuery = useQuery({
    queryKey: ["costs-om-max-rates"],
    queryFn: () => fetchOmMaxRates(),
  });

  React.useEffect(() => {
    if (invoicesQuery.error) toast.error((invoicesQuery.error as Error).message);
  }, [invoicesQuery.error]);
  React.useEffect(() => {
    if (omRatesQuery.error) toast.error((omRatesQuery.error as Error).message);
  }, [omRatesQuery.error]);

  // cost_lines (charges manuelles) filtrées par date + destination (territory)
  const {
    rows: manualLines,
    isLoading: manualLoading,
    error: manualError,
    warning: manualWarning,
    refresh: refreshManual,
  } = useCosts({
    from: filters.from,
    to: filters.to,
    destination: filters.territory || undefined,
  });

  const invoices = invoicesQuery.data || [];
  const omRates = omRatesQuery.data || [];

  const omRateMap = React.useMemo(() => {
    const m = new Map<string, number>();
    omRates.forEach((r) => {
      const code = String(r.territory_code || "").toUpperCase();
      const rate = safeNumber(r.om_total_rate_max);
      if (code) m.set(code, rate);
    });
    return m;
  }, [omRates]);

  const totals = React.useMemo(() => {
    const transportReal = invoices.reduce((s, r) => s + safeNumber(r.transport_cost_ht), 0);
    const transitFees = invoices.reduce((s, r) => s + safeNumber(r.transit_fees_ht), 0);
    const productsHT = invoices.reduce((s, r) => s + safeNumber(r.products_amount_ht), 0);

    // OM théorique : on applique le taux MAX du territoire
    // si pas de filtre territoire -> on calcule ligne par ligne avec la destination déduite via island
    const omTheoretical = invoices.reduce((s, r) => {
      const terr = normalizeIslandToTerritoryCode(r.island);
      const rate = omRateMap.get(terr) ?? 0;
      return s + safeNumber(r.products_amount_ht) * rate;
    }, 0);

    const manualCharges = manualLines.reduce((s, r) => s + safeNumber(r.amount), 0);

    // ✅ KPI demandé
    const kpiNonRepercute = transportReal + omTheoretical - transitFees;
    const totalNonRepercute = kpiNonRepercute + manualCharges;

    return { transportReal, transitFees, productsHT, omTheoretical, manualCharges, kpiNonRepercute, totalNonRepercute };
  }, [invoices, manualLines, omRateMap]);

  const byTerritory = React.useMemo(() => {
    const m = new Map<
      string,
      { invoices: number; productsHT: number; transport: number; transit: number; omTheo: number; manual: number }
    >();

    invoices.forEach((r) => {
      const terr = normalizeIslandToTerritoryCode(r.island);
      const rate = omRateMap.get(terr) ?? 0;
      const cur = m.get(terr) || { invoices: 0, productsHT: 0, transport: 0, transit: 0, omTheo: 0, manual: 0 };
      cur.invoices += 1;
      cur.productsHT += safeNumber(r.products_amount_ht);
      cur.transport += safeNumber(r.transport_cost_ht);
      cur.transit += safeNumber(r.transit_fees_ht);
      cur.omTheo += safeNumber(r.products_amount_ht) * rate;
      m.set(terr, cur);
    });

    manualLines.forEach((c) => {
      const terr = String(c.destination || "UNK").toUpperCase();
      const cur = m.get(terr) || { invoices: 0, productsHT: 0, transport: 0, transit: 0, omTheo: 0, manual: 0 };
      cur.manual += safeNumber(c.amount);
      m.set(terr, cur);
    });

    const rows = Array.from(m.entries())
      .filter(([k]) => k !== "UNK")
      .map(([territory, v]) => {
        const kpi = v.transport + v.omTheo - v.transit;
        return {
          territory,
          invoices: v.invoices,
          productsHT: v.productsHT,
          transport: v.transport,
          transit: v.transit,
          omTheo: v.omTheo,
          kpiNonRepercute: kpi,
          manualCharges: v.manual,
          totalNonRepercute: kpi + v.manual,
        };
      })
      .sort((a, b) => b.totalNonRepercute - a.totalNonRepercute);

    return rows;
  }, [invoices, manualLines, omRateMap]);

  const isLoadingAny = invoicesQuery.isLoading || omRatesQuery.isLoading || manualLoading;

  function refreshAll() {
    invoicesQuery.refetch();
    omRatesQuery.refetch();
    refreshManual();
  }

  function exportKpiCsv() {
    const csv = toCsv([
      {
        from: filters.from ?? "",
        to: filters.to ?? "",
        territory: filters.territory ?? "ALL",
        products_amount_ht: totals.productsHT,
        transport_cost_ht: totals.transportReal,
        transit_fees_ht: totals.transitFees,
        om_theoretical_estimated: totals.omTheoretical,
        kpi_non_repercute: totals.kpiNonRepercute,
        manual_charges: totals.manualCharges,
        total_non_repercute: totals.totalNonRepercute,
      },
    ]);
    downloadText(csv, `kpi_non_repercute_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  function exportDetailCsv() {
    const detail = invoices.map((r) => {
      const terr = normalizeIslandToTerritoryCode(r.island);
      const rate = omRateMap.get(terr) ?? 0;
      const omTheo = safeNumber(r.products_amount_ht) * rate;
      return {
        entered_date: r.entered_date ?? "",
        territory: terr,
        island_raw: r.island ?? "",
        client_name: r.client_name ?? "",
        invoice_refs: r.invoice_refs ?? "",
        packages_count: r.packages_count ?? "",
        products_amount_ht: safeNumber(r.products_amount_ht),
        om_rate_max_used: rate,
        om_theoretical: omTheo,
        transport_cost_ht: safeNumber(r.transport_cost_ht),
        transit_fees_ht: safeNumber(r.transit_fees_ht),
        kpi_row: safeNumber(r.transport_cost_ht) + omTheo - safeNumber(r.transit_fees_ht),
        invoice_amount_ht: safeNumber(r.invoice_amount_ht),
        source: r.source ?? "",
      };
    });
    downloadText(toCsv(detail), `detail_non_repercute_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  // Ajout charge manuelle
  const [newDate, setNewDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [newDestination, setNewDestination] = React.useState<string>(filters.territory || "FR");
  const [newType, setNewType] = React.useState<string>("AUTRE");
  const [newAmount, setNewAmount] = React.useState<string>("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (filters.territory) setNewDestination(filters.territory);
  }, [filters.territory]);

  async function addManualCost() {
    const amount = safeNumber(newAmount);
    if (!newDate) return toast.error("Date manquante.");
    if (!newDestination) return toast.error("Destination manquante.");
    if (!newType) return toast.error("Type manquant.");
    if (amount <= 0) return toast.error("Montant invalide.");

    setSaving(true);
    try {
      const payload = { id: makeId(), date: newDate, destination: newDestination, cost_type: newType, amount };
      const { error } = await supabase.from("cost_lines").insert(payload as any);
      if (error) throw error;

      setNewAmount("");
      toast.success("Charge ajoutée ✅");
      await refreshManual();
    } catch (e: any) {
      toast.error(e?.message || "Erreur ajout cost_lines");
    } finally {
      setSaving(false);
    }
  }

  const missingOmRateWarning = React.useMemo(() => {
    // si on a des factures sur un territoire mais pas de taux OM max
    const terrs = new Set(invoices.map((r) => normalizeIslandToTerritoryCode(r.island)));
    const missing = Array.from(terrs).filter((t) => t !== "UNK" && !omRateMap.has(t));
    if (!missing.length) return null;
    return `Taux OM theorique manquant pour: ${missing.join(", ")}`;
  }, [invoices, omRateMap]);

  return (
    <AppLayout contentClassName="md:p-8">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Coûts export</p>
            <h1 className="text-2xl font-bold">Charges & coûts non répercutés</h1>
            <p className="text-sm text-muted-foreground">
              KPI = <b>Transport réel</b> + <b>OM théorique (max)</b> − <b>Frais de transit</b>
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={refreshAll} disabled={isLoadingAny} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${isLoadingAny ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
            <Button variant="outline" onClick={exportKpiCsv} className="gap-2">
              <Download className="h-4 w-4" />
              Export KPI
            </Button>
            <Button variant="outline" onClick={exportDetailCsv} disabled={invoices.length === 0} className="gap-2">
              <Download className="h-4 w-4" />
              Export détails
            </Button>
          </div>
        </div>

        <ExportFiltersBar value={filters} onChange={setFilters} onRefresh={refreshAll} loading={isLoadingAny} />

        {missingOmRateWarning ? (
          <Card className="border-amber-300 bg-amber-50">
            <CardContent className="pt-4 text-sm text-amber-900">{missingOmRateWarning}</CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>KPI non répercuté (avec OM théorique)</CardTitle>
            <CardDescription>
              Transport & transit depuis <code className="text-xs">sales_invoices_raw</code>. OM théorique ={" "}
              <code className="text-xs">products_amount_ht × max(om_rate+omr_rate)</code> par territoire.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <SummaryTile label="Produits HT" value={totals.productsHT} hint="products_amount_ht" />
            <SummaryTile label="Transport réel" value={totals.transportReal} hint="transport_cost_ht" />
            <SummaryTile label="Frais de transit" value={totals.transitFees} hint="transit_fees_ht" />
            <SummaryTile label="OM théorique (max)" value={totals.omTheoretical} hint="taux max par territoire" />
            <SummaryTile label="KPI non répercuté" value={totals.kpiNonRepercute} hint="Transport + OM − Transit" />
            <SummaryTile label="Total (KPI + manuelles)" value={totals.totalNonRepercute} hint="inclut cost_lines" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Répartition par territoire</CardTitle>
            <CardDescription>Où tu perds le plus (non répercuté).</CardDescription>
          </CardHeader>
          <CardContent className="overflow-auto border rounded-md">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b text-muted-foreground">
                  <th className="py-2 px-3 text-left font-medium">Territoire</th>
                  <th className="py-2 px-3 text-right font-medium">Factures</th>
                  <th className="py-2 px-3 text-right font-medium">Produits HT</th>
                  <th className="py-2 px-3 text-right font-medium">Transport</th>
                  <th className="py-2 px-3 text-right font-medium">Transit</th>
                  <th className="py-2 px-3 text-right font-medium">OM théorique</th>
                  <th className="py-2 px-3 text-right font-medium">KPI</th>
                  <th className="py-2 px-3 text-right font-medium">Manuel</th>
                  <th className="py-2 px-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {byTerritory.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-4 px-3 text-center text-muted-foreground">
                      Aucune donnée sur la période.
                    </td>
                  </tr>
                ) : (
                  byTerritory.map((r) => (
                    <tr key={r.territory} className="border-b last:border-0">
                      <td className="py-2 px-3 font-semibold">{r.territory}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{r.invoices}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{formatMoney(r.productsHT, 0)}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{formatMoney(r.transport, 0)}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{formatMoney(r.transit, 0)}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{formatMoney(r.omTheo, 0)}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{formatMoney(r.kpiNonRepercute, 0)}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{formatMoney(r.manualCharges, 0)}</td>
                      <td className="py-2 px-3 text-right tabular-nums font-semibold">{formatMoney(r.totalNonRepercute, 0)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {(manualError || manualWarning) && (
          <Card className={(manualWarning || "").toLowerCase().includes("manquante") ? "border-amber-300 bg-amber-50" : "border-red-200 bg-red-50"}>
            <CardContent className="pt-4 text-sm">{manualError || manualWarning}</CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Ajouter une charge manuelle</CardTitle>
            <CardDescription>Pour les dépenses non visibles dans les imports (douane, surcoût transport, etc.).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Date</p>
                <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Destination</p>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={newDestination}
                  onChange={(e) => setNewDestination(e.target.value)}
                >
                  {TERRITORIES.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.code} — {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Type</p>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                >
                  <option value="AUTRE">AUTRE</option>
                  <option value="DOUANE">DOUANE</option>
                  <option value="TRANSPORT_PLUS">TRANSPORT_PLUS</option>
                  <option value="DOSSIER">DOSSIER</option>
                  <option value="PACKAGING">PACKAGING</option>
                </select>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Montant (€)</p>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  placeholder="Ex: 12.50"
                />
              </div>
            </div>

            <Button onClick={addManualCost} disabled={saving} className="gap-2">
              <Plus className="h-4 w-4" />
              {saving ? "Ajout..." : "Ajouter"}
            </Button>

            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">Lignes (manuel): {manualLines.length}</Badge>
              <Badge variant="secondary">
                Total manuel: {formatMoney(manualLines.reduce((s, r) => s + safeNumber(r.amount), 0), 2)}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
