import * as React from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { postPdf } from "@/lib/leadMagnetApi";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Line = {
  description: string;
  qty: number;
  price: number;
  hs: string;
};

function normalizeHs(hs: string) {
  return String(hs || "").replace(/[^0-9]/g, "");
}

function calcScore(lines: Line[], incoterm: string, destination: string) {
  let score = 100;

  const missingHs = lines.filter((l) => normalizeHs(l.hs).length < 4).length;
  const missingDesc = lines.filter((l) => !String(l.description || "").trim()).length;
  const invalidQty = lines.filter((l) => !Number.isFinite(l.qty) || l.qty <= 0).length;
  const invalidPrice = lines.filter((l) => !Number.isFinite(l.price) || l.price < 0).length;

  if (missingHs) score -= 20;
  if (missingDesc) score -= 10;
  if (invalidQty) score -= 10;
  if (invalidPrice) score -= 10;

  if (!String(incoterm || "").trim()) score -= 10;
  if (!String(destination || "").trim()) score -= 10;

  return Math.max(40, score);
}

function getIssues(lines: Line[], incoterm: string, destination: string) {
  const issues: string[] = [];

  const missingHs = lines.filter((l) => normalizeHs(l.hs).length < 4).length;
  const missingDesc = lines.filter((l) => !String(l.description || "").trim()).length;
  const invalidQty = lines.filter((l) => !Number.isFinite(l.qty) || l.qty <= 0).length;
  const invalidPrice = lines.filter((l) => !Number.isFinite(l.price) || l.price < 0).length;

  if (!String(destination || "").trim()) issues.push("MarchÃ© / destination manquant(e)");
  if (!String(incoterm || "").trim()) issues.push("Incoterm manquant");

  if (missingDesc) issues.push("Description manquante sur certaines lignes");
  if (invalidQty) issues.push("QuantitÃ© invalide sur certaines lignes (qty > 0)");
  if (invalidPrice) issues.push("Prix invalide sur certaines lignes (prix â‰¥ 0)");
  if (missingHs) issues.push("HS incomplet sur certaines lignes (min. 4 chiffres)");

  if (issues.length === 0) issues.push("Aucun risque majeur dÃ©tectÃ© (contrÃ´le de cohÃ©rence OK).");
  return issues;
}

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency || "EUR",
      maximumFractionDigits: 2,
    }).format(value || 0);
  } catch {
    return `${(value || 0).toFixed(2)} ${currency || "EUR"}`;
  }
}

function formatPct(value: number | null | undefined) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "n/a";
  return `${n.toFixed(2)}%`;
}

function buildInvoiceRecommendations(params: {
  destination: string;
  incoterm: string;
  issues: string[];
  comparison: any | null;
}) {
  const recommendations: string[] = [];
  const { destination, incoterm, issues, comparison } = params;

  if (!String(destination || "").trim()) {
    recommendations.push("Renseigner le pays de destination pour finaliser la conformitÃ© douaniÃ¨re et fiscale.");
  }
  if (!String(incoterm || "").trim()) {
    recommendations.push("DÃ©finir l'Incoterm contractuel pour clarifier les responsabilitÃ©s, coÃ»ts et risques.");
  }
  if (issues.some((issue) => /hs/i.test(issue))) {
    recommendations.push("ComplÃ©ter les codes HS manquants ou incomplets (6 chiffres) avant Ã©mission finale.");
  }
  if (comparison?.coverage?.unmatched > 0) {
    recommendations.push("VÃ©rifier les lignes non matchÃ©es avec le rÃ©fÃ©rentiel destination (droits/OM/OMR).");
  }
  if (comparison?.coverage?.matched > 0) {
    recommendations.push("Valider les taux dÃ©tectÃ©s (OM/OMR/taxes) et documenter la source rÃ©glementaire.");
  }

  if (!recommendations.length) {
    recommendations.push("ContrÃ´le cohÃ©rent. Lancer une revue finale documentaire avant expÃ©dition.");
  }

  return recommendations.slice(0, 6);
}

