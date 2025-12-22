import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { AlertTriangle, Download, ExternalLink, Eye, TrendingDown, TrendingUp } from "lucide-react";

import { useLocalStorage } from "@/hooks/useLocalStorage";
import type { SageInvoice } from "@/types/sage";
import type { CostDoc } from "@/types/costs";
import { COST_DOCS_KEY, SAGE_INVOICES_KEY } from "@/lib/constants/storage";
import { reconcile } from "@/lib/reco/reconcile";
import { aggregateCases, margin, transitCoverage } from "@/lib/kpi/exportKpis";

type RiskTag =
  | "PERTE"
  | "MARGE_FAIBLE"
  | "TRANSIT_NON_COUVERT"
  | "DONNEES_MANQUANTES";

type Thresholds = {
  minMarginRatePct: number; // %
  minMarginAmountEur: number; // €
  minTransitCoveragePct: number; // % (si transit présent)
};

const DEFAULT_THRESHOLDS: Thresholds = {
  minMarginRatePct: 5,
  minMarginAmountEur: 50,
  minTransitCoveragePct: 100,
};

function safeLower(v?: string | null) {
  return (v ?? "").toLowerCase();
}

function eur(n: number) {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €";
}

function pct(n: number) {
  if (!Number.isFinite(n)) return "n/a";
  return n.toFixed(1) + "%";
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((r) =>
      r
        .map((cell) => {
          const s = String(cell ?? "");
          return `"${s.replace(/"/g, '""')}"`;
        })
        .join(";")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function buildRecommendation(tags: RiskTag[], info: { hasTransit: boolean }) {
  const actions: string[] = [];

  if (tags.includes("PERTE")) actions.push("Revoir la grille tarifaire / refacturation (dossier en perte).");
  if (tags.includes("MARGE_FAIBLE")) actions.push("Augmenter prix / refacturer coûts ou renégocier transport/transitaire.");
  if (tags.includes("TRANSIT_NON_COUVERT") && info.hasTransit)
    actions.push("Transit non couvert : vérifier refacturation au client ou intégrer au prix.");
  if (tags.includes("DONNEES_MANQUANTES")) actions.push("Données manquantes : compléter coûts/justificatifs avant décision.");

  // fallback
  return actions.length ? actions.join(" ") : "Surveiller.";
}

export default function MarginAnalysis() {
  const navigate = useNavigate();

  const [sageInvoices] = useLocalStorage<SageInvoice[]>(SAGE_INVOICES_KEY, []);
  const [costDocs] = useLocalStorage<CostDoc[]>(COST_DOCS_KEY, []);

  // Seuils persistants (indispensable pour que l’outil serve en RUN)
  const [thresholds, setThresholds] = useLocalStorage<Thresholds>("margin_thresholds_v1", DEFAULT_THRESHOLDS);

  // Recherche persistante (optionnel mais pratique)
  const [query, setQuery] = useLocalStorage<string>("margin_query_v1", "");

  const cases = useMemo(() => reconcile(sageInvoices, costDocs), [sageInvoices, costDocs]);
  const aggregates = useMemo(() => aggregateCases(cases), [cases]);

  const riskRows = useMemo(() => {
    const q = query.trim().toLowerCase();

    return cases
      .map((c) => {
        const m = margin(c);
        const cov = transitCoverage(c);

        const tags: RiskTag[] = [];

        // 1) Pertes
        if (m.amount < 0) tags.push("PERTE");

        // 2) Marge insuffisante (seulement si pas en perte)
        if (m.amount >= 0 && (m.rate < thresholds.minMarginRatePct || m.amount < thresholds.minMarginAmountEur)) {
          tags.push("MARGE_FAIBLE");
        }

        // 3) Transit non couvert (si transit présent)
        const hasTransit = (cov.transitCosts ?? 0) > 0;
        if (hasTransit) {
          const covPct = (cov.coverage ?? 0) * 100;
          if (covPct < thresholds.minTransitCoveragePct) tags.push("TRANSIT_NON_COUVERT");
        }

        // 4) Données manquantes : heuristique simple (si marge = n/a ou NaN, ou si invoice incomplète)
        const missingData =
          !Number.isFinite(m.amount) ||
          !Number.isFinite(m.rate) ||
          !c?.invoice?.invoiceNumber ||
          !c?.invoice?.clientName;
        if (missingData) tags.push("DONNEES_MANQUANTES");

        const isRisk = tags.length > 0;

        // Recherche multi-champs (facture, client, destination, incoterm)
        const haystack = [
          c?.id,
          c?.invoice?.invoiceNumber,
          c?.invoice?.clientName,
          c?.invoice?.destination,
          c?.invoice?.incoterm,
        ]
          .map((x) => safeLower(String(x ?? "")))
          .join(" ");

        const match = q.length === 0 ? true : haystack.includes(q);

        // Tri : pertes d’abord, puis marge faible, puis transit non couvert, puis par marge %
        const score =
          (tags.includes("PERTE") ? 10000 : 0) +
          (tags.includes("MARGE_FAIBLE") ? 3000 : 0) +
          (tags.includes("TRANSIT_NON_COUVERT") ? 2000 : 0) +
          (tags.includes("DONNEES_MANQUANTES") ? 1000 : 0) +
          Math.max(0, 500 - Math.round((Number.isFinite(m.rate) ? m.rate : 0) * 10));

        return {
          caseId: c.id,
          c,
          m,
          cov,
          tags,
          isRisk,
          match,
          score,
          recommendation: buildRecommendation(tags, { hasTransit }),
        };
      })
      .filter((x) => x.isRisk && x.match)
      .sort((a, b) => b.score - a.score);
  }, [cases, query, thresholds]);

  const stats = useMemo(() => {
    let losses = 0;
    let lowMargin = 0;
    let uncovered = 0;
    let missing = 0;

    for (const r of riskRows) {
      if (r.tags.includes("PERTE")) losses += 1;
      if (r.tags.includes("MARGE_FAIBLE")) lowMargin += 1;
      if (r.tags.includes("TRANSIT_NON_COUVERT")) uncovered += 1;
      if (r.tags.includes("DONNEES_MANQUANTES")) missing += 1;
    }

    return {
      analyzed: cases.length,
      atRisk: riskRows.length,
      losses,
      lowMargin,
      uncovered,
      missing,
    };
  }, [cases.length, riskRows]);

  const exportRiskCsv = () => {
    const rows: string[][] = [
      [
        "CaseId",
        "Facture",
        "Client",
        "Destination",
        "Incoterm",
        "Marge_EUR",
        "Marge_PCT",
        "TransitCosts_EUR",
        "TransitCoverage_PCT",
        "Causes",
        "Reco_Action",
      ],
      ...riskRows.map((r) => [
        r.caseId ?? "",
        r.c?.invoice?.invoiceNumber ?? "",
        r.c?.invoice?.clientName ?? "",
        r.c?.invoice?.destination ?? "",
        r.c?.invoice?.incoterm ?? "",
        String(Math.round(r.m.amount ?? 0)),
        Number.isFinite(r.m.rate) ? r.m.rate.toFixed(2) : "",
        String(Math.round(r.cov.transitCosts ?? 0)),
        (r.cov.transitCosts ?? 0) > 0 ? String(Math.round((r.cov.coverage ?? 0) * 100)) : "n/a",
        r.tags.join(","),
        r.recommendation,
      ]),
    ];

    downloadCsv(`etat_risque_marge_${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  const goFinance = (caseId: string) => {
    // On prépare le terrain : si Finance lit plus tard ?flow=..., c’est déjà compatible.
    navigate(`/finance?flow=${encodeURIComponent(caseId)}`);
  };

  const goFlows = (caseId: string) => {
    // Si tu as une route /flows/:id (circuit detail), tu peux remapper caseId => circuitId plus tard.
    navigate(`/flows`);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Détection marge insuffisante</h1>
            <p className="text-muted-foreground">
              Objectif : identifier les dossiers à risque, expliquer pourquoi, et proposer l’action à mener.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={exportRiskCsv} disabled={riskRows.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Empty state */}
        {cases.length === 0 && (
          <Card>
            <CardContent className="py-6 text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Aucune donnée analysable. Importez des données dans <span className="font-medium">Imports CSV</span>.
            </CardContent>
          </Card>
        )}

        {cases.length > 0 && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground">Dossiers analysés</p>
                  <p className="text-3xl font-bold">{stats.analyzed}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground">Dossiers à risque</p>
                  <p className="text-3xl font-bold">{stats.atRisk}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {stats.losses} pertes • {stats.lowMargin} marge faible • {stats.uncovered} transit non couvert
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground">Couverture transit moyenne</p>
                  <p className="text-3xl font-bold">{Math.round(aggregates.coverageAverage * 100)}%</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground">Transit non couvert total</p>
                  <p className="text-3xl font-bold text-amber-600">{eur(aggregates.uncoveredTotal)}</p>
                </CardContent>
              </Card>
            </div>

            {/* Seuils + recherche */}
            <Card>
              <CardHeader>
                <CardTitle>Seuils de détection & recherche</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Recherche</p>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Facture, client, destination, incoterm…"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Marge minimum (%)</p>
                  <input
                    type="number"
                    value={thresholds.minMarginRatePct}
                    onChange={(e) =>
                      setThresholds({ ...thresholds, minMarginRatePct: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                    min={0}
                    step={0.5}
                  />
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Marge minimum (€)</p>
                  <input
                    type="number"
                    value={thresholds.minMarginAmountEur}
                    onChange={(e) =>
                      setThresholds({ ...thresholds, minMarginAmountEur: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                    min={0}
                    step={10}
                  />
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Couverture transit min (%)</p>
                  <input
                    type="number"
                    value={thresholds.minTransitCoveragePct}
                    onChange={(e) =>
                      setThresholds({ ...thresholds, minTransitCoveragePct: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                    min={0}
                    max={100}
                    step={5}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Table À risque */}
            <Card>
              <CardHeader>
                <CardTitle>Dossiers à risque (triés par criticité)</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Facture</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Destination</TableHead>
                      <TableHead>Incoterm</TableHead>
                      <TableHead>Causes</TableHead>
                      <TableHead className="text-right">Marge</TableHead>
                      <TableHead>Transit</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead className="text-right">Ouvrir</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {riskRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="py-6 text-sm text-muted-foreground">
                          Aucun dossier à risque avec les seuils actuels.
                        </TableCell>
                      </TableRow>
                    )}

                    {riskRows.slice(0, 50).map((r) => {
                      const inv = r.c?.invoice;
                      const m = r.m;
                      const cov = r.cov;

                      return (
                        <TableRow key={r.caseId}>
                          <TableCell className="font-medium">{inv?.invoiceNumber ?? "NC"}</TableCell>
                          <TableCell>{inv?.clientName ?? "NC"}</TableCell>
                          <TableCell>{inv?.destination ?? "NC"}</TableCell>
                          <TableCell>{inv?.incoterm ?? "NC"}</TableCell>

                          <TableCell className="space-x-1">
                            {r.tags.includes("PERTE") && <Badge variant="destructive">Perte</Badge>}
                            {r.tags.includes("MARGE_FAIBLE") && <Badge variant="outline">Marge faible</Badge>}
                            {r.tags.includes("TRANSIT_NON_COUVERT") && (
                              <Badge variant="secondary">Transit non couvert</Badge>
                            )}
                            {r.tags.includes("DONNEES_MANQUANTES") && (
                              <Badge variant="outline">Données manquantes</Badge>
                            )}
                          </TableCell>

                          <TableCell className={`text-right ${m.amount < 0 ? "text-destructive" : ""}`}>
                            {eur(m.amount)}{" "}
                            <span className="text-xs text-muted-foreground">({pct(m.rate)})</span>
                          </TableCell>

                          <TableCell>
                            {(cov.transitCosts ?? 0) > 0 ? (
                              <span className={(cov.coverage ?? 0) < 1 ? "text-amber-600" : ""}>
                                {eur(cov.transitCosts ?? 0)} • {Math.round((cov.coverage ?? 0) * 100)}%
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">n/a</span>
                            )}
                          </TableCell>

                          <TableCell className="text-sm text-muted-foreground max-w-[360px]">
                            {r.recommendation}
                          </TableCell>

                          <TableCell className="text-right">
                            <div className="inline-flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => goFinance(r.caseId)}
                                title="Ouvrir la page Finance"
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Finance
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => goFlows(r.caseId)}
                                title="Ouvrir les Flux"
                              >
                                <ExternalLink className="h-4 w-4 mr-1" />
                                Flux
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Synthèses (utile direction) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Marge par destination</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(aggregates.byDestination).map(([dest, data]) => (
                    <div key={dest} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{dest}</Badge>
                        <span className="text-xs text-muted-foreground">{data.count} dossiers</span>
                      </div>
                      <span className={data.margin < 0 ? "text-destructive" : ""}>
                        {data.margin < 0 ? <TrendingDown className="inline h-4 w-4 mr-1" /> : <TrendingUp className="inline h-4 w-4 mr-1" />}
                        {eur(data.margin)}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Marge par incoterm</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(aggregates.byIncoterm).map(([incoterm, data]) => (
                    <div key={incoterm} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{incoterm}</Badge>
                        <span className="text-xs text-muted-foreground">{data.count} dossiers</span>
                      </div>
                      <span className={data.margin < 0 ? "text-destructive" : ""}>
                        {eur(data.margin)}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
