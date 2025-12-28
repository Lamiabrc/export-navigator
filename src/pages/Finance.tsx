import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Download, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useImportedInvoices } from "@/hooks/useImportedInvoices";
import type { CostDoc } from "@/types/costs";
import { COST_DOCS_KEY } from "@/lib/constants/storage";
import { reconcile } from "@/lib/reco/reconcile";
import { aggregateCases, margin, transitCoverage } from "@/lib/kpi/exportKpis";
import { PageHeader } from "@/components/PageHeader";

type RiskTag = "PERTE" | "MARGE_FAIBLE" | "TRANSIT_NON_COUVERT";

function toLowerSafe(v?: string | null) {
  return (v ?? "").toLowerCase();
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((r) =>
      r
        .map((cell) => {
          const s = String(cell ?? "");
          // escape quotes
          const escaped = s.replace(/"/g, '""');
          return `"${escaped}"`;
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

export default function MarginAnalysis() {
  const { value: importedInvoices } = useImportedInvoices();
  const { value: costDocs } = useLocalStorage<CostDoc[]>(COST_DOCS_KEY, []);

  const cases = useMemo(() => reconcile(importedInvoices, costDocs), [importedInvoices, costDocs]);
  const aggregates = useMemo(() => aggregateCases(cases), [cases]);

  // Seuils “marge insuffisante”
  const [minMarginRate, setMinMarginRate] = useState<number>(5); // %
  const [minMarginAmount, setMinMarginAmount] = useState<number>(50); // €
  const [query, setQuery] = useState<string>("");

  const riskRows = useMemo(() => {
    const q = query.trim().toLowerCase();

    return cases
      .map((c) => {
        const m = margin(c);
        const cov = transitCoverage(c);

        const tags: RiskTag[] = [];
        if (m.amount < 0) tags.push("PERTE");
        if (m.amount >= 0 && (m.rate < minMarginRate || m.amount < minMarginAmount)) tags.push("MARGE_FAIBLE");
        if (cov.transitCosts > 0 && cov.coverage < 1) tags.push("TRANSIT_NON_COUVERT");

        const isRisk = tags.length > 0;

        // Recherche simple multi-champs
        const haystack = [
          c.invoice.invoiceNumber,
          c.invoice.clientName,
          c.invoice.destination,
          c.invoice.incoterm,
        ]
          .map((x) => toLowerSafe(x))
          .join(" ");

        const match = q.length === 0 ? true : haystack.includes(q);

        // Score simple pour trier : pertes d'abord, puis marge faible, puis transit non couvert
        const score =
          (tags.includes("PERTE") ? 1000 : 0) +
          (tags.includes("MARGE_FAIBLE") ? 400 : 0) +
          (tags.includes("TRANSIT_NON_COUVERT") ? 200 : 0) +
          Math.max(0, 200 - Math.round(m.rate * 10)); // favorise les marges plus faibles

        return { c, m, cov, tags, isRisk, match, score };
      })
      .filter((x) => x.isRisk && x.match)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50); // on limite pour rester lisible
  }, [cases, query, minMarginRate, minMarginAmount]);

  const riskStats = useMemo(() => {
    let losses = 0;
    let lowMargin = 0;
    let uncovered = 0;

    for (const r of riskRows) {
      if (r.tags.includes("PERTE")) losses += 1;
      if (r.tags.includes("MARGE_FAIBLE")) lowMargin += 1;
      if (r.tags.includes("TRANSIT_NON_COUVERT")) uncovered += 1;
    }
    return { atRisk: riskRows.length, losses, lowMargin, uncovered };
  }, [riskRows]);

  const exportRiskCsv = () => {
    const rows: string[][] = [
      [
        "Facture",
        "Client",
        "Destination",
        "Incoterm",
        "Marge (€)",
        "Marge (%)",
        "Transit costs (€)",
        "Couverture transit (%)",
        "Causes",
      ],
      ...riskRows.map(({ c, m, cov, tags }) => [
        c.invoice.invoiceNumber ?? "",
        c.invoice.clientName ?? "",
        c.invoice.destination ?? "",
        c.invoice.incoterm ?? "NC",
        String(Math.round(m.amount)),
        String(Number.isFinite(m.rate) ? m.rate.toFixed(2) : ""),
        String(Math.round(cov.transitCosts ?? 0)),
        cov.transitCosts > 0 ? String(Math.round((cov.coverage ?? 0) * 100)) : "n/a",
        tags.join(", "),
      ]),
    ];

    downloadCsv(`etat-risque-marge_${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Detection marge insuffisante"
          subtitle="Analyse basee sur le rapprochement factures & couts : pertes, marges faibles, transit non couvert."
          actions={cases.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={exportRiskCsv}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm hover:bg-muted transition"
                title="Exporter la liste des dossiers a risque"
              >
                <Download className="h-4 w-4" />
                Export CSV (risque)
              </button>
            </div>
          )}
        />

        {cases.length === 0 && (
          <Card>
            <CardContent className="py-6 text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Ajoutez vos factures et couts reels dans Supabase (page Admin ou tables) pour activer l'analyse.
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
                  <p className="text-3xl font-bold">{cases.length}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground">À risque (selon seuils)</p>
                  <p className="text-3xl font-bold">{riskStats.atRisk}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {riskStats.losses} pertes • {riskStats.lowMargin} marges faibles • {riskStats.uncovered} transit non couvert
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
                  <p className="text-xs text-muted-foreground">Montant transit non couvert</p>
                  <p className="text-3xl font-bold text-amber-600">
                    {aggregates.uncoveredTotal.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Seuils + recherche */}
            <Card>
              <CardHeader>
                <CardTitle>Seuils & filtres</CardTitle>
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
                  <p className="text-xs text-muted-foreground mb-1">Marge min (%)</p>
                  <input
                    type="number"
                    value={minMarginRate}
                    onChange={(e) => setMinMarginRate(Number(e.target.value))}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                    min={0}
                    step={0.5}
                  />
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Marge min (€)</p>
                  <input
                    type="number"
                    value={minMarginAmount}
                    onChange={(e) => setMinMarginAmount(Number(e.target.value))}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                    min={0}
                    step={10}
                  />
                </div>

                <div className="flex items-end">
                  <div className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground w-full">
                    Astuce : règle 5% / 50€ puis exporte la liste pour actionner ADV/Finance.
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Table "À risque" */}
            <Card>
              <CardHeader>
                <CardTitle>Dossiers à risque (top 50)</CardTitle>
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
                      <TableHead className="text-right">Marge (€/%)</TableHead>
                      <TableHead>Couverture transit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {riskRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-sm text-muted-foreground py-6">
                          Aucun dossier à risque avec les seuils actuels.
                        </TableCell>
                      </TableRow>
                    )}

                    {riskRows.map(({ c, m, cov, tags }) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.invoice.invoiceNumber}</TableCell>
                        <TableCell>{c.invoice.clientName}</TableCell>
                        <TableCell>{c.invoice.destination || "NC"}</TableCell>
                        <TableCell>{c.invoice.incoterm || "NC"}</TableCell>
                        <TableCell className="space-x-1">
                          {tags.includes("PERTE") && <Badge variant="destructive">Perte</Badge>}
                          {tags.includes("MARGE_FAIBLE") && <Badge variant="outline">Marge faible</Badge>}
                          {tags.includes("TRANSIT_NON_COUVERT") && <Badge variant="secondary">Transit non couvert</Badge>}
                        </TableCell>
                        <TableCell className={cn("text-right", m.amount < 0 ? "text-destructive" : "")}>
                          {m.amount.toLocaleString("fr-FR")} € ({Number.isFinite(m.rate) ? m.rate.toFixed(1) : "n/a"}%)
                        </TableCell>
                        <TableCell>
                          {cov.transitCosts > 0 ? (
                            <span className={cov.coverage < 1 ? "text-amber-600" : ""}>
                              {Math.round(cov.coverage * 100)}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">n/a</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Synthèses axes (déjà utiles) */}
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
                        {data.margin.toLocaleString("fr-FR")} €
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Marge par client</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(aggregates.byClient).map(([client, data]) => (
                    <div key={client} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{client}</Badge>
                        <span className="text-xs text-muted-foreground">{data.count} dossiers</span>
                      </div>
                      <span className={data.margin < 0 ? "text-destructive" : ""}>
                        {data.margin.toLocaleString("fr-FR")} €
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
                      <Badge variant="outline">{incoterm}</Badge>
                      <span className={data.margin < 0 ? "text-destructive" : ""}>
                        {data.margin.toLocaleString("fr-FR")} €
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Marge par transitaire</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(aggregates.byForwarder).map(([forwarder, data]) => (
                    <div key={forwarder} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {data.margin < 0 ? (
                          <TrendingDown className="h-4 w-4 text-destructive" />
                        ) : (
                          <TrendingUp className="h-4 w-4 text-primary" />
                        )}
                        <Badge variant="outline">{forwarder}</Badge>
                        <span className="text-xs text-muted-foreground">{data.count} dossiers</span>
                      </div>
                      <span className={data.margin < 0 ? "text-destructive" : ""}>
                        {data.margin.toLocaleString("fr-FR")} €
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

// mini-hook localStorage (évite d’importer une lib)
function useStateFromStorage(key: string, defaultValue: boolean) {
  const [state, setState] = useState<boolean>(() => {
    const saved = localStorage.getItem(key);
    if (saved === null) return defaultValue;
    return saved === "1";
  });

  const set = (v: boolean) => {
    setState(v);
    localStorage.setItem(key, v ? "1" : "0");
  };

  return [state, set] as const;
}
