import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { postLead, postPdf } from "@/lib/leadMagnetApi";
import { useToast } from "@/hooks/use-toast";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { formatDateTimeFr } from "@/lib/formatters";

type BriefResponse = {
  estimate: { duty: number; taxes: number; total: number; currency: string };
  documents: string[];
  risks: Array<{ title: string; level: "low" | "medium" | "high"; message: string }>;
  complianceScore: number;
  updatedAt: string;
  confidence: "low" | "medium" | "high";
  sources: string[];
  simulationId?: string | null;
};

const HS_CHIPS = ["3004", "8708", "2204", "3304", "9403", "8504"];
const COUNTRIES = [
  { label: "États-Unis", iso2: "US" },
  { label: "Allemagne", iso2: "DE" },
  { label: "Espagne", iso2: "ES" },
  { label: "Royaume-Uni", iso2: "GB" },
  { label: "Chine", iso2: "CN" },
  { label: "Canada", iso2: "CA" },
  { label: "Maroc", iso2: "MA" },
  { label: "Émirats arabes unis", iso2: "AE" },
  { label: "Japon", iso2: "JP" },
  { label: "Inde", iso2: "IN" },
];

const TRUST_ITEMS = [
  "Mise à jour des sanctions quotidienne",
  "Règles export vérifiées",
  "Estimation immédiate",
];

