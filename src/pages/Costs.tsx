import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw, Download, Plus } from "lucide-react";

import { MainLayout } from "@/components/layout/MainLayout";
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
  entered_date: string | null; // date
  packages_count: number | null;
  packages_label: string | null;
  transport_cost_ht: number | null;
  invoice_refs: string | null;
  transit_fees_ht: number | null;
  invoice_amount_ht: number | null;
  products_amount_ht: number | null;
  source: string | null;
};

type TaxRow = {
  tax_date: string | null;
  territory_code: string | null;
  tax_name: string | null;
  tax_amount: number | null;
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

  // codes directs
  if (["gp", "guadeloupe"].some((x) => s === x || s.includes(x))) return "GP";
  if (["mq", "martinique"].some((x) => s === x || s.includes(x))) return "MQ";
  if (["gf", "guyane", "guyane française", "guyane francaise"].some((x) => s === x || s.includes(x))) return "GF";
  if (["re", "réunion", "reunion"].some((x) => s === x || s.includes(x))) return "RE";
  if (["yt", "mayotte"].some((x) => s === x || s.includes(x))) return "YT";

  if (["fr", "metropole", "métropole", "france"].some((x) => s === x || s.includes(x))) return "FR";

  // si dans tes imports "ile" contient juste "974", etc -> on tente
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
  // IMPORTANT: on filtre seulement par date côté SQL (colonnes certaines)
  // et on filtre "territory" côté front via normalizeIslandToTerritoryCode()
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

  // Filtre territoire (si choisi)
  const terr = (filters.territory || "").toUpperCase();
  const filtered = terr
    ? rows.filter((r) => normalizeIslandToTerritoryCode(r.island) === terr)
    : rows;

  return filtered;
}

async function fetchTaxes(filters: ExportFilters): Promise<TaxRow[]> {
  let q = supabase
    .from("taxes_om")
    .select("tax_date,territory_code,tax_name,tax_amount")
    .order("tax_date", { ascending: false })
    .limit(20000);

  if (filters.from) q = q.gte("tax_date", filters.from);
  if (filters.to) q = q.lte("tax_date", filters.to);
  if (filters.territory) q = q.eq("territory_code", filters.territory);

  const { data, error } = await q;
  if (error) throw error;

  return (data || []) as any;
}