export default function InvoiceCheck() {
  const { toast } = useToast();
  const { labels, variables } = useGlobalFilters();
  const { user } = useAuth();

  const resultRef = React.useRef<HTMLDivElement | null>(null);
  const scrollToResults = () => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const [destination, setDestination] = React.useState("");
  const [incoterm, setIncoterm] = React.useState("DAP");
  const [currency, setCurrency] = React.useState("EUR");

  const [entryMode, setEntryMode] = React.useState<"import" | "manual">("import");
  const [activityLabel, setActivityLabel] = React.useState("");

  const [lines, setLines] = React.useState<Line[]>([{ description: "", qty: 1, price: 0, hs: "" }]);

  const [reporting, setReporting] = React.useState(false);
  const [contactOpen, setContactOpen] = React.useState(false);
  const [contactEmail, setContactEmail] = React.useState("");
  const [company, setCompany] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const [importing, setImporting] = React.useState(false);
  const [importError, setImportError] = React.useState<string | null>(null);
  const [importSummary, setImportSummary] = React.useState<any | null>(null);
  const [importFileName, setImportFileName] = React.useState<string | null>(null);
  const [comparison, setComparison] = React.useState<any | null>(null);
  const [analysisSource, setAnalysisSource] = React.useState<"edge" | "local_pdf" | null>(null);

  const prefillRef = React.useRef(false);

  React.useEffect(() => {
    if (prefillRef.current) return;
    if (destination) return;

    const fallback = (labels?.territory_label || variables?.territory_code || "").toString().trim();
    if (fallback) {
      setDestination(fallback);
      prefillRef.current = true;
    }
  }, [destination, labels?.territory_label, variables?.territory_code]);

  const totalValue = lines.reduce((sum, l) => sum + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
  const score = calcScore(lines, incoterm, destination);
  const issues = getIssues(lines, incoterm, destination);

  const renderMatch = (line: any) => {
    if (!line) return "Aucun match";
    if (line.matchLevel === "exact") return `HS ${line.reference?.hs_code || line.hs} (exact)`;
    if (line.matchLevel === "hs6") return `HS ${line.reference?.hs_code || line.hs} (HS6)`;
    if (line.matchLevel === "hs4") return `HS ${line.reference?.hs_code || line.hs} (HS4)`;
    return "Aucun match";
  };

  const updateLine = (idx: number, patch: Partial<Line>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const addLine = () => setLines((prev) => [...prev, { description: "", qty: 1, price: 0, hs: "" }]);
  const removeLine = (idx: number) => setLines((prev) => prev.filter((_, i) => i !== idx));

  const normalizeSummary = (raw: any) => {
    if (!raw) return null;
    const lineItems = Array.isArray(raw.lineItems) ? raw.lineItems : Array.isArray(raw.lines) ? raw.lines : [];
    return {
      invoiceNumber: raw.invoiceNumber ?? raw.invoice_number ?? null,
      supplier: raw.supplier ?? null,
      date: raw.date ?? null,
      totalHT: raw.totalHT ?? raw.total_ht ?? null,
      totalTVA: raw.totalTVA ?? raw.total_tva ?? null,
      totalTTC: raw.totalTTC ?? raw.total_ttc ?? null,
      transitFees: raw.transitFees ?? raw.transit_fees ?? null,
      billingCountry: raw.billingCountry ?? raw.billing_country ?? null,
      vatExemptionMention: raw.vatExemptionMention ?? null,
      lineItems,
    };
  };

  const mapLinesFromParsed = (summary: any): Line[] => {
    const items = Array.isArray(summary?.lineItems) ? summary.lineItems : [];
    const mapped = items
      .map((it: any) => {
        const qtyRaw = Number(it?.quantity ?? it?.qty ?? 1);
        const qty = Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : 1;
        const amountRaw = Number(it?.amountHT ?? it?.amount ?? it?.total ?? 0);
        const unit = qty > 0 ? amountRaw / qty : amountRaw;
        const description = String(it?.description || it?.codeArticle || it?.label || "").trim();
        return {
          description: description || "Ligne importee",
          qty,
          price: Number.isFinite(unit) ? unit : 0,
          hs: String(it?.hsCode || it?.hs || "").trim(),
        } as Line;
      })
      .filter((it: Line) => it.description || it.qty || it.price || it.hs);

    return mapped.length ? mapped : [{ description: "", qty: 1, price: 0, hs: "" }];
  };

  const handleImportFile = async (file: File) => {
    if (!user) {
      toast({ title: "Connexion requise", description: "Connecte-toi pour importer une facture." });
      return;
    }

    setImporting(true);
    setImportError(null);
    setImportSummary(null);
    setComparison(null);
    setAnalysisSource(null);
    setImportFileName(file.name);

    try {
      const safeName = file.name.replace(/[^\w.-]+/g, "_");
      const path = `${user.id}/${Date.now()}-${safeName}`;
      const bucket = "invoice_files";

      const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
        upsert: false,
        contentType: file.type || undefined,
      });
      if (uploadError) throw new Error(uploadError.message);

      const payload = {
        bucket,
        path,
        fileName: file.name,
        fileType: file.type,
        size: file.size,
        destination,
        incoterm,
        currency,
        activityLabel,
      };

      try {
        const { data, error } = await supabase.functions.invoke("invoice-import", { body: payload });
        if (error) throw error;

        const normalized = normalizeSummary(data?.parsed);
        if (normalized) {
          setImportSummary(normalized);
          setLines(mapLinesFromParsed(normalized));
          if (!destination && normalized.billingCountry) setDestination(normalized.billingCountry);
        }
        const cmp = data?.comparison || data?.parsed?.comparison;
        if (cmp) setComparison(cmp);
        setAnalysisSource("edge");

        toast({ title: "Facture importee", description: "Le fichier est stocke et la synthese est disponible." });
        setTimeout(scrollToResults, 120);
      } catch (edgeErr: any) {
        const isPdf = file.type.toLowerCase().includes("pdf") || file.name.toLowerCase().endsWith(".pdf");
        if (!isPdf) throw edgeErr;

        const { extractInvoiceFromPdf } = await import("@/lib/pdf/extractInvoice");
        const parsedLocal = await extractInvoiceFromPdf(file);
        const normalized = normalizeSummary(parsedLocal);
        if (!normalized) throw edgeErr;

        setImportSummary(normalized);
        setLines(mapLinesFromParsed(normalized));
        if (!destination && normalized.billingCountry) setDestination(normalized.billingCountry);

        const lineItems = Array.isArray(normalized.lineItems) ? normalized.lineItems : [];
        const withHs = lineItems.filter(
          (line: any) => String(line?.hsCode || line?.hs || "").replace(/[^0-9]/g, "").length >= 4,
        ).length;
        const missingHs = Math.max(0, lineItems.length - withHs);

        setComparison({
          destination: destination || normalized.billingCountry || null,
          inputDestination: destination || null,
          coverage: {
            total: lineItems.length,
            withHs,
            matched: 0,
            missingHs,
            unmatched: 0,
          },
          lines: [],
          issues: ["Analyse locale PDF utilisee (referentiel distant indisponible temporairement)."],
        });
        setAnalysisSource("local_pdf");

        toast({
          title: "Facture analysee (mode local)",
          description: "Extraction PDF locale effectuee. Verifiez ensuite les taux/referentiels.",
        });
        setTimeout(scrollToResults, 120);
      }
    } catch (err: any) {
      setImportError(err?.message || "Import impossible.");
      toast({ title: "Erreur import", description: err?.message || "Import impossible." });
    } finally {
      setImporting(false);
    }
  };
  const generateReport = async () => {
    try {
      setReporting(true);

      const pdfBlob = await postPdf({
        title: "Rapport de contrÃ´le facture (import/export)",
        destination,
        incoterm,
        currency,
        activityLabel,
        score,
        value: totalValue,
        lines,
      });

      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `mpl-controle-facture-${Date.now()}.pdf`;
      link.click();
      URL.revokeObjectURL(url);

      toast({ title: "Rapport gÃ©nÃ©rÃ©", description: "Le PDF a Ã©tÃ© tÃ©lÃ©chargÃ©." });
    } catch (err: any) {
      toast({ title: "Erreur PDF", description: err?.message || "Impossible de gÃ©nÃ©rer le PDF." });
    } finally {
      setReporting(false);
    }
  };

  const openAudit = () => setContactOpen(true);

  const sendAudit = async () => {
    const email = contactEmail.trim();
    if (!email) {
      toast({ title: "Email requis", description: "Ajoute un email pour la demande." });
      return;
    }

    try {
      const res = await fetch("/api/audit-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          company: company?.trim() || "",
          email,
          destination,
          incoterm,
          activity: activityLabel?.trim() || "",
          value: totalValue,
          currency,
          lines_count: lines.length,
          notes: notes?.trim() || "",
          context: { lines },
        }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Impossible d'envoyer la demande.");
      }

      toast({ title: "Demande envoyÃ©e", description: "Nous revenons vers vous rapidement." });
      setContactOpen(false);
    } catch (err: any) {
      toast({ title: "Erreur", description: err?.message || "Impossible d'envoyer la demande." });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <p className="text-sm text-muted-foreground">ContrÃ´le facture</p>
          <h1 className="text-3xl font-semibold font-display">VÃ©rifier une facture import / export</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Saisie rapide pour repÃ©rer les incohÃ©rences, les zones Ã  risque et gÃ©nÃ©rer un rapport PDF.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="secondary">MarchÃ© : {destination || "Ã  dÃ©finir"}</Badge>
            <Badge variant="outline">Incoterm : {incoterm || "Ã  dÃ©finir"}</Badge>
            <Badge variant="outline">Devise : {currency}</Badge>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Mode d'analyse</CardTitle>
            <CardDescription>Importer un PDF/Excel ou saisir manuellement les lignes.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant={entryMode === "import" ? "default" : "outline"} onClick={() => setEntryMode("import")}>
              Importer une facture (PDF/Excel/CSV)
            </Button>
            <Button variant={entryMode === "manual" ? "default" : "outline"} onClick={() => setEntryMode("manual")}>
              Saisie manuelle
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contexte facture</CardTitle>
            <CardDescription>Indiquez l'intitulÃ© exact de l'activitÃ© et les paramÃ¨tres de base.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2 md:col-span-2">
              <Label>ActivitÃ© exacte</Label>
              <Input
                value={activityLabel}
                onChange={(e) => setActivityLabel(e.target.value)}
                placeholder="Ex : Fabrication de dispositifs mÃ©dicaux"
              />
            </div>
            <div className="space-y-2">
              <Label>MarchÃ© / destination</Label>
              <Input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Ex : Ã‰tats-Unis / Allemagne / Suisse"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Saisie manuelle / lignes facture</CardTitle>
            <CardDescription>Renseignez les lignes ou ajustez les donnÃ©es importÃ©es.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">

              <div className="space-y-2">
                <Label>Incoterm</Label>
                <Input value={incoterm} onChange={(e) => setIncoterm(e.target.value)} placeholder="Ex : EXW, FCA, CPT, DAP, DDPâ€¦" />
              </div>

              <div className="space-y-2">
                <Label>Devise</Label>
                <Input value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="EUR" />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Lignes facture</Label>
                <Button variant="outline" onClick={addLine}>
                  Ajouter une ligne
                </Button>
              </div>

              <div className="space-y-3">
                {lines.map((line, idx) => (
                  <div key={idx} className="grid gap-3 md:grid-cols-[2fr_0.6fr_0.8fr_0.8fr_auto] items-end">
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Input value={line.description} onChange={(e) => updateLine(idx, { description: e.target.value })} />
                    </div>

                    <div className="space-y-2">
                      <Label>Qty</Label>
                      <Input
                        type="number"
                        value={line.qty}
                        onChange={(e) => updateLine(idx, { qty: Number(e.target.value) || 0 })}
                        min={0}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Prix</Label>
                      <Input
                        type="number"
                        value={line.price}
                        onChange={(e) => updateLine(idx, { price: Number(e.target.value) || 0 })}
                        min={0}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>HS code</Label>
                      <Input value={line.hs} onChange={(e) => updateLine(idx, { hs: e.target.value })} placeholder="Ex : 6109, 610910â€¦" />
                    </div>

                    <Button variant="ghost" onClick={() => removeLine(idx)} disabled={lines.length === 1}>
                      Retirer
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={scrollToResults}>
                Voir la synthÃ¨se
              </Button>
            </div>

            <div ref={resultRef} className="space-y-4">
              <div className="rounded-xl border border-border bg-muted/40 p-4 grid gap-4 md:grid-cols-3">
                <div>
                <div className="text-xs text-muted-foreground">Valeur totale</div>
                <div className="text-2xl font-semibold">{formatMoney(totalValue, currency)}</div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground">Score de cohÃ©rence</div>
                <div className="text-2xl font-semibold">{score}/100</div>
              </div>

              <div className="flex items-center gap-3">
                <Button onClick={generateReport} disabled={reporting}>
                  {reporting ? "GÃ©nÃ©rationâ€¦" : "GÃ©nÃ©rer le rapport PDF"}
                </Button>
                <Button variant="outline" onClick={openAudit}>
                  Demander une revue experte
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-white p-4">
              <div className="text-xs text-muted-foreground">Explications</div>
              <div className="mt-2 space-y-1 text-sm text-slate-600">
                {issues.map((issue) => (
                  <div key={issue} className="flex gap-2">
                    <span className="text-muted-foreground">-</span>
                    <span>{issue}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                NB : ce contrÃ´le est un repÃ©rage rapide (MVP). Pour des cas sensibles, une revue experte est recommandÃ©e.
              </div>
            </div>
            </div>
          </CardContent>
        </Card>
        {entryMode === "import" ? (
<Card>
          <CardHeader>
            <CardTitle>Importer une facture (PDF analysÃ© automatiquement)</CardTitle>
            <CardDescription>Extraction auto des lignes, HS, totaux et pays si dÃ©tectÃ©s.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="file"
              accept=".pdf,.xlsx,.xls,.csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImportFile(file);
                e.currentTarget.value = "";
              }}
              disabled={importing}
            />

            {importFileName ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                Fichier : {importFileName}
              </div>
            ) : null}

            {importing ? (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                Import en cours...
              </div>
            ) : null}

            {importError ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {importError}
              </div>
            ) : null}

            {importSummary ? (
              <div className="rounded-xl border border-border bg-white p-4 space-y-3">
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">SynthÃ¨se importÃ©e</div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Total HT</div>
                    <div className="text-lg font-semibold">
                      {importSummary.totalHT == null ? "???" : formatMoney(Number(importSummary.totalHT || 0), currency)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Total TVA</div>
                    <div className="text-lg font-semibold">
                      {importSummary.totalTVA == null ? "???" : formatMoney(Number(importSummary.totalTVA || 0), currency)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Total TTC</div>
                    <div className="text-lg font-semibold">
                      {importSummary.totalTTC == null ? "???" : formatMoney(Number(importSummary.totalTTC || 0), currency)}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {importSummary.invoiceNumber ? <Badge variant="outline">Facture: {importSummary.invoiceNumber}</Badge> : null}
                  {importSummary.billingCountry ? <Badge variant="outline">Pays: {importSummary.billingCountry}</Badge> : null}
                  {analysisSource === "edge" ? <Badge variant="outline">Analyse: moteur serveur</Badge> : null}
                  {analysisSource === "local_pdf" ? <Badge variant="secondary">Analyse: fallback PDF local</Badge> : null}
                  {importSummary.transitFees != null ? (
                    <Badge variant="outline">Transit: {formatMoney(Number(importSummary.transitFees || 0), currency)}</Badge>
                  ) : null}
                </div>
              </div>
            ) : null}

            {comparison ? (
              <div className="rounded-xl border border-border bg-white p-4 space-y-3">
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Verification HS / pays</div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">Destination: {comparison.destination || comparison.inputDestination || "?"}</Badge>
                  <Badge variant="outline">
                    Couverture: {comparison.coverage?.matched ?? 0}/{comparison.coverage?.withHs ?? 0}
                  </Badge>
                  <Badge variant="outline">Lignes: {comparison.coverage?.total ?? 0}</Badge>
                </div>

                {comparison.issues?.length ? (
                  <div className="space-y-1 text-xs text-rose-700">
                    {comparison.issues.map((issue: string, idx: number) => (
                      <div key={`${issue}-${idx}`} className="flex gap-2">
                        <span className="text-rose-500">-</span>
                        <span>{issue}</span>
                      </div>
                    ))}
                  </div>
                ) : null}

                {comparison.lines?.length ? (
                  <div className="space-y-2 text-sm text-slate-600">
                    {comparison.lines.slice(0, 8).map((line: any, idx: number) => (
                      <div key={line.index ?? idx} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-medium text-slate-900">
                            {line.description || `Ligne ${typeof line.index === "number" ? line.index + 1 : idx + 1}`}
                          </div>
                          <div className="text-xs text-muted-foreground">HS: {line.hs || "n/a"}</div>
                        </div>
                        <div className="text-xs text-muted-foreground">{renderMatch(line)}</div>
                        {line.reference ? (
                          <div className="mt-1 text-xs text-slate-500">
                            OM {formatPct(line.reference.om_rate)} / OMR {formatPct(line.reference.omr_rate)}
                            {line.reference.category ? ` - ${line.reference.category}` : ""}
                          </div>
                        ) : null}
                        {line.issues?.length ? (
                          <div className="mt-1 text-xs text-rose-700">
                            {line.issues.map((issue: string, i2: number) => (
                              <div key={`${line.index ?? idx}-${i2}`} className="flex gap-2">
                                <span className="text-rose-500">-</span>
                                <span>{issue}</span>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {importSummary || comparison ? (
              <div className="rounded-xl border border-border bg-white p-4 space-y-2">
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Recommandations automatiques</div>
                <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
                  {buildInvoiceRecommendations({ destination, incoterm, issues, comparison }).map((rec) => (
                    <li key={rec}>{rec}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <p className="text-xs text-muted-foreground">
              Formats acceptÃ©s : PDF, Excel (XLSX/XLS) ou CSV. Le fichier est stockÃ© dans Supabase et la synthÃ¨se
              est appliquÃ©e aux lignes ci-dessus.
            </p>
          </CardContent>
        </Card>
        ) : null}
      </div>

      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Demande de revue experte</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Entreprise</Label>
              <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Nom de lâ€™entreprise" />
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="vous@entreprise.com" />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contexte, urgence, point bloquant, type de marchandiseâ€¦"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setContactOpen(false)}>
              Annuler
            </Button>
            <Button onClick={sendAudit}>Envoyer la demande</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

