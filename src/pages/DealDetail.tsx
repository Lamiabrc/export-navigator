import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Save, ShieldCheck } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/contexts/LanguageContext";
import { COUNTRIES, getCountryLabel } from "@/lib/constants";
import { dealComplianceCheck, type DealComplianceOutput } from "@/services/dealComplianceCheck";
import { dealStageOrder, getDealDetail, updateDeal, type CrmDeal, type DealStage } from "@/services/crm";

type DealFormState = {
  title: string;
  stage: DealStage;
  amount: string;
  currency: string;
  probability: string;
  from_country: string;
  to_country: string;
  product_text: string;
  incoterm: string;
  notes: string;
};

function stageLabel(stage: DealStage, lang: "fr" | "en") {
  const map: Record<DealStage, { fr: string; en: string }> = {
    new: { fr: "Nouveau", en: "New" },
    qualified: { fr: "Qualifie", en: "Qualified" },
    proposal: { fr: "Proposition", en: "Proposal" },
    negotiation: { fr: "Negociation", en: "Negotiation" },
    won: { fr: "Gagne", en: "Won" },
    lost: { fr: "Perdu", en: "Lost" },
  };
  return map[stage][lang];
}

function decisionBadge(decision: DealComplianceOutput["decision"]) {
  if (decision === "GO") return "bg-emerald-100 text-emerald-900 border-emerald-200";
  if (decision === "NO_GO") return "bg-rose-100 text-rose-900 border-rose-200";
  return "bg-amber-100 text-amber-900 border-amber-200";
}

function toFormState(deal: CrmDeal): DealFormState {
  return {
    title: deal.title || "",
    stage: deal.stage,
    amount: String(deal.amount || ""),
    currency: deal.currency || "EUR",
    probability: String(deal.probability || 0),
    from_country: deal.from_country || "FR",
    to_country: deal.to_country || "",
    product_text: deal.product_text || "",
    incoterm: deal.incoterm || "",
    notes: deal.notes || "",
  };
}

