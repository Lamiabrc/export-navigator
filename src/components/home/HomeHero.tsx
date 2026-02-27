import * as React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Bot, CheckCircle2, ClipboardCopy, Loader2, Radar, UserRound } from "lucide-react";

import heroExportVideo from "@/assets/hero-export.mp4";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { HsAutocomplete } from "@/components/hs/HsAutocomplete";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { HeroLabels } from "@/content/homeContent";
import { supabase } from "@/integrations/supabase/client";

type ExporterRecord = {
  company: string;
  city: string;
  products: string;
  markets: string;
};

type GoNoGoRaw = {
  verdict?: string;
  decision?: string;
  score_risque?: number;
  risk_score?: number;
  riskScore?: number;
  actions?: string[];
  recommendations?: string[];
  action_prioritaire?: string;
  priority_action?: string;
  deliverables?: string[] | string;
  checklist?: string[];
  email_draft?: string;
};

type GoNoGoResult = {
  verdict: string;
  riskScore: number;
  actions: string[];
  priorityAction: string;
  deliverables: string[];
  emailDraft: string;
};

const PRIORITY_COUNTRY_CODES = ["FR", "DE", "ES", "IT", "BE", "NL", "MA", "SN", "CI", "CA", "AE", "US", "CN", "JP"];
const FALLBACK_COUNTRY_CODES = [
  "FR", "DE", "ES", "IT", "BE", "NL", "MA", "SN", "CI", "CA", "AE", "US", "GB", "CH", "PT", "PL", "SE", "NO", "DK", "FI", "AT", "IE", "TR", "BR", "MX", "IN", "CN", "JP", "KR", "AU", "ZA",
];

const PRODUCT_OPTIONS = [
  { id: "machinery", labelFr: "Machines et équipements", labelEn: "Machinery and equipment", hsHint: "84" },
  { id: "electrical", labelFr: "Équipements électriques", labelEn: "Electrical equipment", hsHint: "85" },
  { id: "automotive", labelFr: "Pièces automobiles", labelEn: "Automotive parts", hsHint: "87" },
  { id: "agri-food", labelFr: "Agroalimentaire", labelEn: "Agri-food", hsHint: "20" },
  { id: "dairy", labelFr: "Produits laitiers", labelEn: "Dairy products", hsHint: "04" },
  { id: "cosmetics", labelFr: "Cosmétiques", labelEn: "Cosmetics", hsHint: "33" },
  { id: "textile", labelFr: "Textile & habillement", labelEn: "Textile & apparel", hsHint: "61" },
  { id: "chemicals", labelFr: "Produits chimiques", labelEn: "Chemicals", hsHint: "38" },
  { id: "pharma", labelFr: "Pharmaceutique", labelEn: "Pharmaceutical", hsHint: "30" },
  { id: "metal", labelFr: "Métallurgie", labelEn: "Metal products", hsHint: "73" },
  { id: "furniture", labelFr: "Mobilier", labelEn: "Furniture", hsHint: "94" },
  { id: "other", labelFr: "Autre produit", labelEn: "Other product", hsHint: "" },
] as const;

const ROLE_OPTIONS = [
  { id: "seller", labelFr: "Vendeur export", labelEn: "Export seller" },
  { id: "negotiator", labelFr: "Négociateur", labelEn: "Negotiator" },
  { id: "introducer", labelFr: "Apporteur d’affaires", labelEn: "Business introducer" },
  { id: "sales", labelFr: "Commercial", labelEn: "Sales representative" },
  { id: "bizdev", labelFr: "Business developer", labelEn: "Business developer" },
] as const;

const OBJECTIVE_CHIPS = {
  fr: ["Signer 3 distributeurs", "Trouver 10 leads qualifiés", "Sécuriser le paiement"],
  en: ["Sign 3 distributors", "Find 10 qualified leads", "Secure payment terms"],
};

const FRENCH_EXPORTERS_SAMPLE: ExporterRecord[] = [
  { company: "LactaFrais Export", city: "Lyon", products: "Produits laitiers UHT", markets: "Maroc, Sénégal, Côte d’Ivoire" },
  { company: "HexaTech Industrie", city: "Toulouse", products: "Pièces machines (HS 84)", markets: "Allemagne, Espagne, Italie" },
  { company: "Maison Atlantique", city: "Bordeaux", products: "Cosmétiques & soins", markets: "Canada, EAU, Belgique" },
];

