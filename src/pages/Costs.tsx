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

type ExportDestination = { id: string; name: string | null; code: string | null };

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

function stripAccents(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normKey(s: string) {
  return stripAccents(String(s || ""))
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
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

function KpiTile({ label, value, hint, icon }: { label: string; value: string; hint?: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card/60 p-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{label}</div>
        {icon ? <div className="text-muted-foreground">{icon}</div> : null}
      </div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      {hint ? <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

// ✅ mapping métier => on retrouve l'UUID via export_destinations.code OU name
function getDestinationIdForTerritory(terr: string, dests: ExportDestination[]) {
  const up = (terr || "").toUpperCase();
  if (!up || up === "UE") return null;

  const label = TERRITORIES.find((t) => t.code === up)?.label || up;

  const candidates = new Set<string>([
    normKey(label),
    normKey(up),
    // cas FR : on tente plusieurs libellés probables
    ...(up === "FR" ? ["france", "metropole", "francemetropolitaine", "francemetro", "metropolitaine"].map(normKey) : []),
  ]);

  // 1) match sur export_destinations.code (plus fiable)
  for (const d of dests) {
    const dk = normKey(d.code || "");
    if (dk && [...candidates].some((c) => dk === c)) return d.id;
  }

  // 2) fallback sur name
  for (const d of dests) {
    const nk = normKey(d.name || "");
    if (nk && [...candidates].some((c) => nk === c || nk.includes(c) || c.includes(nk))) return d.id;
  }

  return null;
}

const TRANSPORT_TYPES = new Set(["TRANSPORT", "FRET", "SHIPPING"]);
function normalizeCostType(t: unknown) {
  return String(t || "").trim().toUpperCase();
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

  // 🔎 Destinations (UUID)
  const [exportDestinations, setExportDestinations] = React.useState<ExportDestination[]>([]);
  React.useEffect(() => {
    let mounted = true;
    supabase
      .from("export_destinations")
      .select("id,name,code")
      .order("name", { ascending: true })
      .limit(5000)
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          console.error(error);
          return;
        }
        setExportDestinations((data || []) as any);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const destinationId = React.useMemo(
    () => getDestinationIdForTerritory(filters.territory || "", exportDestinations),
    [filters.territory, exportDestinations]
  );

  const territoryLabel = TERRITORIES.find((t) => t.code === (filters.territory || "FR"))?.label || (filters.territory || "Toutes");

  // KPI export (taxes estimées + totalTransit facturé)
  const kpisQuery = useQuery({
    queryKey: ["costs-kpis-nonrepercutes", filters.from, filters.to, filters.territory, filters.clientId],
    queryFn: () => fetchKpis(filters),
    retry: false,
  });

  React.useEffect(() => {
    if (kpisQuery.error) toast.error((kpisQuery.error as Error).message);
  }, [kpisQuery.error]);

  // ✅ Charges réelles filtrées en DB avec destination UUID (fin du 400)
  const { rows, isLoading, error, warning, refresh } = useCosts({
    from: filters.from,
    to: filters.to,
    clientId: filters.clientId,
    destinationId: destinationId || undefined,
  });

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

  const totals = React.useMemo(() => {
    const total = filteredRows.reduce((s, r) => s + safeNumber(r.amount), 0);
    const transport = filteredRows.reduce((s, r) => {
      const t = normalizeCostType(r.cost_type);
      return s + (TRANSPORT_TYPES.has(t) ? safeNumber(r.amount) : 0);
    }, 0);
    return { total, transport };
  }, [filteredRows]);

  const estimatedCosts = kpisQuery.data?.estimatedExportCosts;
  const taxesOMTotal = safeNumber(estimatedCosts?.om) + safeNumber(estimatedCosts?.octroi);
  const totalTransitFacture = safeNumber(kpisQuery.data?.totalTransit);

  // ✅ KPI demandé
  const kpiNonRepercute = totals.transport + taxesOMTotal - totalTransitFacture;

  function exportChargesCsv() {
    const csv = toCsv(
      filteredRows.map((r: any) => ({
        date: r.date ?? "",
        cost_type: r.cost_type ?? "",
        amount: r.amount ?? 0,
        currency: r.currency ?? "",
        destination: r.destination ?? "",
        incoterm: r.incoterm ?? "",
        order_id: r.order_id ?? "",
        client_id: r.client_id ?? "",
        product_id: r.product_id ?? "",
      }))
    );
    downloadText(csv, `charges_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  // Ajout charges
  const [orderId, setOrderId] = React.useState("");
  const [transportAmount, setTransportAmount] = React.useState<string>("");
  const [currency, setCurrency] = React.useState("EUR");
  const [destination, setDestination] = React.useState(filters.territory || "FR");
  const [incoterm, setIncoterm] = React.useState("DAP");
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    setDestination(filters.territory || "FR");
  }, [filters.territory]);

  async function addChargeTransport() {
    const oid = orderId.trim();
    if (!oid) return toast.error("Merci de renseigner un ID de commande.");
    const t = safeNumber(transportAmount);
    if (t <= 0) return toast.error("Montant transport invalide.");

    // ✅ destination stockée en UUID (si trouvée) => plus jamais de GP en base si la colonne est uuid
    const destId = getDestinationIdForTerritory(destination, exportDestinations);

    setIsSaving(true);
    try {
      const { error: insErr } = await supabase.from("cost_lines").insert([
        {
          date: new Date().toISOString().slice(0, 10),
          cost_type: "TRANSPORT",
          amount: t,
          currency,
          destination: destId || null,
          incoterm,
          order_id: oid,
        },
      ]);
      if (insErr) throw insErr;

      setOrderId("");
      setTransportAmount("");
      await refresh();
      await kpisQuery.refetch();
      toast.success("Transport ajouté ✅");
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de l'ajout.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <MainLayout contentClassName="md:p-8">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Charges & coûts non répercutés</p>
            <h1 className="text-2xl font-bold">Costs</h1>
            <p className="text-sm text-muted-foreground">KPI = Transport charges + OM/Octroi − Frais de transit facturés.</p>
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

            <Button variant="outline" onClick={exportChargesCsv} disabled={isLoading || filteredRows.length === 0} className="gap-2">
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

        <Card>
          <CardHeader>
            <CardTitle>KPI “coûts non répercutés”</CardTitle>
            <CardDescription>
              Période : <b>{filters.from}</b> → <b>{filters.to}</b> • Territoire : <b>{territoryLabel}</b>
              {filters.territory && filters.territory !== "UE" ? (
                <span className="text-muted-foreground"> • destinationId: <code className="text-xs">{destinationId || "introuvable"}</code></span>
              ) : null}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <KpiTile icon={<Truck className="h-4 w-4" />} label="Transport (charges)" value={formatMoney(totals.transport, 0)} />
            <KpiTile icon={<Receipt className="h-4 w-4" />} label="OM/Octroi estimés" value={formatMoney(taxesOMTotal, 0)} />
            <KpiTile label="Transit facturé" value={formatMoney(totalTransitFacture, 0)} hint="Depuis KPI export (totalTransit)" />
            <KpiTile label="✅ Non répercuté" value={formatMoney(kpiNonRepercute, 0)} />
          </CardContent>
        </Card>

        {error || warning ? (
          <Card className={(warning || "").toLowerCase().includes("manquante") ? "border-amber-300 bg-amber-50" : "border-red-200"}>
            <CardContent className="pt-6 text-sm text-foreground">{error || warning}</CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Charges (cost_lines)</CardTitle>
            <CardDescription>Filtrées DB par destination UUID + période + client. Recherche + export CSV.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col md:flex-row md:items-end gap-3">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Recherche</p>
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ex: TRANSPORT, DAP, CMD-…" />
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">Lignes: {filteredRows.length}</Badge>
                <Badge variant="secondary">Total: {formatMoney(totals.total, 0)}</Badge>
              </div>
            </div>

            <div className="overflow-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2 px-3 text-left font-medium">Date</th>
                    <th className="py-2 px-3 text-left font-medium">Type</th>
                    <th className="py-2 px-3 text-left font-medium">Destination(UUID)</th>
                    <th className="py-2 px-3 text-left font-medium">Incoterm</th>
                    <th className="py-2 px-3 text-left font-medium">Commande</th>
                    <th className="py-2 px-3 text-right font-medium">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={6} className="py-4 px-3 text-center text-muted-foreground">Chargement…</td></tr>
                  ) : filteredRows.length === 0 ? (
                    <tr><td colSpan={6} className="py-4 px-3 text-center text-muted-foreground">Aucune charge.</td></tr>
                  ) : (
                    filteredRows.map((r: any) => (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-2 px-3">{r.date ?? "—"}</td>
                        <td className="py-2 px-3">{r.cost_type ?? "—"}</td>
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Ajouter un transport (par commande)
            </CardTitle>
            <CardDescription>Insert dans <code className="text-xs">cost_lines</code> avec destination UUID.</CardDescription>
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
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Incoterm</p>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={incoterm}
                  onChange={(e) => setIncoterm(e.target.value)}
                >
                  {["EXW", "FCA", "DAP", "DDP"].map((i) => (
                    <option key={i} value={i}>{i}</option>
                  ))}
                </select>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Devise</p>
                <Input value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="EUR" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Transport (€)</p>
                <Input type="number" inputMode="decimal" value={transportAmount} onChange={(e) => setTransportAmount(e.target.value)} />
              </div>

              <div className="flex items-end">
                <Button onClick={addChargeTransport} disabled={isSaving} className="gap-2 w-full">
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