export default function DealDetail() {
  const { dealId = "" } = useParams();
  const { lang } = useI18n();
  const uiLang = lang === "en" ? "en" : "fr";

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [deal, setDeal] = React.useState<CrmDeal | null>(null);
  const [form, setForm] = React.useState<DealFormState | null>(null);
  const [result, setResult] = React.useState<DealComplianceOutput | null>(null);

  const copy = React.useMemo(
    () =>
      uiLang === "en"
        ? {
            back: "Back to pipeline",
            summary: "Deal summary",
            save: "Save",
            secure: "Secure deal",
            checkTitle: "Security check output",
            missing: "Missing",
            checklist: "Checklist",
            risks: "Risks",
            actions: "Actions",
            question: "Priority question",
            hs: "HS assist",
            countryRules: "Country rules (if available)",
          }
        : {
            back: "Retour pipeline",
            summary: "Resume du deal",
            save: "Enregistrer",
            secure: "Securiser le deal",
            checkTitle: "Resultat securisation",
            missing: "Manquant",
            checklist: "Checklist",
            risks: "Risques",
            actions: "Actions",
            question: "Question prioritaire",
            hs: "Assistant HS",
            countryRules: "Regles pays (si disponibles)",
          },
    [uiLang]
  );

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const detail = await getDealDetail(dealId);
      setDeal(detail.deal);
      if (detail.deal) {
        const state = toFormState(detail.deal);
        setForm(state);
        const immediate = dealComplianceCheck({
          lang: uiLang,
          fromCountry: state.from_country,
          toCountry: state.to_country,
          productText: state.product_text,
          value: Number(state.amount || 0),
          currency: state.currency,
          incoterm: state.incoterm,
        });
        setResult(immediate);
      } else {
        setForm(null);
      }
    } catch (err) {
      setError((err as Error)?.message || "Load error");
    } finally {
      setLoading(false);
    }
  }, [dealId, uiLang]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!form || !deal) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateDeal(deal.id, {
        title: form.title.trim(),
        stage: form.stage,
        amount: Number(form.amount || 0),
        currency: form.currency || "EUR",
        probability: Number(form.probability || 0),
        from_country: form.from_country || "FR",
        to_country: form.to_country || null,
        product_text: form.product_text || null,
        incoterm: form.incoterm || null,
        notes: form.notes || null,
      });
      if (updated) {
        setDeal(updated);
      }
    } catch (err) {
      setError((err as Error)?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const secureDeal = () => {
    if (!form) return;
    const output = dealComplianceCheck({
      lang: uiLang,
      fromCountry: form.from_country,
      toCountry: form.to_country,
      productText: form.product_text,
      value: Number(form.amount || 0),
      currency: form.currency,
      incoterm: form.incoterm,
    });
    setResult(output);
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild>
            <Link to="/app/deals">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {copy.back}
            </Link>
          </Button>
        </div>

        {loading ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              {uiLang === "en" ? "Loading deal..." : "Chargement du deal..."}
            </CardContent>
          </Card>
        ) : null}

        {!loading && !deal ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              {uiLang === "en" ? "Deal not found." : "Deal introuvable."}
            </CardContent>
          </Card>
        ) : null}

        {!loading && deal && form ? (
          <>
            <Card className="border-blue-100 bg-white/95">
              <CardHeader>
                <CardTitle>{copy.summary}</CardTitle>
                <CardDescription>
                  {deal.title} - {getCountryLabel(deal.to_country, uiLang)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {error ? <p className="text-xs text-rose-700">{error}</p> : null}
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-1">
                    <Label>{uiLang === "en" ? "Title" : "Titre"}</Label>
                    <Input value={form.title} onChange={(event) => setForm((prev) => (prev ? { ...prev, title: event.target.value } : prev))} />
                  </div>
                  <div className="space-y-1">
                    <Label>{uiLang === "en" ? "Stage" : "Etape"}</Label>
                    <Select value={form.stage} onValueChange={(value) => setForm((prev) => (prev ? { ...prev, stage: value as DealStage } : prev))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {dealStageOrder.map((stage) => (
                          <SelectItem key={stage} value={stage}>
                            {stageLabel(stage, uiLang)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>{uiLang === "en" ? "Amount" : "Montant"}</Label>
                    <Input
                      type="number"
                      value={form.amount}
                      onChange={(event) => setForm((prev) => (prev ? { ...prev, amount: event.target.value } : prev))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{uiLang === "en" ? "Currency" : "Devise"}</Label>
                    <Input value={form.currency} onChange={(event) => setForm((prev) => (prev ? { ...prev, currency: event.target.value.toUpperCase().slice(0, 3) } : prev))} />
                  </div>
                  <div className="space-y-1">
                    <Label>{uiLang === "en" ? "Probability %" : "Probabilite %"}</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={form.probability}
                      onChange={(event) => setForm((prev) => (prev ? { ...prev, probability: event.target.value } : prev))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{uiLang === "en" ? "Origin country" : "Pays origine"}</Label>
                    <Select value={form.from_country || "FR"} onValueChange={(value) => setForm((prev) => (prev ? { ...prev, from_country: value } : prev))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((country) => (
                          <SelectItem key={`from-${country.iso2}`} value={country.iso2}>
                            {uiLang === "en" ? country.label_en : country.label_fr} ({country.iso2})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>{uiLang === "en" ? "Destination country" : "Pays destination"}</Label>
                    <Select value={form.to_country || "none"} onValueChange={(value) => setForm((prev) => (prev ? { ...prev, to_country: value === "none" ? "" : value } : prev))}>
                      <SelectTrigger>
                        <SelectValue placeholder={copy.missing} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">-</SelectItem>
                        {COUNTRIES.map((country) => (
                          <SelectItem key={`to-${country.iso2}`} value={country.iso2}>
                            {uiLang === "en" ? country.label_en : country.label_fr} ({country.iso2})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Incoterm</Label>
                    <Input value={form.incoterm} onChange={(event) => setForm((prev) => (prev ? { ...prev, incoterm: event.target.value.toUpperCase().slice(0, 3) } : prev))} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>{uiLang === "en" ? "Product text" : "Description produit"}</Label>
                  <Textarea value={form.product_text} onChange={(event) => setForm((prev) => (prev ? { ...prev, product_text: event.target.value } : prev))} rows={2} />
                </div>
                <div className="space-y-1">
                  <Label>{uiLang === "en" ? "Notes" : "Notes"}</Label>
                  <Textarea value={form.notes} onChange={(event) => setForm((prev) => (prev ? { ...prev, notes: event.target.value } : prev))} rows={2} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={save} disabled={saving}>
                    <Save className="mr-2 h-4 w-4" />
                    {copy.save}
                  </Button>
                  <Button variant="secondary" onClick={secureDeal}>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    {copy.secure}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {result ? (
              <Card className="border-blue-100 bg-white/95">
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle>{copy.checkTitle}</CardTitle>
                    <Badge className={decisionBadge(result.decision)}>{result.decision}</Badge>
                  </div>
                  <CardDescription>{result.summary}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 xl:grid-cols-2">
                  <section className="space-y-2">
                    <h3 className="font-semibold text-sm">{copy.checklist}</h3>
                    <ul className="space-y-2">
                      {result.checklist.map((item) => (
                        <li key={item.id} className="rounded-lg border border-border p-2 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{item.label}</span>
                            <Badge variant="outline">{item.status}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{item.explanation}</p>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className="space-y-2">
                    <h3 className="font-semibold text-sm">{copy.risks}</h3>
                    <ul className="list-disc pl-5 text-sm">
                      {result.risks.length ? result.risks.map((risk, index) => <li key={`risk-${index}`}>{risk}</li>) : <li>-</li>}
                    </ul>

                    <h3 className="font-semibold text-sm">{copy.actions}</h3>
                    <ul className="list-disc pl-5 text-sm">
                      {result.actions.length ? result.actions.map((action, index) => <li key={`action-${index}`}>{action}</li>) : <li>-</li>}
                    </ul>

                    <h3 className="font-semibold text-sm">{copy.question}</h3>
                    <p className="text-sm rounded-lg border border-border p-2">{result.priority_question}</p>
                  </section>

                  <section className="space-y-2">
                    <h3 className="font-semibold text-sm">{copy.hs}</h3>
                    <ul className="space-y-2">
                      {result.hs_suggestions.map((proposal) => (
                        <li key={proposal.hs6} className="rounded-lg border border-border p-2 text-sm">
                          <p className="font-medium">
                            {proposal.hs6} - {proposal.label}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {uiLang === "en" ? "Confidence" : "Confiance"}: {Math.round(proposal.confidence * 100)}% - {proposal.reason}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className="space-y-2">
                    <h3 className="font-semibold text-sm">{copy.countryRules}</h3>
                    <ul className="list-disc pl-5 text-sm">
                      {result.country_rules.length ? result.country_rules.map((rule, index) => <li key={`rule-${index}`}>{rule}</li>) : <li>-</li>}
                    </ul>
                  </section>
                </CardContent>
              </Card>
            ) : null}
          </>
        ) : null}
      </div>
    </AppLayout>
  );
}

