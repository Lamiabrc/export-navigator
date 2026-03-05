import * as React from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, Copy, Loader2, Save, ShieldCheck } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { COUNTRIES, getCountryLabel } from "@/lib/constants";
import { getOfficialLinks } from "@/lib/officialLinks";
import { dealComplianceCheck, type DealComplianceOutput } from "@/services/dealComplianceCheck";
import { dealStageOrder, getDealDetail, updateDeal, type CrmDeal, type DealItem, type DealStage } from "@/services/crm";

type DealDetailProps = {
  mode?: "deals" | "dossiers";
};

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

type TraceableGoNoGoResult = {
  ok: true;
  assessment_id?: string | null;
  decision: string;
  risk_score: number;
  risk_breakdown: Record<string, number>;
  recommendations: string[];
  checklist: string[];
  messages: {
    client?: string;
    internal?: string;
  };
  can_export: boolean;
  plan: string;
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

function decisionBadgeClass(decision: string) {
  const upper = String(decision || "").toUpperCase();
  if (upper.includes("NO")) return "bg-rose-100 text-rose-900 border-rose-200";
  if (upper.includes("RESERVE")) return "bg-amber-100 text-amber-900 border-amber-200";
  return "bg-emerald-100 text-emerald-900 border-emerald-200";
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

function capRiskScore(value: unknown) {
  const score = Number(value);
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export default function DealDetail({ mode = "deals" }: DealDetailProps) {
  const { dealId = "" } = useParams();
  const location = useLocation();
  const { lang } = useI18n();
  const uiLang = lang === "en" ? "en" : "fr";
  const isDossierMode = mode === "dossiers" || location.pathname.startsWith("/app/dossiers");
  const backPath = isDossierMode ? "/app/dossiers" : "/app/deals";

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [deal, setDeal] = React.useState<CrmDeal | null>(null);
  const [form, setForm] = React.useState<DealFormState | null>(null);
  const [items, setItems] = React.useState<DealItem[]>([]);

  const [localResult, setLocalResult] = React.useState<DealComplianceOutput | null>(null);
  const [traceLoading, setTraceLoading] = React.useState(false);
  const [traceError, setTraceError] = React.useState<string | null>(null);
  const [traceResult, setTraceResult] = React.useState<TraceableGoNoGoResult | null>(null);
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  const officialLinks = React.useMemo(() => getOfficialLinks(lang, 6), [lang]);

  const copy = React.useMemo(
    () =>
      uiLang === "en"
        ? {
            back: isDossierMode ? "Back to dossiers" : "Back to pipeline",
            summary: isDossierMode ? "Dossier summary" : "Deal summary",
            save: "Save",
            localCheck: "Quick compliance check",
            traceableCheck: "Traceable Go/No-Go",
            localCheckTitle: "Quick check output",
            traceTitle: "Traceable Go/No-Go output",
            missing: "Missing",
            checklist: "Checklist",
            risks: "Risks",
            actions: "Actions",
            question: "Priority question",
            hs: "HS assist",
            countryRules: "Country rules",
            recommendations: "Recommendations",
            riskBreakdown: "Risk breakdown",
            score: "Risk score",
            messages: "Messages",
            copy: "Copy",
            copied: "Copied",
            authRequired: "Please sign in again to run traceable Go/No-Go.",
            quotaExceeded: "Monthly quota exceeded on your plan. Upgrade to continue.",
            traceFailed: "Traceable Go/No-Go failed.",
            officialSources: "Official sources",
            plan: "Plan",
            canExport: "Can export",
          }
        : {
            back: isDossierMode ? "Retour aux dossiers" : "Retour pipeline",
            summary: isDossierMode ? "Resume du dossier" : "Resume du deal",
            save: "Enregistrer",
            localCheck: "Controle rapide",
            traceableCheck: "Go/No-Go tracable",
            localCheckTitle: "Resultat controle rapide",
            traceTitle: "Resultat Go/No-Go tracable",
            missing: "Manquant",
            checklist: "Checklist",
            risks: "Risques",
            actions: "Actions",
            question: "Question prioritaire",
            hs: "Assistant HS",
            countryRules: "Regles pays",
            recommendations: "Recommandations",
            riskBreakdown: "Details du risque",
            score: "Score de risque",
            messages: "Messages",
            copy: "Copier",
            copied: "Copie",
            authRequired: "Reconnectez-vous pour lancer un Go/No-Go tracable.",
            quotaExceeded: "Quota mensuel depasse pour votre plan. Passez a une offre superieure.",
            traceFailed: "Echec du Go/No-Go tracable.",
            officialSources: "Sources officielles",
            plan: "Plan",
            canExport: "Peut exporter",
          },
    [isDossierMode, uiLang]
  );

  const runLocalCheck = React.useCallback((state: DealFormState) => {
    const output = dealComplianceCheck({
      lang: uiLang,
      fromCountry: state.from_country,
      toCountry: state.to_country,
      productText: state.product_text,
      value: Number(state.amount || 0),
      currency: state.currency,
      incoterm: state.incoterm,
    });
    setLocalResult(output);
  }, [uiLang]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const detail = await getDealDetail(dealId);
      setDeal(detail.deal);
      setItems(detail.items || []);
      if (detail.deal) {
        const state = toFormState(detail.deal);
        setForm(state);
        runLocalCheck(state);
      } else {
        setForm(null);
      }
    } catch (err) {
      setError((err as Error)?.message || "Load error");
    } finally {
      setLoading(false);
    }
  }, [dealId, runLocalCheck]);

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
        runLocalCheck(toFormState(updated));
      }
    } catch (err) {
      setError((err as Error)?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const runTraceableCheck = React.useCallback(async () => {
    if (!form || !deal) return;
    setTraceLoading(true);
    setTraceError(null);
    setTraceResult(null);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setTraceError(copy.authRequired);
        return;
      }

      const firstHs = items.find((item) => String(item.hs6 || "").trim())?.hs6 || null;
      const payload = {
        country: form.to_country || "",
        product_desc: form.product_text || "",
        hs_code: firstHs,
        incoterm: form.incoterm || null,
        payment_method: null,
        value_amount: Number(form.amount || 0),
        currency: form.currency || "EUR",
        route: null,
        client: deal.account_name || deal.title || null,
      };

      const response = await fetch("/api/go-no-go", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const body = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (response.status === 401) {
        setTraceError(copy.authRequired);
        return;
      }
      if (response.status === 402 || body?.error === "quota_exceeded") {
        setTraceError(copy.quotaExceeded);
        return;
      }
      if (!response.ok || !body?.ok) {
        setTraceError(body?.error || copy.traceFailed);
        return;
      }

      setTraceResult(body as unknown as TraceableGoNoGoResult);
    } catch (err) {
      setTraceError((err as Error)?.message || copy.traceFailed);
    } finally {
      setTraceLoading(false);
    }
  }, [copy.authRequired, copy.quotaExceeded, copy.traceFailed, deal, form, items]);

  const copyToClipboard = React.useCallback(async (key: string, text: string | undefined) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((curr) => (curr === key ? null : curr)), 1600);
    } catch {
      setCopiedKey(null);
    }
  }, []);

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild>
            <Link to={backPath}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {copy.back}
            </Link>
          </Button>
        </div>

        {loading ? <Card><CardContent className="p-6 text-sm text-muted-foreground">{uiLang === "en" ? "Loading..." : "Chargement..."}</CardContent></Card> : null}
        {!loading && !deal ? <Card><CardContent className="p-6 text-sm text-muted-foreground">{uiLang === "en" ? "Not found." : "Introuvable."}</CardContent></Card> : null}

        {!loading && deal && form ? (
          <>
            <Card className="border-blue-100 bg-white/95">
              <CardHeader>
                <CardTitle>{copy.summary}</CardTitle>
                <CardDescription>{deal.title} - {getCountryLabel(deal.to_country, uiLang)}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {error ? <p className="text-xs text-rose-700">{error}</p> : null}
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-1"><Label>{uiLang === "en" ? "Title" : "Titre"}</Label><Input value={form.title} onChange={(e) => setForm((p) => (p ? { ...p, title: e.target.value } : p))} /></div>
                  <div className="space-y-1"><Label>{uiLang === "en" ? "Stage" : "Etape"}</Label><Select value={form.stage} onValueChange={(v) => setForm((p) => (p ? { ...p, stage: v as DealStage } : p))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{dealStageOrder.map((stage) => <SelectItem key={stage} value={stage}>{stageLabel(stage, uiLang)}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-1"><Label>{uiLang === "en" ? "Amount" : "Montant"}</Label><Input type="number" value={form.amount} onChange={(e) => setForm((p) => (p ? { ...p, amount: e.target.value } : p))} /></div>
                  <div className="space-y-1"><Label>{uiLang === "en" ? "Currency" : "Devise"}</Label><Input value={form.currency} onChange={(e) => setForm((p) => (p ? { ...p, currency: e.target.value.toUpperCase().slice(0, 3) } : p))} /></div>
                  <div className="space-y-1"><Label>{uiLang === "en" ? "Probability %" : "Probabilite %"}</Label><Input type="number" min="0" max="100" value={form.probability} onChange={(e) => setForm((p) => (p ? { ...p, probability: e.target.value } : p))} /></div>
                  <div className="space-y-1"><Label>{uiLang === "en" ? "Origin country" : "Pays origine"}</Label><Select value={form.from_country || "FR"} onValueChange={(v) => setForm((p) => (p ? { ...p, from_country: v } : p))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{COUNTRIES.map((c) => <SelectItem key={`from-${c.iso2}`} value={c.iso2}>{uiLang === "en" ? c.label_en : c.label_fr} ({c.iso2})</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-1"><Label>{uiLang === "en" ? "Destination country" : "Pays destination"}</Label><Select value={form.to_country || "none"} onValueChange={(v) => setForm((p) => (p ? { ...p, to_country: v === "none" ? "" : v } : p))}><SelectTrigger><SelectValue placeholder={copy.missing} /></SelectTrigger><SelectContent><SelectItem value="none">-</SelectItem>{COUNTRIES.map((c) => <SelectItem key={`to-${c.iso2}`} value={c.iso2}>{uiLang === "en" ? c.label_en : c.label_fr} ({c.iso2})</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-1"><Label>Incoterm</Label><Input value={form.incoterm} onChange={(e) => setForm((p) => (p ? { ...p, incoterm: e.target.value.toUpperCase().slice(0, 3) } : p))} /></div>
                </div>
                <div className="space-y-1"><Label>{uiLang === "en" ? "Product text" : "Description produit"}</Label><Textarea value={form.product_text} onChange={(e) => setForm((p) => (p ? { ...p, product_text: e.target.value } : p))} rows={2} /></div>
                <div className="space-y-1"><Label>{uiLang === "en" ? "Notes" : "Notes"}</Label><Textarea value={form.notes} onChange={(e) => setForm((p) => (p ? { ...p, notes: e.target.value } : p))} rows={2} /></div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={save} disabled={saving}><Save className="mr-2 h-4 w-4" />{copy.save}</Button>
                  <Button variant="secondary" onClick={() => runLocalCheck(form)}><ShieldCheck className="mr-2 h-4 w-4" />{copy.localCheck}</Button>
                  <Button variant="default" onClick={runTraceableCheck} disabled={traceLoading}>
                    {traceLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                    {copy.traceableCheck}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {localResult ? (
              <Card className="border-blue-100 bg-white/95">
                <CardHeader>
                  <div className="flex items-center gap-2"><CardTitle>{copy.localCheckTitle}</CardTitle><Badge className={decisionBadgeClass(localResult.decision)}>{localResult.decision}</Badge></div>
                  <CardDescription>{localResult.summary}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 xl:grid-cols-2">
                  <section className="space-y-2"><h3 className="text-sm font-semibold">{copy.checklist}</h3><ul className="space-y-2">{localResult.checklist.map((item) => <li key={item.id} className="rounded-lg border border-border p-2 text-sm"><div className="flex items-center justify-between gap-2"><span className="font-medium">{item.label}</span><Badge variant="outline">{item.status}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{item.explanation}</p></li>)}</ul></section>
                  <section className="space-y-2"><h3 className="text-sm font-semibold">{copy.risks}</h3><ul className="list-disc pl-5 text-sm">{localResult.risks.length ? localResult.risks.map((risk, i) => <li key={`risk-${i}`}>{risk}</li>) : <li>-</li>}</ul><h3 className="text-sm font-semibold">{copy.actions}</h3><ul className="list-disc pl-5 text-sm">{localResult.actions.length ? localResult.actions.map((action, i) => <li key={`action-${i}`}>{action}</li>) : <li>-</li>}</ul><h3 className="text-sm font-semibold">{copy.question}</h3><p className="rounded-lg border border-border p-2 text-sm">{localResult.priority_question}</p></section>
                </CardContent>
              </Card>
            ) : null}

            {traceError ? (
              <Card className="border-rose-200 bg-rose-50"><CardContent className="p-4 text-sm text-rose-800">{traceError} {traceError === copy.quotaExceeded ? <Link to="/pricing" className="ml-1 font-semibold underline">/pricing</Link> : null}</CardContent></Card>
            ) : null}

            {traceResult ? (
              <Card className="border-blue-100 bg-white/95">
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle>{copy.traceTitle}</CardTitle>
                    <Badge className={decisionBadgeClass(traceResult.decision)}>{traceResult.decision}</Badge>
                    <Badge variant="outline">{`${copy.plan}: ${traceResult.plan}`}</Badge>
                    <Badge variant={traceResult.can_export ? "default" : "secondary"}>{`${copy.canExport}: ${traceResult.can_export ? "YES" : "NO"}`}</Badge>
                  </div>
                  <CardDescription>{traceResult.assessment_id ? `assessment_id: ${traceResult.assessment_id}` : "-"}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2"><div className="flex items-center justify-between text-sm"><span>{copy.score}</span><b>{capRiskScore(traceResult.risk_score)} / 100</b></div><Progress value={capRiskScore(traceResult.risk_score)} /></div>
                  <div className="grid gap-4 xl:grid-cols-2">
                    <section className="space-y-2"><h3 className="text-sm font-semibold">{copy.riskBreakdown}</h3><ul className="space-y-1 text-sm">{Object.entries(traceResult.risk_breakdown || {}).sort((a, b) => Number(b[1]) - Number(a[1])).map(([key, value]) => <li key={key} className="flex items-center justify-between rounded border border-border px-2 py-1"><span>{key}</span><b>{capRiskScore(value)}</b></li>)}</ul></section>
                    <section className="space-y-2"><h3 className="text-sm font-semibold">{copy.recommendations}</h3><ul className="list-disc pl-5 text-sm">{(traceResult.recommendations || []).length ? traceResult.recommendations.map((rec, i) => <li key={`rec-${i}`}>{rec}</li>) : <li>-</li>}</ul><h3 className="text-sm font-semibold">{copy.checklist}</h3><ul className="list-disc pl-5 text-sm">{(traceResult.checklist || []).length ? traceResult.checklist.map((check, i) => <li key={`check-${i}`}>{check}</li>) : <li>-</li>}</ul></section>
                  </div>
                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold">{copy.messages}</h3>
                    <div className="grid gap-3 xl:grid-cols-2">
                      <div className="rounded-lg border border-border bg-muted/20 p-3"><div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Client</p><Button type="button" size="sm" variant="outline" onClick={() => copyToClipboard("client", traceResult.messages?.client)}><Copy className="mr-2 h-3.5 w-3.5" />{copiedKey === "client" ? copy.copied : copy.copy}</Button></div><pre className="whitespace-pre-wrap text-sm">{traceResult.messages?.client || "-"}</pre></div>
                      <div className="rounded-lg border border-border bg-muted/20 p-3"><div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Internal</p><Button type="button" size="sm" variant="outline" onClick={() => copyToClipboard("internal", traceResult.messages?.internal)}><Copy className="mr-2 h-3.5 w-3.5" />{copiedKey === "internal" ? copy.copied : copy.copy}</Button></div><pre className="whitespace-pre-wrap text-sm">{traceResult.messages?.internal || "-"}</pre></div>
                    </div>
                  </section>
                </CardContent>
              </Card>
            ) : null}

            <Card className="border-blue-100 bg-white/95">
              <CardHeader><CardTitle>{copy.officialSources}</CardTitle><CardDescription>{uiLang === "en" ? "Reference links for compliant decisions." : "Liens de reference pour vos decisions conformes."}</CardDescription></CardHeader>
              <CardContent className="flex flex-wrap gap-2">{officialLinks.map((link) => <a key={link.id} href={link.url} target="_blank" rel="noreferrer" className="rounded-full border border-border px-3 py-1 text-xs hover:bg-muted" title={link.description}>{link.label}</a>)}</CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </AppLayout>
  );
}
