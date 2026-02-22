import * as React from "react";
import { useNavigate } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/contexts/LanguageContext";
import { countryFunnel, exportAnswer, hsFunnel, tradeBilateral } from "@/services/supabaseAI";
import type { CountrySuggestion, ExportAnswerResult, HsSuggestion, ScreeningResult, TradeBilateralResult } from "@/types/supabaseAI";
import { ExportAnswerPanel } from "@/components/ExportAnswerPanel";
import { TradePanel } from "@/components/TradePanel";
import { SanctionsScreening } from "@/components/SanctionsScreening";
import { CountryPicker } from "@/components/CountryPicker";
import { HsPicker } from "@/components/HsPicker";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Mode = "export" | "import" | null;

export function WizardEntry() {
  const { lang } = useI18n();
  const navigate = useNavigate();
  const [mode, setMode] = React.useState<Mode>(null);
  const [isExporter, setIsExporter] = React.useState<boolean | null>(null);
  const [question, setQuestion] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [country, setCountry] = React.useState<CountrySuggestion | null>(null);
  const [hs, setHs] = React.useState<HsSuggestion | null>(null);
  const [exportData, setExportData] = React.useState<ExportAnswerResult | null>(null);
  const [tradeData, setTradeData] = React.useState<TradeBilateralResult | null>(null);
  const [partyName, setPartyName] = React.useState("");
  const [screening, setScreening] = React.useState<ScreeningResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [countryOptions, setCountryOptions] = React.useState<CountrySuggestion[]>([]);
  const [hsOptions, setHsOptions] = React.useState<HsSuggestion[]>([]);

  const essentials =
    lang === "fr"
      ? [
          "Pays + produit (HS) = la base des règles",
          "Screening sanctions = réflexe n°1",
          "Docs & contrôles = varient selon pays/HS",
        ]
      : [
          "Country + product (HS) are the base of compliance",
          "Sanctions screening is rule #1",
          "Docs & controls vary by country/HS",
        ];

  const analyzeQuestion = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const [countryRes, hsRes] = await Promise.all([countryFunnel(question, lang), hsFunnel(question, lang)]);
      const chosenCountry = countryRes.suggestions[0] ?? null;
      const chosenHs = hsRes.suggestions[0] ?? null;
      setCountryOptions(countryRes.suggestions);
      setHsOptions(hsRes.suggestions);
      setCountry(chosenCountry);
      setHs(chosenHs);

      if (chosenCountry && chosenHs) {
        const [answer, trade] = await Promise.all([
          exportAnswer(chosenCountry.iso2, chosenHs.hs_code, lang),
          tradeBilateral("FR", chosenCountry.iso2, new Date().getFullYear(), "exports"),
          tradeBilateral("FR", chosenCountry.iso2, new Date().getFullYear() - 1, "export"),
        ]);
        setExportData(answer);
        setTradeData(trade);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{lang === "fr" ? "Bonjour 👋 Vous êtes plutôt :" : "Hi 👋 Are you:"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button variant={mode === "export" ? "default" : "outline"} onClick={() => setMode("export")}>
            {lang === "fr" ? "Exporter" : "Exporting"}
          </Button>
          <Button variant={mode === "import" ? "default" : "outline"} onClick={() => setMode("import")}>
            {lang === "fr" ? "Importer" : "Importing"}
          </Button>
        </div>

        {mode === "export" ? (
          <div className="space-y-3 rounded-md border p-3 text-sm">
            <ul className="list-disc space-y-1 pl-6">
              {essentials.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p>{lang === "fr" ? "Vous exportez déjà ?" : "Do you already export?"}</p>
            <div className="flex gap-2">
              <Button variant={isExporter === true ? "default" : "outline"} onClick={() => setIsExporter(true)}>
                {lang === "fr" ? "Oui" : "Yes"}
              </Button>
              <Button variant={isExporter === false ? "default" : "outline"} onClick={() => setIsExporter(false)}>
                {lang === "fr" ? "Non" : "No"}
              </Button>
            </div>
            {isExporter === true ? (
              <div className="space-y-2 rounded-md bg-muted p-3">
                <p>{lang === "fr" ? "Parfait. Notre Tour de contrôle vous aide à :" : "Great. Our Control Tower helps you with:"}</p>
                <ul className="list-disc pl-6">
                  <li>HS + pays auto-detect</li>
                  <li>Conformité + liens officiels</li>
                  <li>Screening sanctions + snapshot trade</li>
                </ul>
                <Button onClick={() => navigate("/control-tower", { state: { mode: "export", questionText: question } })}>
                  {lang === "fr" ? "Ouvrir la Tour de contrôle" : "Open Control Tower"}
                </Button>
              </div>
            ) : null}
            {isExporter === false ? (
              <div className="space-y-2 rounded-md bg-muted p-3">
                <p>
                  {lang === "fr"
                    ? "On vous guide pas à pas : décrivez produit + destination, on propose HS + règles."
                    : "We guide you step-by-step: describe product + destination, and we suggest HS + compliance rules."}
                </p>
                <Button onClick={() => navigate("/control-tower", { state: { mode: "export", questionText: question } })}>
                  {lang === "fr" ? "Démarrer un diagnostic" : "Start diagnostics"}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {mode === "import" ? (
          <div className="space-y-3 rounded-md border p-3 text-sm">
            <p>{lang === "fr" ? "Très bien. Pour acheter à l’étranger, on vous aide à :" : "Great. For imports, we help you:"}</p>
            <ul className="list-disc pl-6">
              <li>{lang === "fr" ? "Vérifier restrictions / sanctions / exigences produit" : "Check restrictions / sanctions / product requirements"}</li>
              <li>{lang === "fr" ? "Estimer les risques conformité" : "Estimate compliance risks"}</li>
              <li>{lang === "fr" ? "Préparer une checklist documents" : "Prepare a document checklist"}</li>
            </ul>
            <p className="font-medium">{lang === "fr" ? "Votre pays de livraison ?" : "Your delivery country?"}</p>
            <CountryPicker value={country} onSelect={setCountry} />
            <Button onClick={() => navigate("/control-tower", { state: { mode: "import", questionText: question } })}>
              {lang === "fr" ? "Démarrer un diagnostic" : "Start diagnostics"}
            </Button>
          </div>
        ) : null}

        <div className="space-y-2 rounded-md border p-3">
          <p className="font-medium">{lang === "fr" ? "Avez-vous une question spécifique ?" : "Do you have a specific question?"}</p>
          <Textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={
              lang === "fr"
                ? "Ex: ‘J’exporte des fraises au Chili’, ‘Je veux acheter des pièces auto en Corée’…"
                : "E.g. ‘I export strawberries to Chile’, ‘I want to buy auto parts in Korea’…"
            }
          />
          <Button onClick={analyzeQuestion} disabled={loading || !question.trim()}>
            {loading ? "..." : lang === "fr" ? "Analyser ma question" : "Analyze my question"}
          </Button>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          {country || hs ? (
            <p className="text-xs text-muted-foreground">
              {country ? `${country.label} (${country.iso2})` : "?"} · {hs ? `${hs.hs_code}` : "?"}
            </p>
          ) : null}

          {(countryOptions.length > 1 || hsOptions.length > 1) && (
            <Alert>
              <AlertDescription className="space-y-3">
                <p>{lang === "fr" ? "J’ai une ambiguïté, pouvez-vous confirmer ?" : "I detected ambiguity, can you confirm?"}</p>
                {countryOptions.length > 1 ? (
                  <div>
                    <p className="mb-1 text-xs font-medium">{lang === "fr" ? "Pays possibles" : "Possible countries"}</p>
                    <div className="flex flex-wrap gap-2">
                      {countryOptions.slice(0, 3).map((item) => (
                        <Button key={`${item.iso2}-${item.label}`} type="button" variant="outline" size="sm" onClick={() => setCountry(item)}>
                          {item.label} ({item.iso2})
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {hsOptions.length > 1 ? (
                  <div>
                    <p className="mb-1 text-xs font-medium">{lang === "fr" ? "Produits possibles" : "Possible products"}</p>
                    <div className="flex flex-wrap gap-2">
                      {hsOptions.slice(0, 3).map((item) => (
                        <Button key={`${item.hs_code}-${item.label}`} type="button" variant="outline" size="sm" onClick={() => setHs(item)}>
                          {item.hs_code}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </AlertDescription>
            </Alert>
          )}

          {(countryOptions.length > 1 || hsOptions.length > 1) && mode === "export" ? (
            <div className="space-y-2 rounded-md border p-3">
              <p className="text-xs font-medium">{lang === "fr" ? "Affiner (optionnel)" : "Refine (optional)"}</p>
              <CountryPicker value={country} onSelect={setCountry} />
              <HsPicker value={hs} onSelect={setHs} />
            </div>
          ) : null}
        </div>

        <ExportAnswerPanel data={exportData} />
        <TradePanel data={tradeData} />
        <SanctionsScreening value={partyName} onValueChange={setPartyName} result={screening} onResult={setScreening} />
      </CardContent>
    </Card>
  );
}
