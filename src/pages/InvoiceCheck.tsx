import * as React from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { postPdf } from "@/lib/leadMagnetApi";

type Line = {
  description: string;
  qty: number;
  price: number;
  hs: string;
};

function calcScore(lines: Line[], incoterm: string, destination: string) {
  let score = 100;
  const missingHs = lines.filter((l) => l.hs.replace(/[^0-9]/g, "").length < 4).length;
  if (missingHs) score -= 20;
  if (!incoterm) score -= 10;
  if (!destination) score -= 10;
  return Math.max(40, score);
}

function getIssues(lines: Line[], incoterm: string, destination: string) {
  const issues: string[] = [];
  const missingHs = lines.filter((l) => l.hs.replace(/[^0-9]/g, "").length < 4).length;
  if (missingHs) issues.push("HS incomplet sur certaines lignes");
  if (!incoterm) issues.push("Incoterm manquant");
  if (!destination) issues.push("Destination manquante");
  if (issues.length === 0) issues.push("Aucun risque majeur detecte");
  return issues;
}

export default function InvoiceCheck() {
  const { toast } = useToast();
  const [destination, setDestination] = React.useState("");
  const [incoterm, setIncoterm] = React.useState("DAP");
  const [currency, setCurrency] = React.useState("EUR");
  const [lines, setLines] = React.useState<Line[]>([
    { description: "", qty: 1, price: 0, hs: "" },
  ]);
  const [reporting, setReporting] = React.useState(false);
  const [contactOpen, setContactOpen] = React.useState(false);
  const [contactEmail, setContactEmail] = React.useState("");
  const [company, setCompany] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const totalValue = lines.reduce((sum, l) => sum + l.qty * l.price, 0);
  const score = calcScore(lines, incoterm, destination);
  const issues = getIssues(lines, incoterm, destination);

  const updateLine = (idx: number, patch: Partial<Line>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const addLine = () => {
    setLines((prev) => [...prev, { description: "", qty: 1, price: 0, hs: "" }]);
  };

  const removeLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const generateReport = async () => {
    try {
      setReporting(true);
      const pdfBlob = await postPdf({
        title: "Rapport contr?le facture",
        destination,
        incoterm,
        currency,
        score,
        totalValue,
        lines,
      });
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `mpl-controle-facture-${Date.now()}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      toast({ title: "Rapport genere", description: "Le PDF est telecharge." });
    } catch (err: any) {
      toast({ title: "Erreur PDF", description: err?.message || "Impossible de generer le PDF." });
    } finally {
      setReporting(false);
    }
  };

  const openAudit = () => setContactOpen(true);

  const sendAudit = async () => {
    if (!contactEmail.trim()) {
      toast({ title: "Email requis", description: "Ajoute un email pour la demande." });
      return;
    }
    try {
      await fetch("/api/audit-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          company,
          email: contactEmail,
          destination,
          incoterm,
          value: totalValue,
          currency,
          lines_count: lines.length,
          notes,
          context: { lines },
        }),
      });
      toast({ title: "Demande envoyee", description: "Nous revenons vers vous rapidement." });
      setContactOpen(false);
    } catch (err: any) {
      toast({ title: "Erreur", description: err?.message || "Impossible d'envoyer la demande." });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <p className="text-sm text-muted-foreground">Contr?le facture</p>
          <h1 className="text-3xl font-semibold">Verifier une facture export</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Saisie manuelle (MVP)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Destination</Label>
                <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Ex: United States" />
              </div>
              <div className="space-y-2">
                <Label>Incoterm</Label>
                <Input value={incoterm} onChange={(e) => setIncoterm(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Devise</Label>
                <Input value={currency} onChange={(e) => setCurrency(e.target.value)} />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Lignes facture</Label>
                <Button variant="outline" onClick={addLine}>Ajouter une ligne</Button>
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
                      <Input type="number" value={line.qty} onChange={(e) => updateLine(idx, { qty: Number(e.target.value) || 0 })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Prix</Label>
                      <Input type="number" value={line.price} onChange={(e) => updateLine(idx, { price: Number(e.target.value) || 0 })} />
                    </div>
                    <div className="space-y-2">
                      <Label>HS code</Label>
                      <Input value={line.hs} onChange={(e) => updateLine(idx, { hs: e.target.value })} />
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
                <div className="text-2xl font-semibold">{totalValue.toFixed(0)} {currency}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Score conformite</div>
                <div className="text-2xl font-semibold">{score}/100</div>
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={generateReport} disabled={reporting}>
                  {reporting ? "Generation..." : "Generer le rapport PDF"}
                </Button>
                <Button variant="outline" onClick={openAudit}>Demander un audit complet</Button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-white p-4">
              <div className="text-xs text-muted-foreground">Explications</div>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {issues.map((issue) => (
                  <li key={issue}>• {issue}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upload (optionnel)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <Input type="file" />
            <p>MVP: l'extraction automatique est a venir. Utilise la saisie manuelle pour le moment.</p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Demande d'audit complet</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Entreprise</Label>
              <Input value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setContactOpen(false)}>Annuler</Button>
            <Button onClick={sendAudit}>Envoyer la demande</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