function normalizeList(input: unknown): string[] {
  if (Array.isArray(input)) return input.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  if (typeof input === "string" && input.trim()) return [input.trim()];
  return [];
}

function toResult(raw: GoNoGoRaw, product: string, country: string, objective: string): GoNoGoResult {
  const actions = normalizeList(raw.actions).concat(normalizeList(raw.recommendations)).slice(0, 3);
  const deliverables = normalizeList(raw.deliverables).concat(normalizeList(raw.checklist)).slice(0, 6);
  const verdict = String(raw.verdict || raw.decision || "GO sous conditions").trim();
  const scoreRaw = raw.riskScore ?? raw.risk_score ?? raw.score_risque ?? 47;
  const riskScore = Number.isFinite(Number(scoreRaw)) ? Number(scoreRaw) : 47;
  const priorityAction = String(raw.priority_action || raw.action_prioritaire || actions[0] || "Valider Incoterm, paiement et conformité avant devis final").trim();
  const emailDraft =
    raw.email_draft ||
    `Objet: Plan Go/No-Go export\n\nVerdict: ${verdict}\nProduit: ${product}\nPays: ${country}\nObjectif: ${objective || "N/A"}\nScore risque: ${riskScore}/100\nAction prioritaire: ${priorityAction}\n\nActions:\n${actions.map((a) => `- ${a}`).join("\n")}`;

  return {
    verdict,
    riskScore,
    actions: actions.length ? actions : ["Confirmer obligations douanières", "Valider paiement sécurisé", "Préparer package documentaire"],
    priorityAction,
    deliverables: deliverables.length ? deliverables : ["Checklist opérationnelle", "Email client prêt à envoyer"],
    emailDraft,
  };
}

function mockAnalysis(product: string, country: string, objective: string): GoNoGoResult {
  return toResult(
    {
      verdict: "GO sous conditions",
      risk_score: 42,
      actions: [
        "Valider Incoterm final + responsabilités transport.",
        "Confirmer code HS et exigences documentaires locales.",
        "Sécuriser paiement (acompte / crédit documentaire).",
      ],
      priority_action: "Lancer checklist conformité avant envoi du devis final.",
      deliverables: ["Checklist douane + conformité", "Email client prêt à envoyer"],
    },
    product,
    country,
    objective
  );
}

function ResultSkeleton() {
  return (
    <div className="space-y-2 rounded-lg border bg-white p-3">
      <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
      <div className="h-4 w-1/2 animate-pulse rounded bg-slate-200" />
      <div className="h-16 animate-pulse rounded bg-slate-100" />
    </div>
  );
}