export default function LeadMagnet() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [productOrHs, setProductOrHs] = React.useState("");
  const [destinationIso2, setDestinationIso2] = React.useState("");
  const [destinationLabel, setDestinationLabel] = React.useState("");
  const [value, setValue] = React.useState("10000");
  const [currency, setCurrency] = React.useState("EUR");
  const [incoterm, setIncoterm] = React.useState("DAP");
  const [mode, setMode] = React.useState("sea");
  const [weightKg, setWeightKg] = React.useState("");
  const [insurance, setInsurance] = React.useState("");
  const [consent, setConsent] = React.useState(false);
  const [email, setEmail] = React.useState("");

  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<BriefResponse | null>(null);
  const [history, setHistory] = React.useState<Array<{ payload: any; result: BriefResponse }>>([]);

  const normalizedInput = productOrHs.trim();
  const hsNormalized = normalizedInput.replace(/[^0-9]/g, "");
  const hsOnly = hsNormalized.length >= 2 && hsNormalized.length <= 6 && hsNormalized.length === normalizedInput.length;
  const inferredHs = hsOnly ? hsNormalized : "";
  const inferredProduct = hsOnly ? "" : normalizedInput;
  const hsOptions = React.useMemo(() => {
    const fromHistory = history.map((h) => String(h.payload?.hsInput || "")).filter(Boolean);
    return Array.from(new Set([...HS_CHIPS, ...fromHistory]));
  }, [history]);

  React.useEffect(() => {
    const rawHistory = localStorage.getItem("mpl_sim_history");
    if (rawHistory) {
      try {
        setHistory(JSON.parse(rawHistory));
      } catch {
        setHistory([]);
      }
    }
  }, []);

  const handleEstimate = async () => {
    if (!normalizedInput && hsNormalized.length < 2) {
      toast({ title: "Saisie requise", description: "Saisis un produit ou un code HS (2-6 chiffres)." });
      return;
    }
    if (!destinationIso2) {
      toast({ title: "Pays requis", description: "Sélectionne un pays de destination." });
      return;
    }

    try {
      setLoading(true);
      const payload = {
        hsInput: inferredHs || undefined,
        productText: inferredProduct || undefined,
        destinationIso2,
        value: Number(value || 0),
        currency,
        incoterm,
        mode,
        weightKg: weightKg ? Number(weightKg) : null,
        insurance: insurance ? Number(insurance) : null,
      };

      const res = await fetch("/api/export/brief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => r.json());

      if (res.error) throw new Error(res.error);
      setResult(res);
      const entry = { payload, result: res };
      setHistory((prev) => [entry, ...prev].slice(0, 6));
      localStorage.setItem("mpl_last_simulation", JSON.stringify(entry));
      localStorage.setItem("mpl_sim_history", JSON.stringify([entry, ...history].slice(0, 6)));
    } catch (err: any) {
      toast({ title: "Erreur estimation", description: err?.message || "Impossible de calculer." });
    } finally {
      setLoading(false);
    }
  };

  const handleLead = async () => {
    if (!result) {
      toast({ title: "Calcule d'abord", description: "Lance l'estimation avant le rapport." });
      return;
    }
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      toast({ title: "Email requis", description: "Ajoute un email pour recevoir le rapport." });
      return;
    }
    if (!consent) {
      toast({ title: "Consentement requis", description: "Coche la case RGPD pour continuer." });
      return;
    }

    try {
      setLoading(true);
      await postLead({
        email: trimmedEmail,
        consent,
        simulationId: result.simulationId,
        metadata: {
          hsInput: inferredHs,
          productText: inferredProduct,
          destinationIso2,
          incoterm,
          value,
          currency,
          mode,
        },
      });

      localStorage.setItem("mpl_lead_email", trimmedEmail);

      const pdfBlob = await postPdf({
        title: "Rapport de contrôle export",
        email: trimmedEmail,
        destination: destinationLabel || destinationIso2,
        incoterm,
        value,
        currency,
        result: {
          landedCost: {
            duty: result.estimate.duty,
            taxes: result.estimate.taxes,
            total: result.estimate.total,
            currency: result.estimate.currency,
          },
        },
      });
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `mpl-rapport-export-${Date.now()}.pdf`;
      link.click();
      URL.revokeObjectURL(url);

      toast({ title: "Rapport généré", description: "Le PDF est téléchargé." });
      navigate("/app/control-tower");
    } catch (err: any) {
      toast({ title: "Erreur lead", description: err?.message || "Impossible de finaliser." });
    } finally {
      setLoading(false);
    }
  };

  const reuseHistory = (entry: { payload: any; result: BriefResponse }) => {
    const p = entry.payload || {};
    setProductOrHs(p.hsInput || p.productText || "");
    setDestinationIso2(p.destinationIso2 || "");
    setDestinationLabel(COUNTRIES.find((c) => c.iso2 === p.destinationIso2)?.label || "");
    setValue(String(p.value || ""));
    setCurrency(p.currency || "EUR");
    setIncoterm(p.incoterm || "DAP");
    setMode(p.mode || "sea");
    setWeightKg(p.weightKg ? String(p.weightKg) : "");
    setInsurance(p.insurance ? String(p.insurance) : "");
    setResult(entry.result);
  };

  const downloadHistoryReport = async (entry: { payload: any; result: BriefResponse }) => {
    try {
      setLoading(true);
      const pdfBlob = await postPdf({
        title: "Rapport de contrôle export",
        destination: entry.payload?.destinationIso2,
        incoterm: entry.payload?.incoterm,
        value: entry.payload?.value,
        currency: entry.payload?.currency,
        result: {
          landedCost: {
            duty: entry.result.estimate.duty,
            taxes: entry.result.estimate.taxes,
            total: entry.result.estimate.total,
            currency: entry.result.estimate.currency,
          },
        },
      });
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `mpl-rapport-export-${Date.now()}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: "Erreur PDF", description: err?.message || "Impossible de générer le rapport." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicLayout>
      <section className="grid gap-12 lg:grid-cols-[1.15fr_0.95fr] lg:items-start">
        <div className="space-y-6 text-white">
          <p className="text-xs uppercase tracking-[0.4em] text-blue-200">Audit - Réglementation - Veille</p>
          <h1 className="text-4xl font-semibold leading-tight md:text-6xl">
            Votre contrôle export en 30 secondes.
          </h1>
          <p className="text-lg text-slate-200">
            Estimation immédiate des droits/taxes, documents requis et risques sanctions. Rapport PDF MPL + veille personnalisée.
          </p>
          <div className="flex flex-wrap gap-2">
            {HS_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setProductOrHs(chip)}
                className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-sm text-white"
              >
                HS {chip}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-slate-200">
            {TRUST_ITEMS.map((item) => (
              <span key={item} className="rounded-full border border-white/20 bg-white/10 px-3 py-1">
                {item}
              </span>
            ))}
          </div>
        </div>

        <Card className="border border-white/15 bg-white/10 text-white shadow-2xl backdrop-blur-xl">
          <CardContent className="space-y-4 p-7 md:p-8">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Produit ou code HS</Label>
                <Input
                  value={productOrHs}
                  onChange={(e) => setProductOrHs(e.target.value)}
                  placeholder="Ex: cosmetique ou 3004"
                  list="hs-list"
                  className="border-white/20 bg-white/90 text-slate-900 placeholder:text-slate-500"
                />
                </div>
                <datalist id="hs-list">
                  {hsOptions.map((code) => (
                    <option key={code} value={code} />
                  ))}
                </datalist>
              <div className="space-y-2">
                <Label>Destination</Label>
                <Select
                  value={destinationIso2}
                  onValueChange={(val) => {
                    setDestinationIso2(val);
                    setDestinationLabel(COUNTRIES.find((c) => c.iso2 === val)?.label || val);
                  }}
                >
                  <SelectTrigger className="border-white/20 bg-white/90 text-slate-900">
                    <SelectValue placeholder="Sélectionner un pays" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.iso2} value={c.iso2}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valeur marchandise</Label>
                <Input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  type="number"
                  className="border-white/20 bg-white/90 text-slate-900"
                />
              </div>
              <div className="space-y-2">
                <Label>Incoterm</Label>
                <Select value={incoterm} onValueChange={setIncoterm}>
                  <SelectTrigger className="border-white/20 bg-white/90 text-slate-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EXW">EXW</SelectItem>
                    <SelectItem value="FCA">FCA</SelectItem>
                    <SelectItem value="DAP">DAP</SelectItem>
                    <SelectItem value="DDP">DDP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Accordion type="single" collapsible>
              <AccordionItem value="advanced">
                <AccordionTrigger className="text-white">Options avancees</AccordionTrigger>
                <AccordionContent>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Devise</Label>
                      <Select value={currency} onValueChange={setCurrency}>
                        <SelectTrigger className="border-white/20 bg-white/90 text-slate-900">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="GBP">GBP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Mode transport</Label>
                      <Select value={mode} onValueChange={setMode}>
                        <SelectTrigger className="border-white/20 bg-white/90 text-slate-900">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="air">Air</SelectItem>
                          <SelectItem value="sea">Maritime</SelectItem>
                          <SelectItem value="road">Route</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Poids (kg)</Label>
                      <Input
                        value={weightKg}
                        onChange={(e) => setWeightKg(e.target.value)}
                        type="number"
                        className="border-white/20 bg-white/90 text-slate-900"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Assurance (EUR)</Label>
                      <Input
                        value={insurance}
                        onChange={(e) => setInsurance(e.target.value)}
                        type="number"
                        className="border-white/20 bg-white/90 text-slate-900"
                      />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <Button onClick={handleEstimate} disabled={loading} className="w-full">
              {loading ? "Calcul en cours..." : "Calculer mon contrôle export"}
            </Button>
            <p className="text-xs text-slate-200">
              Résultat immédiat, sans email. L'email sert uniquement a recevoir le PDF et activer la veille.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="mt-12 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <Card className="border border-white/15 bg-white/10 text-white backdrop-blur-xl">
          <CardContent className="p-7 md:p-8">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-slate-200">Résumé</div>
                <div className="text-2xl font-semibold md:text-3xl">Estimation & conformité</div>
              </div>
              <div className="text-xs text-slate-200">Dernière mise à jour: {formatDateTimeFr(result?.updatedAt)}</div>
            </div>
            {!result ? (
              <p className="mt-4 text-sm text-slate-200">Saisis un HS ou produit pour obtenir un résumé.</p>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-white/15 bg-white/5 p-3">
                    <div className="text-xs text-slate-200">Droits estimés</div>
                    <div className="text-lg font-semibold text-white">{result.estimate.duty.toFixed(0)} {result.estimate.currency}</div>
                  </div>
                  <div className="rounded-xl border border-white/15 bg-white/5 p-3">
                    <div className="text-xs text-slate-200">Taxes estimées</div>
                    <div className="text-lg font-semibold text-white">{result.estimate.taxes.toFixed(0)} {result.estimate.currency}</div>
                  </div>
                  <div className="rounded-xl bg-white/20 p-3 text-white">
                    <div className="text-xs text-slate-100">Total estimé</div>
                    <div className="text-lg font-semibold">{result.estimate.total.toFixed(0)} {result.estimate.currency}</div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase text-slate-200">Documents requis</div>
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-200">
                      {result.documents.map((doc) => (
                        <li key={doc}>{doc}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-slate-200">Risques</div>
                    <ul className="mt-2 space-y-2 text-sm text-slate-100">
                      {result.risks.map((risk) => (
                        <li key={risk.title} className="rounded-lg border border-white/15 bg-white/5 p-2">
                          <div className="font-semibold text-white">{risk.title}</div>
                          <div className="text-slate-200">{risk.message}</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="rounded-xl border border-white/15 bg-white/5 p-3 text-xs text-slate-200">
                  Confiance: {result.confidence} - Sources: {result.sources?.join(", ") || "Règles internes"}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-white/15 bg-white/10 text-white backdrop-blur-xl">
          <CardContent className="space-y-4 p-7 md:p-8">
            <div className="text-sm font-semibold">Recevoir le rapport PDF + veille</div>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email professionnel"
              className="border-white/20 bg-white/90 text-slate-900 placeholder:text-slate-500"
            />
            <label className="flex items-start gap-2 text-xs text-slate-200">
              <Checkbox checked={consent} onCheckedChange={(v) => setConsent(Boolean(v))} />
              <span>J'accepte de recevoir la veille MPL (RGPD).</span>
            </label>
            <Button onClick={handleLead} disabled={loading} className="w-full">
              {loading ? "Génération..." : "Recevoir le rapport PDF"}
            </Button>

            <div className="pt-2">
              <div className="text-xs uppercase text-slate-200">Historique</div>
              {history.length === 0 ? (
                <div className="text-sm text-slate-200">Aucune simulation recente.</div>
              ) : (
                <div className="space-y-2">
                  {history.map((entry, idx) => (
                    <div key={idx} className="rounded-lg border border-white/15 bg-white/5 p-2 text-xs">
                      <div className="font-semibold text-white">{entry.payload?.destinationIso2 || "Pays"} - HS {entry.payload?.hsInput || "n/a"}</div>
                      <div className="text-slate-200">{entry.payload?.value || 0} {entry.payload?.currency || "EUR"}</div>
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => reuseHistory(entry)}>Réutiliser</Button>
                        <Button size="sm" onClick={() => downloadHistoryReport(entry)}>PDF</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-10 grid gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-white/15 bg-white/10 p-6 text-white backdrop-blur-xl">
          <div className="text-xs uppercase tracking-[0.24em] text-blue-200">Ce que vous obtenez</div>
          <ul className="mt-4 list-disc space-y-2 pl-4 text-sm text-slate-200">
            <li>Estimation droits & taxes</li>
            <li>Documents requis par pays</li>
            <li>Risques sanctions & conformité</li>
            <li>Rapport PDF brand MPL</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-white/15 bg-white/10 p-6 text-white backdrop-blur-xl">
          <div className="text-xs uppercase tracking-[0.24em] text-blue-200">Comment ça marche</div>
          <ol className="mt-4 space-y-2 text-sm text-slate-200">
            <li>1. Saisis HS ou produit + pays</li>
            <li>2. Obtiens estimation & alertes</li>
            <li>3. Reçois le rapport PDF</li>
          </ol>
        </div>
        <div className="rounded-2xl border border-white/15 bg-white/10 p-6 text-white backdrop-blur-xl">
          <div className="text-xs uppercase tracking-[0.24em] text-blue-200">Centre veille</div>
          <p className="mt-4 text-sm text-slate-200">
            Signaux sanctions, documents & taxes. Personnalise les pays et HS suivis pour recevoir la veille.
          </p>
          <Button className="mt-4" variant="outline" onClick={() => navigate("/app/centre-veille")}>
            Voir la veille
          </Button>
        </div>
      </section>

      <section className="mt-10 flex flex-col items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-gradient-to-r from-blue-700 via-blue-900 to-red-600 p-6 text-white md:flex-row md:items-center">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-white/70">Besoin d'une validation ?</div>
          <div className="text-2xl font-semibold">Demandez un audit complet ou une validation express.</div>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => navigate("/contact?offer=express")}>Validation express</Button>
          <Button variant="outline" className="border-white text-white hover:bg-white/10" onClick={() => navigate("/newsletter")}>
            Recevoir la veille
          </Button>
        </div>
      </section>
    </PublicLayout>
  );
}
