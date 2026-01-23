import * as React from "react";
import { useNavigate } from "react-router-dom";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { postEstimate, postLead, postPdf, type EstimateResponse } from "@/lib/leadMagnetApi";
import { useToast } from "@/hooks/use-toast";

const HS_CHIPS = ["3004", "8708", "2204", "3304", "9403", "8504"];
const COUNTRIES = ["United States", "Germany", "Spain", "United Kingdom", "China", "Canada", "UAE", "Japan", "India", "Brazil"];

const SOURCES = [
  "Access2Markets (EU)",
  "WCO / HS Nomenclature",
  "WITS / UNCTAD TRAINS",
  "Sanctions lists (UE/ONU/OFAC)",
];

export default function LeadMagnet() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [productText, setProductText] = React.useState("");
  const [hsInput, setHsInput] = React.useState("");
  const [destination, setDestination] = React.useState("");
  const [value, setValue] = React.useState("10000");
  const [currency, setCurrency] = React.useState("EUR");
  const [incoterm, setIncoterm] = React.useState("DAP");
  const [transportMode, setTransportMode] = React.useState("sea");
  const [weightKg, setWeightKg] = React.useState("");
  const [insurance, setInsurance] = React.useState("");
  const [consent, setConsent] = React.useState(false);
  const [email, setEmail] = React.useState("");

  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<EstimateResponse | null>(null);
  const [simulationId, setSimulationId] = React.useState<string | null>(null);
  const [history, setHistory] = React.useState<Array<{ payload: any; result: EstimateResponse }>>([]);

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
    if (!destination.trim()) {
      toast({ title: "Pays requis", description: "Indique le pays de destination." });
      return;
    }

    try {
      setLoading(true);
      const payload = {
        productText: productText.trim() || undefined,
        hsInput: hsNormalized || undefined,
        destination: destination.trim(),
        incoterm,
        value: Number(value || 0),
        currency,
        transportMode,
        weightKg: weightKg ? Number(weightKg) : null,
        insurance: insurance ? Number(insurance) : null,
      };
      const res = await postEstimate(payload);
      setResult(res);
      setSimulationId(res.simulationId || null);
      const entry = { payload, result: res };
      const nextHistory = [entry, ...history].slice(0, 6);
      setHistory((prev) => [entry, ...prev].slice(0, 6));
      localStorage.setItem("mpl_last_simulation", JSON.stringify(entry));
      localStorage.setItem("mpl_sim_history", JSON.stringify(nextHistory));
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
        simulationId,
        metadata: {
          productText,
          hsInput: hsNormalized,
          destination,
          incoterm,
          value,
          currency,
          transportMode,
        },
      });

      localStorage.setItem("mpl_lead_email", trimmedEmail);

      const pdfBlob = await postPdf({
        title: "Rapport de controle export",
        email: trimmedEmail,
        destination,
        incoterm,
        value,
        currency,
        result,
      });
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `mpl-rapport-export-${Date.now()}.pdf`;
      link.click();
      URL.revokeObjectURL(url);

      toast({ title: "Rapport genere", description: "Le PDF est telecharge. Ouverture de la Control Tower." });
      navigate("/control-tower");
    } catch (err: any) {
      toast({ title: "Erreur lead", description: err?.message || "Impossible de finaliser." });
    } finally {
      setLoading(false);
    }
  };

  const reuseHistory = (entry: { payload: any; result: EstimateResponse }) => {
    const p = entry.payload || {};
    setProductText(p.productText || "");
    setHsInput(p.hsInput || "");
    setDestination(p.destination || "");
    setValue(String(p.value || ""));
    setCurrency(p.currency || "EUR");
    setIncoterm(p.incoterm || "DAP");
    setTransportMode(p.transportMode || "sea");
    setWeightKg(p.weightKg ? String(p.weightKg) : "");
    setInsurance(p.insurance ? String(p.insurance) : "");
    setResult(entry.result);
  };

  const downloadHistoryReport = async (entry: { payload: any; result: EstimateResponse }) => {
    try {
      setLoading(true);
      const pdfBlob = await postPdf({
        title: "Rapport de controle export",
        destination: entry.payload?.destination,
        incoterm: entry.payload?.incoterm,
        value: entry.payload?.value,
        currency: entry.payload?.currency,
        result: entry.result,
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
    <div className="min-h-screen bg-[#f6f7fb] text-slate-900" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_#dbeafe_0%,_transparent_65%)]" />
        <div className="absolute inset-y-0 right-0 w-1/3 bg-[linear-gradient(180deg,_#bfdbfe_0%,_#fecaca_70%)] opacity-60" />

        <header className="relative z-10 flex items-center justify-between px-6 py-6 md:px-12">
          <BrandLogo imageClassName="h-10" titleClassName="text-lg font-semibold" subtitleClassName="text-sm" />
          <div className="flex items-center gap-3 text-sm">
            <Button variant="ghost" onClick={() => navigate("/newsletter")}>Newsletter</Button>
            <Button variant="outline" onClick={() => navigate("/login")}>Connexion</Button>
          </div>
        </header>

        <section className="relative z-10 px-6 pb-16 md:px-12">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] items-start">
            <div className="space-y-6">
              <p className="uppercase tracking-[0.32em] text-xs text-slate-500">Audit • Reglementation • Veille</p>
              <h1 className="text-4xl md:text-5xl font-semibold leading-tight" style={{ fontFamily: "Newsreader, serif" }}>
                Votre controle export en 30 secondes.
              </h1>
              <p className="text-lg text-slate-600 max-w-2xl">
                Estimation immediate des taxes, documents et risques pour vos exports FR ? Monde.
                Obtenez un rapport PDF MPL et activez la veille concurrentielle par pays et HS.
              </p>

              <div className="flex flex-wrap gap-2">
                {HS_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setHsInput(chip)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm hover:border-slate-300"
                  >
                    HS {chip}
                  </button>
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Produit (texte libre)</Label>
                  <Input value={productText} onChange={(e) => setProductText(e.target.value)} placeholder="Ex: cosmetique, piece auto..." />
                </div>
                <div className="space-y-2">
                  <Label>HS code (2/4/6 chiffres)</Label>
                  <Input value={hsInput} onChange={(e) => setHsInput(e.target.value)} placeholder="Ex: 3004" list="hs-list" />
                  <datalist id="hs-list">
                    {hsOptions.map((code) => (
                      <option key={code} value={code} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-2">
                  <Label>Pays destination</Label>
                  <Input list="country-list" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Ex: United States" />
                  <datalist id="country-list">
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-2">
                  <Label>Valeur marchandise</Label>
                  <Input value={value} onChange={(e) => setValue(e.target.value)} type="number" />
                </div>
                <div className="space-y-2">
                  <Label>Devise</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger>
                      <SelectValue placeholder="EUR" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                      <SelectItem value="CHF">CHF</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Incoterm</Label>
                  <Select value={incoterm} onValueChange={setIncoterm}>
                    <SelectTrigger>
                      <SelectValue placeholder="DAP" />
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
                  <Select value={transportMode} onValueChange={setTransportMode}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sea" />
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

              <div className="flex flex-wrap gap-3">
                <Button onClick={handleEstimate} disabled={loading} className="h-11 px-6">
                  {loading ? "Calcul en cours..." : "Calculer mon controle export"}
                </Button>
                <Button variant="outline" onClick={() => navigate("/invoice-check")}>Verifier une facture</Button>
              </div>
            </div>

            <Card className="border border-slate-200 bg-white/80 shadow-xl">
              <CardContent className="space-y-6 p-6">
                <div className="space-y-2">
                  <p className="text-sm text-slate-500">Resultat immediat</p>
                  <h2 className="text-2xl font-semibold" style={{ fontFamily: "Newsreader, serif" }}>
                    Estimation landed cost
                  </h2>
                </div>

                {!result ? (
                  <div className="space-y-2 text-sm text-slate-500">
                    <p>Saisis un HS ou un produit puis lance le calcul.</p>
                    <p>Essayez avec HS 3004 vers United States.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="text-xs text-slate-500">Duty estime</div>
                        <div className="text-lg font-semibold">{result.landedCost.duty.toFixed(0)} {result.landedCost.currency}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="text-xs text-slate-500">Taxes estimees</div>
                        <div className="text-lg font-semibold">{result.landedCost.taxes.toFixed(0)} {result.landedCost.currency}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-900 text-white p-3">
                        <div className="text-xs text-slate-200">Total estime</div>
                        <div className="text-lg font-semibold">{result.landedCost.total.toFixed(0)} {result.landedCost.currency}</div>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-400">Documents cles</div>
                      <ul className="mt-2 space-y-1 text-sm">
                        {result.docs.map((doc) => (
                          <li key={doc} className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                            {doc}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-400">Alertes risques</div>
                      <ul className="mt-2 space-y-2">
                        {result.risks.map((risk) => (
                          <li key={risk.title} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm">
                            <div className="font-semibold">{risk.title}</div>
                            <div className="text-slate-600">{risk.message}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                  <div className="text-sm font-semibold">Recevoir le rapport PDF + la veille</div>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email professionnel" />
                  <label className="flex items-start gap-2 text-xs text-slate-600">
                    <Checkbox checked={consent} onCheckedChange={(v) => setConsent(Boolean(v))} />
                    <span>J'accepte de recevoir la veille MPL (RGPD). Desinscription a tout moment.</span>
                  </label>
                  <Button onClick={handleLead} disabled={loading} className="w-full">
                    {loading ? "Generation..." : "Recevoir le rapport PDF"}
                  </Button>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                  <div className="text-sm font-semibold">Historique des simulations</div>
                  {history.length === 0 ? (
                    <p className="text-sm text-slate-500">Aucune simulation recente.</p>
                  ) : (
                    <div className="space-y-2">
                      {history.map((entry, idx) => (
                        <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
                          <div className="font-semibold">
                            {entry.payload?.destination || "Destination"} • HS {entry.payload?.hsInput || "n/a"}
                          </div>
                          <div className="text-slate-600">
                            {entry.payload?.value || 0} {entry.payload?.currency || "EUR"} • {entry.payload?.incoterm || "DAP"}
                          </div>
                          <div className="mt-2 flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => reuseHistory(entry)}>
                              Reutiliser
                            </Button>
                            <Button size="sm" onClick={() => downloadHistoryReport(entry)}>
                              PDF
                            </Button>
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
      </div>

      <section className="px-6 pb-20 md:px-12">
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="border border-slate-200">
            <CardContent className="p-5">
              <div className="text-sm uppercase text-slate-400">Sources officielles</div>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                {SOURCES.map((src) => (
                  <li key={src}>• {src}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card className="border border-slate-200">
            <CardContent className="p-5">
              <div className="text-sm uppercase text-slate-400">Derniere mise a jour</div>
              <div className="mt-3 text-2xl font-semibold">{new Date().toLocaleDateString("fr-FR")}</div>
              <p className="mt-2 text-sm text-slate-600">Donnees mock en version MVP.</p>
            </CardContent>
          </Card>
          <Card className="border border-slate-200">
            <CardContent className="p-5">
              <div className="text-sm uppercase text-slate-400">Disclaimer</div>
              <p className="mt-3 text-sm text-slate-600">
                Estimation indicative. A valider avec les sources officielles et votre declarant en douane.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}