export function HomeHero({ labels, isEn }: { labels: HeroLabels; isEn: boolean }) {
  const [countryCode, setCountryCode] = React.useState("MA");
  const [productId, setProductId] = React.useState("machinery");
  const [hsCode, setHsCode] = React.useState("8471");
  const [showExporterDirectory, setShowExporterDirectory] = React.useState(false);
  const [roleId, setRoleId] = React.useState("seller");
  const [objective, setObjective] = React.useState(isEn ? "Reach 3 new distributors in 90 days" : "Signer 3 nouveaux distributeurs en 90 jours");
  const [status, setStatus] = React.useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = React.useState("");
  const [analysis, setAnalysis] = React.useState<GoNoGoResult | null>(null);

  const selectedProduct = PRODUCT_OPTIONS.find((p) => p.id === productId) ?? PRODUCT_OPTIONS[0];
  const selectedRole = ROLE_OPTIONS.find((r) => r.id === roleId) ?? ROLE_OPTIONS[0];

  const countryName = React.useMemo(() => {
    try {
      return new Intl.DisplayNames([isEn ? "en" : "fr"], { type: "region" }).of(countryCode) || countryCode;
    } catch {
      return countryCode;
    }
  }, [countryCode, isEn]);

  const countryOptions = React.useMemo(() => {
    let regions = FALLBACK_COUNTRY_CODES;
    if (typeof Intl !== "undefined" && typeof (Intl as any).supportedValuesOf === "function") {
      try {
        regions = ((Intl as any).supportedValuesOf("region") as string[]).filter((c) => /^[A-Z]{2}$/.test(c));
      } catch {
        regions = FALLBACK_COUNTRY_CODES;
      }
    }
    const dedup = Array.from(new Set([...PRIORITY_COUNTRY_CODES, ...regions]));
    const dn = new Intl.DisplayNames([isEn ? "en" : "fr"], { type: "region" });
    return dedup.map((code) => ({ code, label: dn.of(code) || code })).sort((a, b) => a.label.localeCompare(b.label));
  }, [isEn]);

  React.useEffect(() => {
    if (!hsCode && selectedProduct.hsHint) setHsCode(selectedProduct.hsHint);
  }, [hsCode, selectedProduct]);

  const runAnalysis = React.useCallback(
    async (mode: "real" | "demo" = "real") => {
      const product = isEn ? selectedProduct.labelEn : selectedProduct.labelFr;
      const payload = {
        role: isEn ? selectedRole.labelEn : selectedRole.labelFr,
        country: countryName,
        product,
        hsCode: hsCode.trim(),
        objective: objective.trim(),
      };

      setStatus("loading");
      setErrorMessage("");
      setAnalysis(null);

      if (mode === "demo" || import.meta.env.VITE_GO_NO_GO_MOCK === "true") {
        await new Promise((r) => setTimeout(r, 650));
        setAnalysis(mockAnalysis(product, countryName, payload.objective));
        setStatus("success");
        return;
      }

      const { data, error } = await supabase.functions.invoke<GoNoGoRaw>("go-no-go", { body: payload });
      if (error) {
        setStatus("error");
        setErrorMessage(error.message || (isEn ? "Analysis failed" : "L’analyse a échoué"));
        return;
      }

      setAnalysis(toResult(data || {}, product, countryName, payload.objective));
      setStatus("success");
    },
    [countryName, hsCode, isEn, objective, selectedProduct, selectedRole]
  );

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await runAnalysis("real");
  };

  const copyEmail = async () => {
    if (!analysis?.emailDraft) return;
    try {
      await navigator.clipboard.writeText(analysis.emailDraft);
    } catch {
      // ignore
    }
  };

  const copyChecklist = async () => {
    if (!analysis) return;
    const checklist = [
      `${isEn ? "Verdict" : "Verdict"}: ${analysis.verdict}`,
      `${isEn ? "Risk score" : "Score risque"}: ${analysis.riskScore}/100`,
      `${isEn ? "Priority action" : "Action prioritaire"}: ${analysis.priorityAction}`,
      "",
      ...(isEn ? ["Top actions:"] : ["Actions prioritaires :"]),
      ...analysis.actions.map((x) => `- ${x}`),
      "",
      ...(isEn ? ["Deliverables:"] : ["Livrables :"]),
      ...analysis.deliverables.map((x) => `- ${x}`),
    ].join("\n");

    try {
      await navigator.clipboard.writeText(checklist);
    } catch {
      // ignore
    }
  };

  const chips = isEn ? OBJECTIVE_CHIPS.en : OBJECTIVE_CHIPS.fr;

  return (
    <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/70 p-6 sm:p-8 lg:p-12 xl:p-14">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-r from-primary/5 via-transparent to-emerald-500/5" />
      <div className="relative space-y-8">
        <div className="space-y-5">
          <Badge variant="secondary" className="w-fit rounded-full px-3 py-1 text-xs">{labels.badge}</Badge>
          <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">{labels.welcomeTitle}</p>
            <p className="text-sm text-slate-700">{labels.welcomeBody}</p>
          </div>
          <div className="space-y-4">
            <h1 className="text-balance text-4xl font-bold tracking-tight text-slate-900 md:text-5xl lg:text-6xl">{labels.title}</h1>
            <p className="max-w-2xl text-base leading-relaxed text-slate-600 md:text-lg">{labels.intro}
            </p>
            <p className="text-base font-semibold text-primary">{isEn ? "Ask your export question now." : "Posez votre question export maintenant."}</p>
          </div>
          <ul className="space-y-2 text-slate-700">
            {labels.bullets.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button asChild size="lg" className="sm:min-w-60">
              <Link to="/#hero-video">
                {labels.ctaVideo} <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="sm:min-w-52">
              <Link to="/login?next=%2Fapp%2Fcontrol-tower">{labels.ctaTower}</Link>
            </Button>
            <Button asChild variant="ghost" size="lg" className="justify-start px-0 text-slate-700 hover:text-slate-900 sm:px-4">
              <Link to="/contact">{labels.ctaContact}</Link>
            </Button>
          </div>
          <p className="text-sm text-slate-500">{labels.confidentiality}</p>
        </div>

        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950/95 p-2">
            <video className="aspect-[21/7] w-full rounded-lg object-cover" autoPlay muted loop playsInline preload="metadata">
              <source src={heroExportVideo} type="video/mp4" />
            </video>
            <p className="px-1 pt-2 text-xs text-slate-300">{isEn ? "Quick product preview in real conditions." : "Aperçu rapide de la plateforme en conditions réelles."}</p>
          </div>

          <Card className="border-slate-200 bg-white/95 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Radar className="size-5 text-primary" />
                {isEn ? "AI export copilot" : "Copilote IA export"}
              </CardTitle>
            </CardHeader>

            <CardContent>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                <div className="space-y-3">
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                    <div className="mb-2 flex items-start gap-2">
                      <div className="rounded-full bg-primary/10 p-1.5 text-primary"><Bot className="size-4" /></div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-primary">{isEn ? "MPL AI mentor" : "Mentor IA MPL"}</p>
                        <p className="text-xs text-slate-600">{isEn ? "From profile to market and goal, get a Go/No-Go in seconds." : "Du profil au marché et objectif, obtenez un Go/No-Go en quelques secondes."}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border bg-white px-2 py-1.5 text-xs text-slate-600">
                      <UserRound className="size-3.5 text-slate-500" />
                      {isEn ? "What do you want to achieve?" : "Que voulez-vous atteindre ?"}
                    </div>
                  </div>

                  <img src="/illustrations/export-ai.svg" alt={isEn ? "AI export copilot" : "Illustration copilote IA export"} className="aspect-video w-full rounded-xl border border-slate-200 bg-slate-50 p-2 object-cover" />

                  <div className="rounded-xl border bg-white p-3 text-xs">
                    <p className="mb-2 font-semibold text-slate-700">{isEn ? "Steps" : "Étapes"}</p>
                    <ol className="space-y-1 text-slate-600">
                      <li><span className="mr-1 font-semibold text-primary">1.</span>{isEn ? "Profile" : "Profil"}</li>
                      <li><span className="mr-1 font-semibold text-primary">2.</span>{isEn ? "Market" : "Marché"}</li>
                      <li><span className="mr-1 font-semibold text-primary">3.</span>{isEn ? "Objective" : "Objectif"}</li>
                    </ol>
                  </div>
                </div>

                <div className="space-y-3">
                  <form onSubmit={onSubmit} className="space-y-3">
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      <div className="space-y-1">
                        <p className="text-xs text-slate-500">{isEn ? "Role" : "Rôle"}</p>
                        <Select value={roleId} onValueChange={setRoleId}>
                          <SelectTrigger><SelectValue placeholder={isEn ? "Select role" : "Choisir un rôle"} /></SelectTrigger>
                          <SelectContent>
                            {ROLE_OPTIONS.map((item) => (
                              <SelectItem key={item.id} value={item.id}>{isEn ? item.labelEn : item.labelFr}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs text-slate-500">{isEn ? "Destination country" : "Pays destination"}</p>
                        <Select value={countryCode} onValueChange={setCountryCode}>
                          <SelectTrigger><SelectValue placeholder={isEn ? "Select country" : "Choisir un pays"} /></SelectTrigger>
                          <SelectContent>
                            {countryOptions.map((item) => (
                              <SelectItem key={item.code} value={item.code}>{item.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs text-slate-500">{isEn ? "Product" : "Produit"}</p>
                        <Select value={productId} onValueChange={setProductId}>
                          <SelectTrigger><SelectValue placeholder={isEn ? "Select product" : "Choisir un produit"} /></SelectTrigger>
                          <SelectContent>
                            {PRODUCT_OPTIONS.map((item) => (
                              <SelectItem key={item.id} value={item.id}>{isEn ? item.labelEn : item.labelFr}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs text-slate-500">HS code</p>
                        <HsAutocomplete value={hsCode} onChange={setHsCode} productContext={isEn ? selectedProduct.labelEn : selectedProduct.labelFr} />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs text-slate-500">{isEn ? "Business objective" : "Objectif business"}</p>
                      <Input value={objective} onChange={(e) => setObjective(e.target.value)} placeholder={isEn ? "Example: secure 2 distributors in Morocco" : "Ex: sécuriser 2 distributeurs au Maroc"} />
                      <div className="flex flex-wrap gap-2 pt-1">
                        {chips.map((chip) => (
                          <button key={chip} type="button" onClick={() => setObjective(chip)} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs hover:bg-slate-100">
                            {chip}
                          </button>
                        ))}
                      </div>
                    </div>

                    <Button type="submit" className="w-full" disabled={status === "loading"}>
                      {status === "loading" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                      {isEn ? "Launch analysis" : "Lancer l’analyse"}
                    </Button>
                    <p className="text-center text-xs text-slate-500">{isEn ? "Analysis in ~60s. Confidential data." : "Analyse en ~60s. Données confidentielles."}</p>
                  </form>

                  <button type="button" onClick={() => runAnalysis("demo")} className="text-xs font-medium text-primary underline">
                    {isEn ? "See an example" : "Voir un exemple"}
                  </button>

                  {status === "loading" ? <ResultSkeleton /> : null}

                  {status === "error" ? (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{errorMessage || (isEn ? "Analysis failed" : "L’analyse a échoué")}</div>
                  ) : null}

                  <div className={`overflow-hidden transition-all duration-300 ${status === "success" && analysis ? "max-h-[640px] opacity-100" : "max-h-0 opacity-0"}`}>
                    {analysis ? (
                      <div className="space-y-3 rounded-lg border bg-white p-3">
                        <p className="font-medium text-emerald-700">{isEn ? "Verdict" : "Verdict"}: {analysis.verdict}</p>
                        <p className="text-sm text-slate-600">{isEn ? "Risk score" : "Score risque"}: <span className="font-semibold">{analysis.riskScore}/100</span></p>
                        <div>
                          <p className="mb-1 text-sm font-semibold">{isEn ? "Top 3 actions" : "3 actions prioritaires"}</p>
                          <ul className="list-disc pl-5 text-sm text-slate-700">
                            {analysis.actions.map((item) => <li key={item}>{item}</li>)}
                          </ul>
                        </div>
                        <p className="text-sm"><span className="font-semibold">{isEn ? "Priority action" : "Action prioritaire"}:</span> {analysis.priorityAction}</p>
                        <p className="text-sm"><span className="font-semibold">{isEn ? "Deliverables" : "Livrables"}:</span> {analysis.deliverables.join(" • ")}</p>
                        <div className="flex gap-2">
                          <Button type="button" variant="outline" className="w-full" onClick={copyEmail}><ClipboardCopy className="mr-2 size-4" />{isEn ? "Copy email" : "Copier l’email"}</Button>
                          <Button type="button" variant="outline" className="w-full" onClick={copyChecklist}><ClipboardCopy className="mr-2 size-4" />{isEn ? "Copy checklist" : "Copier la checklist"}</Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2 rounded-lg border bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{isEn ? "French exporters database (sample)" : "Base entreprises exportatrices françaises (exemple)"}</p>
                <p className="text-xs text-slate-500">{isEn ? "Inspired by ITC-style trade directories: company profile + exported products + target markets." : "Inspiré des annuaires type ITC : profil entreprise + produits exportés + marchés cibles."}</p>
                <Button type="button" variant="secondary" size="sm" className="w-full" onClick={() => setShowExporterDirectory((prev) => !prev)}>
                  {showExporterDirectory ? (isEn ? "Hide sample directory" : "Masquer l'exemple d'annuaire") : (isEn ? "View sample directory" : "Voir un exemple d'annuaire")}
                </Button>
                {showExporterDirectory ? (
                  <div className="space-y-2">
                    {FRENCH_EXPORTERS_SAMPLE.map((row) => (
                      <div key={row.company} className="rounded-md border bg-slate-50 p-2 text-xs">
                        <p className="font-semibold text-slate-900">{row.company} · {row.city}</p>
                        <p><span className="text-slate-500">{isEn ? "Products" : "Produits"}:</span> {row.products}</p>
                        <p><span className="text-slate-500">{isEn ? "Markets" : "Marchés"}:</span> {row.markets}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">{isEn ? "Need a human expert?" : "Besoin d’un expert humain ?"}</p>
                <p className="mt-1 text-sm text-slate-600">{isEn ? "Contact us, call us, or use our export tracking and development tool." : "Contactez un expert, appelez-nous, ou utilisez notre outil de suivi et de développement export."}</p>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Button asChild variant="outline" className="w-full"><Link to="/contact">{isEn ? "Contact an expert" : "Contacter un expert"}</Link></Button>
                  <Button asChild variant="outline" className="w-full"><a href="tel:+33676435551">{isEn ? "Call" : "Appeler"}</a></Button>
                  <Button asChild className="w-full"><Link to="/app/control-tower">{isEn ? "Export growth tool" : "Outil de suivi export"}</Link></Button>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </section>
  );
}