export default function Costs() {
  const { resolvedRange, variables } = useGlobalFilters();

  const [filters, setFilters] = React.useState<ExportFilters>({
    from: resolvedRange.from,
    to: resolvedRange.to,
    territory: variables.territory_code || undefined,
    clientId: variables.client_id || undefined, // ⚠️ pas exploitable ici (pas de client_id dans sales_invoices_raw)
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

  const invoicesQuery = useQuery({
    queryKey: ["costs-sales-invoices-raw", filters.from, filters.to, filters.territory],
    queryFn: () => fetchInvoicesRaw(filters),
  });

  const taxesQuery = useQuery({
    queryKey: ["costs-taxes-om", filters.from, filters.to, filters.territory],
    queryFn: () => fetchTaxes(filters),
  });

  React.useEffect(() => {
    if (invoicesQuery.error) toast.error((invoicesQuery.error as Error).message);
  }, [invoicesQuery.error]);

  React.useEffect(() => {
    if (taxesQuery.error) toast.error((taxesQuery.error as Error).message);
  }, [taxesQuery.error]);

  // ✅ cost_lines : ici destination = "FR/GP/..." => on l’aligne sur filters.territory
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
  const taxes = taxesQuery.data || [];

  const totals = React.useMemo(() => {
    const transportReal = invoices.reduce((s, r) => s + safeNumber(r.transport_cost_ht), 0);
    const transitFees = invoices.reduce((s, r) => s + safeNumber(r.transit_fees_ht), 0);
    const taxesOm = taxes.reduce((s, r) => s + safeNumber(r.tax_amount), 0);
    const manualCharges = manualLines.reduce((s, r) => s + safeNumber(r.amount), 0);

    // KPI demandé
    const kpiNonRepercute = transportReal + taxesOm - transitFees;
    const totalNonRepercute = kpiNonRepercute + manualCharges;

    return { transportReal, transitFees, taxesOm, manualCharges, kpiNonRepercute, totalNonRepercute };
  }, [invoices, taxes, manualLines]);

  const byTerritory = React.useMemo(() => {
    const m = new Map<string, { transport: number; transit: number; invoices: number }>();
    invoices.forEach((r) => {
      const terr = normalizeIslandToTerritoryCode(r.island);
      const cur = m.get(terr) || { transport: 0, transit: 0, invoices: 0 };
      cur.transport += safeNumber(r.transport_cost_ht);
      cur.transit += safeNumber(r.transit_fees_ht);
      cur.invoices += 1;
      m.set(terr, cur);
    });

    const taxesByTerr = new Map<string, number>();
    taxes.forEach((t) => {
      const terr = String(t.territory_code || "UNK").toUpperCase();
      taxesByTerr.set(terr, (taxesByTerr.get(terr) || 0) + safeNumber(t.tax_amount));
    });

    const manualByTerr = new Map<string, number>();
    manualLines.forEach((c) => {
      const terr = String(c.destination || "UNK").toUpperCase();
      manualByTerr.set(terr, (manualByTerr.get(terr) || 0) + safeNumber(c.amount));
    });

    const rows = Array.from(m.entries()).map(([territory, v]) => {
      const om = taxesByTerr.get(territory) || 0;
      const manual = manualByTerr.get(territory) || 0;
      const kpi = v.transport + om - v.transit;
      return {
        territory,
        invoices: v.invoices,
        transport: v.transport,
        transit: v.transit,
        taxesOm: om,
        kpiNonRepercute: kpi,
        manualCharges: manual,
        totalNonRepercute: kpi + manual,
      };
    });

    // Ajouter les territoires qui n’ont pas d’invoices mais ont des taxes/cost_lines
    const allTerr = new Set<string>([
      ...Array.from(taxesByTerr.keys()),
      ...Array.from(manualByTerr.keys()),
      ...rows.map((r) => r.territory),
    ]);

    allTerr.forEach((t) => {
      if (rows.some((r) => r.territory === t)) return;
      const om = taxesByTerr.get(t) || 0;
      const manual = manualByTerr.get(t) || 0;
      rows.push({
        territory: t,
        invoices: 0,
        transport: 0,
        transit: 0,
        taxesOm: om,
        kpiNonRepercute: 0 + om - 0,
        manualCharges: manual,
        totalNonRepercute: (0 + om - 0) + manual,
      });
    });

    return rows
      .filter((r) => r.territory !== "UNK")
      .sort((a, b) => b.totalNonRepercute - a.totalNonRepercute);
  }, [invoices, taxes, manualLines]);

  const taxesByName = React.useMemo(() => {
    const m = new Map<string, number>();
    taxes.forEach((t) => {
      const k = String(t.tax_name || "AUTRE");
      m.set(k, (m.get(k) || 0) + safeNumber(t.tax_amount));
    });
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [taxes]);

  const isLoadingAny = invoicesQuery.isLoading || taxesQuery.isLoading || manualLoading;

  function refreshAll() {
    invoicesQuery.refetch();
    taxesQuery.refetch();
    refreshManual();
  }

  function exportKpiCsv() {
    const csv = toCsv([
      {
        from: filters.from ?? "",
        to: filters.to ?? "",
        territory: filters.territory ?? "ALL",
        transport_cost_ht: totals.transportReal,
        taxes_om: totals.taxesOm,
        transit_fees_ht: totals.transitFees,
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
      return {
        entered_date: r.entered_date ?? "",
        territory: terr,
        island_raw: r.island ?? "",
        client_name: r.client_name ?? "",
        invoice_refs: r.invoice_refs ?? "",
        packages_count: r.packages_count ?? "",
        transport_cost_ht: safeNumber(r.transport_cost_ht),
        transit_fees_ht: safeNumber(r.transit_fees_ht),
        invoice_amount_ht: safeNumber(r.invoice_amount_ht),
        products_amount_ht: safeNumber(r.products_amount_ht),
        source: r.source ?? "",
      };
    });
    downloadText(toCsv(detail), `invoices_transport_transit_${new Date().toISOString().slice(0, 10)}.csv`);
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
      const payload = {
        id: makeId(),
        date: newDate,
        destination: newDestination,
        cost_type: newType,
        amount,
      };

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

  return (
    <MainLayout contentClassName="md:p-8">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Coûts export</p>
            <h1 className="text-2xl font-bold">Charges & coûts non répercutés</h1>
            <p className="text-sm text-muted-foreground">
              KPI = <b>Transport réel</b> + <b>Taxes OM</b> − <b>Frais de transit</b>
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

        <Card>
          <CardHeader>
            <CardTitle>KPI non répercuté</CardTitle>
            <CardDescription>
              Sources : <code className="text-xs">sales_invoices_raw</code> (transport + transit) &{" "}
              <code className="text-xs">taxes_om</code> (OM / octroi / TVA…).
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <SummaryTile label="Transport réel" value={totals.transportReal} hint="transport_cost_ht" />
            <SummaryTile label="Frais de transit" value={totals.transitFees} hint="transit_fees_ht" />
            <SummaryTile label="Taxes OM (total)" value={totals.taxesOm} hint="tax_amount" />
            <SummaryTile label="KPI non répercuté" value={totals.kpiNonRepercute} hint="Transport + OM − Transit" />
            <SummaryTile label="Charges manuelles" value={totals.manualCharges} hint="cost_lines.amount" />
            <SummaryTile label="Total non répercuté" value={totals.totalNonRepercute} hint="KPI + manuelles" />
          </CardContent>
        </Card>

        {taxesByName.length ? (
          <Card>
            <CardHeader>
              <CardTitle>Détail Taxes OM</CardTitle>
              <CardDescription>Répartition par type de taxe (tax_name).</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {taxesByName.map(([name, amount]) => (
                <Badge key={name} variant="secondary">
                  {name}: {formatMoney(amount, 0)}
                </Badge>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Répartition par territoire</CardTitle>
            <CardDescription>Utile pour voir où tu perds le plus (non répercuté).</CardDescription>
          </CardHeader>
          <CardContent className="overflow-auto border rounded-md">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b text-muted-foreground">
                  <th className="py-2 px-3 text-left font-medium">Territoire</th>
                  <th className="py-2 px-3 text-right font-medium">Factures</th>
                  <th className="py-2 px-3 text-right font-medium">Transport</th>
                  <th className="py-2 px-3 text-right font-medium">Transit</th>
                  <th className="py-2 px-3 text-right font-medium">Taxes OM</th>
                  <th className="py-2 px-3 text-right font-medium">KPI</th>
                  <th className="py-2 px-3 text-right font-medium">Manuel</th>
                  <th className="py-2 px-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {byTerritory.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-4 px-3 text-center text-muted-foreground">
                      Aucune donnée sur la période.
                    </td>
                  </tr>
                ) : (
                  byTerritory.map((r) => (
                    <tr key={r.territory} className="border-b last:border-0">
                      <td className="py-2 px-3 font-semibold">{r.territory}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{r.invoices}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{formatMoney(r.transport, 0)}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{formatMoney(r.transit, 0)}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{formatMoney(r.taxesOm, 0)}</td>
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
            <CardDescription>Pour les dépenses non visibles dans tes imports (douane, surcoût transport, etc.).</CardDescription>
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

        <Card>
          <CardHeader>
            <CardTitle>Détails factures (transport & transit)</CardTitle>
            <CardDescription>Base “réelle” pour le futur dataset ML.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-auto border rounded-md">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b text-muted-foreground">
                  <th className="py-2 px-3 text-left font-medium">Date</th>
                  <th className="py-2 px-3 text-left font-medium">Terr.</th>
                  <th className="py-2 px-3 text-left font-medium">Client</th>
                  <th className="py-2 px-3 text-left font-medium">Réfs</th>
                  <th className="py-2 px-3 text-right font-medium">Colis</th>
                  <th className="py-2 px-3 text-right font-medium">Transport</th>
                  <th className="py-2 px-3 text-right font-medium">Transit</th>
                  <th className="py-2 px-3 text-right font-medium">HT facture</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingAny ? (
                  <tr>
                    <td colSpan={8} className="py-4 px-3 text-center text-muted-foreground">
                      Chargement…
                    </td>
                  </tr>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-4 px-3 text-center text-muted-foreground">
                      Aucune facture sur la période.
                    </td>
                  </tr>
                ) : (
                  invoices.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-2 px-3">{r.entered_date ?? "—"}</td>
                      <td className="py-2 px-3">{normalizeIslandToTerritoryCode(r.island)}</td>
                      <td className="py-2 px-3">{r.client_name ?? "—"}</td>
                      <td className="py-2 px-3">{r.invoice_refs ?? "—"}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{r.packages_count ?? "—"}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{formatMoney(safeNumber(r.transport_cost_ht), 2)}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{formatMoney(safeNumber(r.transit_fees_ht), 2)}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{formatMoney(safeNumber(r.invoice_amount_ht), 2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
