// src/pages/Costs.tsx
import * as React from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Plus, Download } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { ExportFiltersBar } from "@/components/export/ExportFiltersBar";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { fetchKpis } from "@/domain/export/queries";
import { ExportFilters } from "@/domain/export/types";
import { useQuery } from "@tanstack/react-query";

import { useCosts, type CostLine } from "@/hooks/useCosts";

const DROM = ["GP", "MQ", "GF", "RE", "YT"];
const DESTS = ["all", "FR", ...DROM, "UE"] as const;
const COST_TYPES = ["all", "TRANSPORT", "TRANSIT", "OM", "OCTROI", "DOSSIER", "AUTRE"] as const;

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

function SummaryTile({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-lg border p-3 bg-card/50">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold">{formatMoney(value, 0)}</div>
      {hint ? <div className="text-[11px] text-muted-foreground mt-1">{hint}</div> : null}
    </div>
  );
}

export default function Costs() {
  const { resolvedRange, variables } = useGlobalFilters();

  // Filtres "export" (pour KPIs douanes estimées)
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

  // KPIs douanes (estimations)
  const kpisQuery = useQuery({
    queryKey: ["export-costs-kpis", filters],
    queryFn: () => fetchKpis(filters),
  });

  React.useEffect(() => {
    if (kpisQuery.error) toast.error((kpisQuery.error as Error).message);
  }, [kpisQuery.error]);

  // Filtres "charges" (cost_lines)
  const [destination, setDestination] = React.useState<(typeof DESTS)[number]>(
    (filters.territory as any) || "all"
  );
  const [costType, setCostType] = React.useState<(typeof COST_TYPES)[number]>("all");
  const [q, setQ] = React.useState("");

  React.useEffect(() => {
    // si on change de territoire global => aligne le filtre destination (mais sans écraser "all" si déjà choisi)
    setDestination((prev) => {
      const t = (filters.territory as any) || "all";
      return prev === "all" ? "all" : t;
    });
  }, [filters.territory]);

  const costsHook = useCosts({
    from: filters.from,
    to: filters.to,
    destination: destination === "all" ? undefined : destination,
    costType: costType === "all" ? undefined : costType,
  });

  const { rows, isLoading, error, warning, schemaMode, refresh } = costsHook;

  const filteredRows = React.useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return rows;

    return rows.filter((r: CostLine) => {
      const hay = [
        r.date,
        r.cost_type,
        r.amount,
        r.destination,
        r.currency,
        r.incoterm,
        r.order_id,
        r.invoice_number,
        r.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(query);
    });
  }, [rows, q]);

  // KPI "charges non répercutées" (en schéma minimal, on ne sait pas "rebilled" -> on considère tout non répercuté)
  const totals = React.useMemo(() => {
    const sumBy = (pred: (r: CostLine) => boolean) =>
      filteredRows.reduce((s, r) => s + (pred(r) ? safeNumber(r.amount) : 0), 0);

    const transport = sumBy((r) => String(r.cost_type || "").toUpperCase() === "TRANSPORT");
    const transit = sumBy((r) => String(r.cost_type || "").toUpperCase() === "TRANSIT");
    const dossier = sumBy((r) => String(r.cost_type || "").toUpperCase() === "DOSSIER");

    const om = sumBy((r) => String(r.cost_type || "").toUpperCase() === "OM");
    const octroi = sumBy((r) => String(r.cost_type || "").toUpperCase() === "OCTROI");

    const totalCharges = filteredRows.reduce((s, r) => s + safeNumber(r.amount), 0);

    return { transport, transit, dossier, om, octroi, totalCharges };
  }, [filteredRows]);

  const estimatedCosts = kpisQuery.data?.estimatedExportCosts;
  const estDouanes = (estimatedCosts?.om ?? 0) + (estimatedCosts?.octroi ?? 0);
  const nonRepercute = totals.transport + estDouanes - totals.transit; // ton KPI demandé

  function exportChargesCsv() {
    const csv = toCsv(
      filteredRows.map((r: CostLine) => ({
        date: r.date ?? "",
        cost_type: r.cost_type ?? "",
        destination: r.destination ?? "",
        amount: r.amount ?? "",
        currency: r.currency ?? "",
        incoterm: r.incoterm ?? "",
        order_id: r.order_id ?? "",
        invoice_number: r.invoice_number ?? "",
        notes: r.notes ?? "",
      }))
    );
    downloadText(csv, `cost_lines_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  // Ajout rapide (compatible schéma minimal)
  const [newDate, setNewDate] = React.useState<string>(new Date().toISOString().slice(0, 10));
  const [newDest, setNewDest] = React.useState<string>((filters.territory as any) || "FR");
  const [newType, setNewType] = React.useState<string>("TRANSPORT");
  const [newAmount, setNewAmount] = React.useState<string>("");

  const [saving, setSaving] = React.useState(false);

  async function addCostLine() {
    const amount = safeNumber(newAmount);
    if (!newDate) return toast.error("Date obligatoire.");
    if (!newDest) return toast.error("Destination obligatoire.");
    if (!newType) return toast.error("Type obligatoire.");
    if (amount <= 0) return toast.error("Montant invalide.");

    setSaving(true);
    try {
      // On insère seulement les colonnes "sûres"
      const payload = {
        date: newDate,
        destination: newDest,
        cost_type: newType,
        amount,
      };

      const { error } = await supabase.from("cost_lines").insert([payload] as any);
      if (error) throw error;

      setNewAmount("");
      toast.success("Charge ajoutée ✅");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || "Erreur insertion cost_lines");
    } finally {
      setSaving(false);
    }
  }

  return (
    <MainLayout contentClassName="md:p-8">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Charges & coûts non répercutés</p>
            <h1 className="text-2xl font-bold">Costs</h1>
            <p className="text-sm text-muted-foreground">
              KPI = Transport + (OM+Octroi estimés) − Frais de transit.
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={refresh} disabled={isLoading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
            <Button
              variant="outline"
              onClick={exportChargesCsv}
              disabled={isLoading || filteredRows.length === 0}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Export CSV
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
              Période + territoire + client via la barre de filtres. Transport/Transit via <code className="text-xs">cost_lines</code>,
              OM/Octroi via tes tables douanes.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <SummaryTile label="Transport (charges)" value={totals.transport} />
            <SummaryTile label="Transit (charges)" value={totals.transit} />
            <SummaryTile label="OM+Octroi (estimés)" value={estDouanes} hint="via fetchKpis()" />
            <SummaryTile label="Total charges (table)" value={totals.totalCharges} />
            <SummaryTile label="Non répercuté" value={nonRepercute} hint="Transport + Douanes − Transit" />
          </CardContent>
        </Card>

        {/* Warnings / errors */}
        {error ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-4 text-sm">{error}</CardContent>
          </Card>
        ) : null}

        {warning ? (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-4 text-sm">{warning}</CardContent>
          </Card>
        ) : null}

        {schemaMode === "minimal" ? (
          <Card className="border-slate-200 bg-slate-50">
            <CardContent className="pt-4 text-sm text-slate-700">
              Ta table <code className="text-xs">cost_lines</code> est en schéma minimal.  
              Si tu veux suivre <b>par facture/commande</b> + marquer “répercuté / non répercuté”, on pourra ajouter des colonnes.
            </CardContent>
          </Card>
        ) : null}

        {/* Filtres locaux charges */}
        <Card>
          <CardHeader>
            <CardTitle>Charges (cost_lines)</CardTitle>
            <CardDescription>Filtre destination / type + recherche texte.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Destination</p>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value as any)}
                >
                  {DESTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Type</p>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={costType}
                  onChange={(e) => setCostType(e.target.value as any)}
                >
                  {COST_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <p className="text-xs text-muted-foreground mb-1">Recherche</p>
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ex: FV..., CMD..., TRANSPORT, GP..." />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">Lignes: {filteredRows.length}</Badge>
              <Badge variant="secondary">Total: {formatMoney(totals.totalCharges, 2)}</Badge>
            </div>

            <div className="overflow-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2 px-3 text-left font-medium">Date</th>
                    <th className="py-2 px-3 text-left font-medium">Type</th>
                    <th className="py-2 px-3 text-left font-medium">Destination</th>
                    <th className="py-2 px-3 text-right font-medium">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={4} className="py-4 px-3 text-center text-muted-foreground">
                        Chargement…
                      </td>
                    </tr>
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-4 px-3 text-center text-muted-foreground">
                        Aucune charge.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((r, idx) => (
                      <tr key={r.id ?? `${r.date}-${r.cost_type}-${r.destination}-${idx}`} className="border-b last:border-0">
                        <td className="py-2 px-3">{r.date ?? "—"}</td>
                        <td className="py-2 px-3">{r.cost_type ?? "—"}</td>
                        <td className="py-2 px-3">{r.destination ?? "—"}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{formatMoney(safeNumber(r.amount), 2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Ajout charge */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Ajouter une charge
            </CardTitle>
            <CardDescription>Insertion dans <code className="text-xs">cost_lines</code> (compatible schéma minimal).</CardDescription>
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
                  value={newDest}
                  onChange={(e) => setNewDest(e.target.value)}
                >
                  {["FR", ...DROM, "UE"].map((d) => (
                    <option key={d} value={d}>
                      {d}
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
                  {["TRANSPORT", "TRANSIT", "DOSSIER", "OM", "OCTROI", "AUTRE"].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
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

            <Button onClick={addCostLine} disabled={saving} className="gap-2 w-full md:w-auto">
              <Plus className="h-4 w-4" />
              {saving ? "Ajout..." : "Ajouter"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
