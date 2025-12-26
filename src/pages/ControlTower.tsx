import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import { useFlows } from "@/hooks/useFlows";
import { useFlowChecklists } from "@/hooks/useFlowChecklists";
import { computeFlowHealth } from "@/lib/flows/flowHealth";
import { useOperationsSync } from "@/hooks/useOperationsSync";
import type { Flow, Incoterm, RiskLevel, Zone } from "@/types";

import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { AlertTriangle, Download, Filter, Sparkles, Target } from "lucide-react";

type ZoneFilter = "ALL" | Zone;
type IncotermFilter = "ALL" | Incoterm;
type RiskFilter = "ALL" | RiskLevel;
type HealthFilter = "ALL" | "OK" | "A_SURVEILLER" | "RISQUE";

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v ?? 0) || 0);

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(amount);

const toCsv = (rows: Record<string, string | number | boolean>[]) => {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    const needsQuotes = s.includes(";") || s.includes("\n") || s.includes('"');
    const escaped = s.replace(/"/g, '""');
    return needsQuotes ? `"${escaped}"` : escaped;
  };
  const lines = [headers.join(";"), ...rows.map((r) => headers.map((h) => escape(r[h])).join(";"))];
  return lines.join("\n");
};

const downloadText = (content: string, filename: string, mime = "text/csv") => {
  const blob = new Blob([content], { type: `${mime};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const HealthBadge = ({ bucket, score }: { bucket: "OK" | "A_SURVEILLER" | "RISQUE"; score: number }) => {
  const cls =
    bucket === "OK"
      ? "bg-[hsl(var(--status-ok))]/10 text-[hsl(var(--status-ok))] border-[hsl(var(--status-ok))]/30"
      : bucket === "A_SURVEILLER"
        ? "bg-[hsl(var(--status-warning))]/10 text-[hsl(var(--status-warning))] border-[hsl(var(--status-warning))]/30"
        : "bg-[hsl(var(--status-risk))]/10 text-[hsl(var(--status-risk))] border-[hsl(var(--status-risk))]/30";
  const label = bucket === "OK" ? "OK" : bucket === "A_SURVEILLER" ? "À surveiller" : "Risque";
  return (
    <Badge variant="outline" className={cn("gap-2", cls)}>
      {label}
      <span className="opacity-80">{score}</span>
    </Badge>
  );
};

export default function ControlTower() {
  const { flows, isLoading } = useFlows();
  const { getChecklist } = useFlowChecklists();
  const operationsSync = useOperationsSync();

  // UI blocks
  const [showInsights, setShowInsights] = useState(true);

  // Filters
  const [q, setQ] = useState("");
  const [zone, setZone] = useState<ZoneFilter>("ALL");
  const [destination, setDestination] = useState<string>("ALL");
  const [incoterm, setIncoterm] = useState<IncotermFilter>("ALL");
  const [risk, setRisk] = useState<RiskFilter>("ALL");
  const [health, setHealth] = useState<HealthFilter>("ALL");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  const resetFilters = () => {
    setQ("");
    setZone("ALL");
    setDestination("ALL");
    setIncoterm("ALL");
    setRisk("ALL");
    setHealth("ALL");
    setOnlyMissing(false);
    setOnlyOverdue(false);
  };

  // Presets (quick filters)
  const applyPreset = (preset: "DROM_DDP" | "SUISSE_BLOQUE" | "UE_AUTOLIQ" | "DOCS") => {
    resetFilters();

    if (preset === "DROM_DDP") {
      setZone("DROM");
      setIncoterm("DDP");
      setOnlyMissing(true);
    }
    if (preset === "SUISSE_BLOQUE") {
      setDestination("Suisse");
      setHealth("RISQUE");
    }
    if (preset === "UE_AUTOLIQ") {
      setZone("UE");
      setOnlyMissing(true);
      setQ("autoliquid");
    }
    if (preset === "DOCS") {
      setOnlyMissing(true);
    }
  };

  const rows = useMemo(() => {
    const now = new Date();

    return flows.map((flow: Flow) => {
      const checklist = getChecklist(flow);
      const h = computeFlowHealth(flow, checklist as any, now);

      const searchBlob = [
        (flow as any).flow_code,
        (flow as any).client_name,
        (flow as any).destination,
        (flow as any).zone,
        (flow as any).incoterm,
        (flow as any).incoterm_place,
        ...(Array.isArray(checklist) ? checklist.map((c: any) => c?.label).filter(Boolean) : []),
      ]
        .join(" ")
        .toLowerCase();

      return { flow, checklist, health: h, searchBlob };
    });
  }, [flows, getChecklist]);

  const destinations = useMemo(() => {
    const set = new Set<string>();
    flows.forEach((f: any) => set.add(String(f.destination || "UNKNOWN")));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [flows]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return rows.filter(({ flow, health: h, searchBlob }) => {
      if (ql && !searchBlob.includes(ql)) return false;

      if (zone !== "ALL" && (flow as any).zone !== zone) return false;
      if (destination !== "ALL" && String((flow as any).destination || "UNKNOWN") !== destination) return false;
      if (incoterm !== "ALL" && (flow as any).incoterm !== incoterm) return false;

      if (risk !== "ALL") {
        const rl = String((flow as any).risk_level || "").toLowerCase();
        if (risk === "ok" && rl !== "ok") return false;
        if (risk === "a_surveiller" && rl !== "a_surveiller") return false;
        if (risk === "risque" && rl !== "risque") return false;
      }

      if (health !== "ALL") {
        if ((h as any).bucket !== health) return false;
      }

      if (onlyMissing) {
        const missing = Array.isArray((h as any).missing) ? (h as any).missing : [];
        if (missing.length === 0) return false;
      }

      if (onlyOverdue) {
        if (!(h as any).isOverdue) return false;
      }

      return true;
    });
  }, [rows, q, zone, destination, incoterm, risk, health, onlyMissing, onlyOverdue]);

  const kpis = useMemo(() => {
    const total = flows.length;
    const active = flows.filter((f: any) => String(f.status_export || "").toLowerCase() !== "termine").length;
    const atRisk = flows.filter((f: any) => String(f.risk_level || "").toLowerCase() === "risque").length;
    const watch = flows.filter((f: any) => String(f.risk_level || "").toLowerCase() === "a_surveiller").length;

    const goodsValue = flows.reduce((s: number, f: any) => s + n(f.goods_value), 0);
    const costs = flows.reduce((s: number, f: any) => {
      const t =
        n(f.cost_transport) +
        n(f.cost_customs_clearance) +
        n(f.cost_duties) +
        n(f.cost_import_vat) +
        n(f.cost_octroi_mer) +
        n(f.cost_octroi_mer_regional) +
        n(f.cost_other);
      return s + t;
    }, 0);

    const overdue = filtered.filter((r) => (r.health as any).isOverdue).length;
    const missing = filtered.filter((r) => Array.isArray((r.health as any).missing) && (r.health as any).missing.length > 0).length;

    const topPriorities = [...filtered]
      .sort((a, b) => Number((a.health as any).score ?? 999) - Number((b.health as any).score ?? 999))
      .slice(0, 5)
      .map((r) => ({
        code: (r.flow as any).flow_code,
        client: (r.flow as any).client_name,
        dest: (r.flow as any).destination,
        score: Number((r.health as any).score ?? 0),
        blockers: (Array.isArray((r.health as any).blockers) ? (r.health as any).blockers : []).slice(0, 2),
      }));

    return { total, active, atRisk, watch, overdue, missing, goodsValue, costs, topPriorities };
  }, [flows, filtered]);

  const exportFilteredCsv = () => {
    const exportRows = filtered.map(({ flow, health: h }) => ({
      Code: String((flow as any).flow_code ?? ""),
      Client: String((flow as any).client_name ?? ""),
      Destination: String((flow as any).destination ?? ""),
      Zone: String((flow as any).zone ?? ""),
      Incoterm: String((flow as any).incoterm ?? ""),
      Lieu: String((flow as any).incoterm_place ?? ""),
      Départ: String((flow as any).departure_date ?? ""),
      Livraison: String((flow as any).delivery_date ?? ""),
      "Valeur marchandises": n((flow as any).goods_value),
      "Charges totales":
        n((flow as any).cost_transport) +
        n((flow as any).cost_customs_clearance) +
        n((flow as any).cost_duties) +
        n((flow as any).cost_import_vat) +
        n((flow as any).cost_octroi_mer) +
        n((flow as any).cost_octroi_mer_regional) +
        n((flow as any).cost_other),
      Risque: String((flow as any).risk_level ?? "ok"),
      Santé: String((h as any).bucket ?? ""),
      Score: Number((h as any).score ?? 0),
      Overdue: Boolean((h as any).isOverdue),
      Bloquants: (Array.isArray((h as any).blockers) ? (h as any).blockers : []).join(" | "),
      "Docs à faire": (Array.isArray((h as any).missing) ? (h as any).missing : []).join(" | "),
    }));

    const csv = toCsv(exportRows);
    downloadText(csv, `etat_des_lieux_${new Date().toISOString().split("T")[0]}.csv`, "text/csv");
  };

  const handleSync = async () => {
    const result = await operationsSync.sync();
    if (result && result.length) {
      toast.success(`Synchronisation OneDrive OK (${result.length} lignes)`);
    } else if (operationsSync.error) {
      toast.error(`Sync OneDrive échouée : ${operationsSync.error}`);
    } else {
      toast.message("Sync lancée.");
    }
  };

  useEffect(() => {
    void operationsSync;
  }, [operationsSync]);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Chargement…</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Tour de contrôle Export"
          subtitle="État des lieux chiffré, priorisation et contrôle des risques (DOM, Suisse, UE)."
        />

        {/* Insights (Dashboard intégré) */}
        <Card>
          <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <CardTitle>Insights (dashboard intégré)</CardTitle>
              <CardDescription>KPIs + zones/destinations/top produits (si vues Supabase disponibles).</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground">Afficher</Label>
              <Switch checked={showInsights} onCheckedChange={setShowInsights} />
            </div>
          </CardHeader>
          {showInsights ? (
            <CardContent>
              <DashboardContent embedded />
            </CardContent>
          ) : null}
        </Card>

        {/* Presets */}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => applyPreset("DROM_DDP")}>
            <Target className="h-4 w-4 mr-2" />
            DROM + DDP + Docs
          </Button>
          <Button variant="outline" size="sm" onClick={() => applyPreset("SUISSE_BLOQUE")}>
            <AlertTriangle className="h-4 w-4 mr-2" />
            Suisse bloqué
          </Button>
          <Button variant="outline" size="sm" onClick={() => applyPreset("UE_AUTOLIQ")}>
            <Sparkles className="h-4 w-4 mr-2" />
            UE autoliquid
          </Button>
          <Button variant="outline" size="sm" onClick={() => applyPreset("DOCS")}>
            <Filter className="h-4 w-4 mr-2" />
            Docs manquants
          </Button>

          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={handleSync}>
              Synchroniser OneDrive
            </Button>
            <Button variant="outline" size="sm" onClick={exportFilteredCsv}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV (filtré)
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filtres</CardTitle>
            <CardDescription>Filtre multi-critères sur tes flux + santé (docs/retards/bloquants).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label>Recherche</Label>
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="client, code, autoliquid..." />
              </div>

              <div className="space-y-1">
                <Label>Zone</Label>
                <Select value={zone} onValueChange={(v) => setZone(v as ZoneFilter)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Zone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Toutes</SelectItem>
                    <SelectItem value="UE">UE</SelectItem>
                    <SelectItem value="DROM">DROM</SelectItem>
                    <SelectItem value="Hors UE">Hors UE</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Destination</Label>
                <Select value={destination} onValueChange={setDestination}>
                  <SelectTrigger>
                    <SelectValue placeholder="Destination" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Toutes</SelectItem>
                    {destinations.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Incoterm</Label>
                <Select value={incoterm} onValueChange={(v) => setIncoterm(v as IncotermFilter)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Incoterm" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tous</SelectItem>
                    <SelectItem value="EXW">EXW</SelectItem>
                    <SelectItem value="FCA">FCA</SelectItem>
                    <SelectItem value="DAP">DAP</SelectItem>
                    <SelectItem value="DDP">DDP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label>Risque</Label>
                <Select value={risk} onValueChange={(v) => setRisk(v as RiskFilter)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Risque" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tous</SelectItem>
                    <SelectItem value="ok">OK</SelectItem>
                    <SelectItem value="a_surveiller">À surveiller</SelectItem>
                    <SelectItem value="risque">Risque</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Santé</Label>
                <Select value={health} onValueChange={(v) => setHealth(v as HealthFilter)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Santé" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Toutes</SelectItem>
                    <SelectItem value="OK">OK</SelectItem>
                    <SelectItem value="A_SURVEILLER">À surveiller</SelectItem>
                    <SelectItem value="RISQUE">Risque</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-3 pt-6">
                <Switch checked={onlyMissing} onCheckedChange={setOnlyMissing} />
                <span className="text-sm">Docs manquants</span>
              </div>

              <div className="flex items-center gap-3 pt-6">
                <Switch checked={onlyOverdue} onCheckedChange={setOnlyOverdue} />
                <span className="text-sm">En retard</span>
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="ghost" onClick={resetFilters}>
                Réinitialiser
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Flows</div>
              <div className="text-2xl font-bold">{kpis.total}</div>
              <div className="text-sm text-muted-foreground">actifs: {kpis.active}</div>
            </CardContent>
          </Card>
          <Card className="border-status-risk/30">
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">À risque</div>
              <div className="text-2xl font-bold">{kpis.atRisk}</div>
              <div className="text-sm text-muted-foreground">à surveiller: {kpis.watch}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Valeur & charges</div>
              <div className="text-2xl font-bold">{formatCurrency(kpis.goodsValue)}</div>
              <div className="text-sm text-muted-foreground">charges: {formatCurrency(kpis.costs)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Top priorities */}
        <Card>
          <CardHeader>
            <CardTitle>Top priorités</CardTitle>
            <CardDescription>Les 5 dossiers les plus “bas” en score santé.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {kpis.topPriorities.length === 0 ? (
              <div className="text-sm text-muted-foreground">Aucune priorité détectée.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {kpis.topPriorities.map((p) => (
                  <div key={p.code} className="rounded-xl border p-3">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{p.code}</div>
                      <Badge variant="outline">score {p.score}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">{p.client} • {p.dest}</div>
                    {p.blockers?.length ? (
                      <div className="text-sm mt-2">
                        <span className="text-muted-foreground">Bloquants: </span>
                        {p.blockers.join(" • ")}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Liste des flux (filtrés)</CardTitle>
            <CardDescription>{filtered.length} résultats</CardDescription>
          </CardHeader>
          <CardContent className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>Incoterm</TableHead>
                  <TableHead className="text-right">Valeur</TableHead>
                  <TableHead className="text-right">Charges</TableHead>
                  <TableHead>Risque</TableHead>
                  <TableHead>Santé</TableHead>
                  <TableHead>Docs / Bloquants</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(({ flow, health: h }) => {
                  const costs =
                    n((flow as any).cost_transport) +
                    n((flow as any).cost_customs_clearance) +
                    n((flow as any).cost_duties) +
                    n((flow as any).cost_import_vat) +
                    n((flow as any).cost_octroi_mer) +
                    n((flow as any).cost_octroi_mer_regional) +
                    n((flow as any).cost_other);

                  const missing = Array.isArray((h as any).missing) ? (h as any).missing : [];
                  const blockers = Array.isArray((h as any).blockers) ? (h as any).blockers : [];

                  return (
                    <TableRow key={(flow as any).id || (flow as any).flow_code}>
                      <TableCell className="font-mono">{String((flow as any).flow_code || "")}</TableCell>
                      <TableCell>{String((flow as any).client_name || "")}</TableCell>
                      <TableCell>{String((flow as any).destination || "")}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{String((flow as any).zone || "")}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{String((flow as any).incoterm || "")}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(n((flow as any).goods_value))}</TableCell>
                      <TableCell className="text-right">{formatCurrency(costs)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            String((flow as any).risk_level || "").toLowerCase() === "risque"
                              ? "border-status-risk/40 text-status-risk"
                              : String((flow as any).risk_level || "").toLowerCase() === "a_surveiller"
                                ? "border-status-warning/40 text-status-warning"
                                : "border-status-ok/40 text-status-ok"
                          }
                        >
                          {String((flow as any).risk_level || "ok")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <HealthBadge bucket={(h as any).bucket || "OK"} score={Number((h as any).score ?? 0)} />
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-muted-foreground space-y-1">
                          {missing.length ? <div><span className="font-medium">Docs:</span> {missing.slice(0, 3).join(" • ")}</div> : <div>Docs: —</div>}
                          {blockers.length ? <div><span className="font-medium">Bloc:</span> {blockers.slice(0, 2).join(" • ")}</div> : <div>Bloc: —</div>}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-sm text-muted-foreground">
                      Aucun résultat avec ces filtres.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
