import * as React from "react";
import { useNavigate } from "react-router-dom";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { postLead, postPdf } from "@/lib/leadMagnetApi";
import { useToast } from "@/hooks/use-toast";

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
  { label: "United States", iso2: "US" },
  { label: "Germany", iso2: "DE" },
  { label: "Spain", iso2: "ES" },
  { label: "United Kingdom", iso2: "GB" },
  { label: "China", iso2: "CN" },
  { label: "Canada", iso2: "CA" },
  { label: "Morocco", iso2: "MA" },
  { label: "UAE", iso2: "AE" },
  { label: "Japan", iso2: "JP" },
  { label: "India", iso2: "IN" },
];

const SOURCES = [
  "OFAC Sanctions List Service",
  "ONU Consolidated List",
  "EU Sanctions Map",
  "WITS / UNCTAD TRAINS",
];

export default function LeadMagnet() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [productText, setProductText] = React.useState("");
  const [hsInput, setHsInput] = React.useState("");
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

  const hsNormalized = hsInput.replace(/[^0-9]/g, "");
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
    if (!productText.trim() && hsNormalized.length < 2) {
      toast({ title: "Saisie requise", description: "Saisis un produit ou un code HS (2-6 chiffres)." });
      return;
    }
    if (!destinationIso2) {
      toast({ title: "Pays requis", description: "Selectionne un pays de destination." });
      return;
    }

    try {
      setLoading(true);
      const payload = {
        hsInput: hsNormalized || undefined,
        productText: productText.trim() || undefined,
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
          hsInput: hsNormalized,
          productText,
          destinationIso2,
          incoterm,
          value,
          currency,
          mode,
        },
      });

      localStorage.setItem("mpl_lead_email", trimmedEmail);

      const pdfBlob = await postPdf({
        title: "Rapport de controle export",
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

      toast({ title: "Rapport genere", description: "Le PDF est telecharge." });
      navigate("/control-tower");
    } catch (err: any) {
      toast({ title: "Erreur lead", description: err?.message || "Impossible de finaliser." });
    } finally {
      setLoading(false);
    }
  };

  const reuseHistory = (entry: { payload: any; result: BriefResponse }) => {
    const p = entry.payload || {};
    setProductText(p.productText || "");
    setHsInput(p.hsInput || "");
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
        title: "Rapport de controle export",
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
      toast({ title: "Erreur PDF", description: err?.message || "Impossible de generer le rapport." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <BrandLogo imageClassName="h-9" titleClassName="text-base font-semibold" subtitleClassName="text-xs" />
          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-600">
            <button type="button">Solutions</button>
            <button type="button">Veille</button>
            <button type="button">Ressources</button>
            <button type="button">Tarifs</button>
          </nav>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => navigate("/watch")}>Centre veille</Button>
            <Button onClick={() => navigate("/invoice-check")}>Validation express</Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Audit • Reglementation • Veille</p>
            <h1 className="text-4xl md:text-5xl font-semibold leading-tight text-slate-900">
              Votre controle export en 30 secondes.
            </h1>
            <p className="text-lg text-slate-600">
              Estimation immediate des droits/taxes, documents et risques sanctions. Rapport PDF MPL + veille personnalisee.
            </p>
            <div className="flex flex-wrap gap-2">
              {HS_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setHsInput(chip)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm"
                >
                  HS {chip}
                </button>
              ))}
            </div>
          </div>

          <Card className="border border-slate-200 bg-white shadow-xl">
            <CardContent className="space-y-4 p-6">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Produit (texte libre)</Label>
                  <Input value={productText} onChange={(e) => setProductText(e.target.value)} placeholder="Ex: cosmetique, piece auto" />
                </div>
                <div className="space-y-2">
                  <Label>HS code</Label>
                  <Input value={hsInput} onChange={(e) => setHsInput(e.target.value)} placeholder="Ex: 3004" list="hs-list" />
                  <datalist id="hs-list">
                    {hsOptions.map((code) => (
                      <option key={code} value={code} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-2">
                  <Label>Destination</Label>
                  <Select
                    value={destinationIso2}
                    onValueChange={(val) => {
                      setDestinationIso2(val);
                      setDestinationLabel(COUNTRIES.find((c) => c.iso2 === val)?.label || val);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selectionner un pays" />
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
                  <Input value={value} onChange={(e) => setValue(e.target.value)} type="number" />
                </div>
                <div className="space-y-2">
                  <Label>Devise</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger>
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
                  <Label>Incoterm</Label>
                  <Select value={incoterm} onValueChange={setIncoterm}>
                    <SelectTrigger>
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
                <div className="space-y-2">
                  <Label>Mode transport</Label>
                  <Select value={mode} onValueChange={setMode}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="air">Air</SelectItem>
                      <SelectItem value="sea">Sea</SelectItem>
                      <SelectItem value="road">Road</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Poids (kg) option</Label>
                  <Input value={weightKg} onChange={(e) => setWeightKg(e.target.value)} type="number" />
                </div>
                <div className="space-y-2">
                  <Label>Assurance (EUR) option</Label>
                  <Input value={insurance} onChange={(e) => setInsurance(e.target.value)} type="number" />
                </div>
              </div>

              <Button onClick={handleEstimate} disabled={loading} className="w-full">
                {loading ? "Calcul en cours..." : "Calculer mon controle export"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <Card className="border border-slate-200 bg-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.25em] text-slate-400">Resume</div>
                  <div className="text-2xl font-semibold">Estimation & conformite</div>
                </div>
                <div className="text-xs text-slate-500">Maj: {result?.updatedAt ? new Date(result.updatedAt).toLocaleDateString("fr-FR") : "—"}</div>
              </div>
              {!result ? (
                <p className="mt-4 text-sm text-slate-500">Saisis un HS ou produit pour obtenir un resume.</p>
              ) : (
                <div className="mt-5 space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-slate-200 p-3">
                      <div className="text-xs text-slate-500">Duty estime</div>
                      <div className="text-lg font-semibold">{result.estimate.duty.toFixed(0)} {result.estimate.currency}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <div className="text-xs text-slate-500">Taxes estimees</div>
                      <div className="text-lg font-semibold">{result.estimate.taxes.toFixed(0)} {result.estimate.currency}</div>
                    </div>
                    <div className="rounded-xl bg-slate-900 text-white p-3">
                      <div className="text-xs text-slate-200">Total estime</div>
                      <div className="text-lg font-semibold">{result.estimate.total.toFixed(0)} {result.estimate.currency}</div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <div className="text-xs uppercase text-slate-400">Docs requis</div>
                      <ul className="mt-2 space-y-1 text-sm">
                        {result.documents.map((doc) => (
                          <li key={doc}>• {doc}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-slate-400">Risques</div>
                      <ul className="mt-2 space-y-2 text-sm">
                        {result.risks.map((risk) => (
                          <li key={risk.title} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                            <div className="font-semibold">{risk.title}</div>
                            <div className="text-slate-600">{risk.message}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white">
            <CardContent className="p-6 space-y-4">
              <div className="text-sm font-semibold">Recevoir le rapport PDF + veille</div>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email professionnel" />
              <label className="flex items-start gap-2 text-xs text-slate-600">
                <Checkbox checked={consent} onCheckedChange={(v) => setConsent(Boolean(v))} />
                <span>J'accepte de recevoir la veille MPL (RGPD).</span>
              </label>
              <Button onClick={handleLead} disabled={loading} className="w-full">
                {loading ? "Generation..." : "Recevoir le rapport PDF"}
              </Button>

              <div className="pt-2">
                <div className="text-xs uppercase text-slate-400">Historique</div>
                {history.length === 0 ? (
                  <div className="text-sm text-slate-500">Aucune simulation recente.</div>
                ) : (
                  <div className="space-y-2">
                    {history.map((entry, idx) => (
                      <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
                        <div className="font-semibold">{entry.payload?.destinationIso2 || "Pays"} • HS {entry.payload?.hsInput || "n/a"}</div>
                        <div className="text-slate-600">{entry.payload?.value || 0} {entry.payload?.currency || "EUR"}</div>
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => reuseHistory(entry)}>Reutiliser</Button>
                          <Button size="sm" onClick={() => downloadHistoryReport(entry)}>PDF</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="bg-white border-t border-slate-200">
        <div className="mx-auto max-w-6xl px-6 py-10 grid gap-6 md:grid-cols-3">
          <div>
            <div className="text-xs uppercase text-slate-400">Sources officielles</div>
            <ul className="mt-3 text-sm text-slate-600 space-y-1">
              {SOURCES.map((src) => (
                <li key={src}>• {src}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-400">Ce que vous obtenez</div>
            <ul className="mt-3 text-sm text-slate-600 space-y-1">
              <li>• Estimation duties & taxes</li>
              <li>• Documents requis par pays</li>
              <li>• Risques sanctions & compliance</li>
            </ul>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-400">CTA conseil</div>
            <p className="mt-3 text-sm text-slate-600">Besoin d'une validation rapide ? 15 minutes avec un consultant export.</p>
            <Button className="mt-3" onClick={() => navigate("/invoice-check")}>Demander une validation</Button>
          </div>
        </div>
      </section>
    </div>
  );
}
