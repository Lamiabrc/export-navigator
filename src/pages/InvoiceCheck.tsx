import * as React from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { postPdf } from "@/lib/leadMagnetApi";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";

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

  if (!String(destination || "").trim()) issues.push("Marché / destination manquant(e)");
  if (!String(incoterm || "").trim()) issues.push("Incoterm manquant");

  if (missingDesc) issues.push("Description manquante sur certaines lignes");
  if (invalidQty) issues.push("Quantité invalide sur certaines lignes (qty > 0)");
  if (invalidPrice) issues.push("Prix invalide sur certaines lignes (prix ≥ 0)");
  if (missingHs) issues.push("HS incomplet sur certaines lignes (min. 4 chiffres)");

  if (issues.length === 0) issues.push("Aucun risque majeur détecté (contrôle de cohérence OK).");
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

export default function InvoiceCheck() {
  const { toast } = useToast();
  const { labels, variables } = useGlobalFilters();

  const [destination, setDestination] = React.useState("");
  const [incoterm, setIncoterm] = React.useState("DAP");
  const [currency, setCurrency] = React.useState("EUR");

  const [lines, setLines] = React.useState<Line[]>([{ description: "", qty: 1, price: 0, hs: "" }]);

  const [reporting, setReporting] = React.useState(false);
  const [contactOpen, setContactOpen] = React.useState(false);
  const [contactEmail, setContactEmail] = React.useState("");
  const [company, setCompany] = React.useState("");
  const [notes, setNotes] = React.useState("");

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

  const updateLine = (idx: number, patch: Partial<Line>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const addLine = () => setLines((prev) => [...prev, { description: "", qty: 1, price: 0, hs: "" }]);
  const removeLine = (idx: number) => setLines((prev) => prev.filter((_, i) => i !== idx));

  const generateReport = async () => {
    try {
      setReporting(true);

      const pdfBlob = await postPdf({
        title: "Rapport de contrôle facture (import/export)",
        destination,
        incoterm,
        currency,
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

      toast({ title: "Rapport généré", description: "Le PDF a été téléchargé." });
    } catch (err: any) {
      toast({ title: "Erreur PDF", description: err?.message || "Impossible de générer le PDF." });
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

      toast({ title: "Demande envoyée", description: "Nous revenons vers vous rapidement." });
      setContactOpen(false);
    } catch (err: any) {
      toast({ title: "Erreur", description: err?.message || "Impossible d'envoyer la demande." });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <p className="text-sm text-muted-foreground">Contrôle facture</p>
          <h1 className="text-3xl font-semibold font-display">Vérifier une facture import / export</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Saisie rapide pour repérer les incohérences, les zones à risque et générer un rapport PDF.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="secondary">Marché : {destination || "à définir"}</Badge>
            <Badge variant="outline">Incoterm : {incoterm || "à définir"}</Badge>
            <Badge variant="outline">Devise : {currency}</Badge>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Saisie rapide</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Marché / destination</Label>
                <Input
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Ex : États-Unis / Allemagne / Suisse…"
                />
              </div>

              <div className="space-y-2">
                <Label>Incoterm</Label>
                <Input value={incoterm} onChange={(e) => setIncoterm(e.target.value)} placeholder="Ex : EXW, FCA, CPT, DAP, DDP…" />
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
                      <Input value={line.hs} onChange={(e) => updateLine(idx, { hs: e.target.value })} placeholder="Ex : 6109, 610910…" />
                    </div>

                    <Button variant="ghost" onClick={() => removeLine(idx)} disabled={lines.length === 1}>
                      Retirer
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-muted/40 p-4 grid gap-4 md:grid-cols-3">
              <div>
                <div className="text-xs text-muted-foreground">Valeur totale</div>
                <div className="text-2xl font-semibold">{formatMoney(totalValue, currency)}</div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground">Score de cohérence</div>
                <div className="text-2xl font-semibold">{score}/100</div>
              </div>

              <div className="flex items-center gap-3">
                <Button onClick={generateReport} disabled={reporting}>
                  {reporting ? "Génération…" : "Générer le rapport PDF"}
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
                NB : ce contrôle est un repérage rapide (MVP). Pour des cas sensibles, une revue experte est recommandée.
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upload (optionnel)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <Input type="file" />
            <p>MVP : l’extraction automatique arrive bientôt. Utilisez la saisie manuelle pour le moment.</p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Demande de revue experte</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Entreprise</Label>
              <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Nom de l’entreprise" />
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
                placeholder="Contexte, urgence, point bloquant, type de marchandise…"
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
