import * as React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Bot, CheckCircle2, ClipboardCopy, Download, Loader2, Radar, UserRound } from "lucide-react";

import heroExportVideo from "@/assets/hero-export.mp4";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  riskScore: number | null;
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

const FRENCH_EXPORTERS_SAMPLE: ExporterRecord[] = [
  {
    company: "LactaFrais Export",
    city: "Lyon",
    products: "Produits laitiers UHT",
    markets: "Maroc, Sénégal, Côte d’Ivoire",
  },
  {
    company: "HexaTech Industrie",
    city: "Toulouse",
    products: "Pièces machines (HS 84)",
    markets: "Allemagne, Espagne, Italie",
  },
  {
    company: "Maison Atlantique",
    city: "Bordeaux",
    products: "Cosmétiques & soins",
    markets: "Canada, EAU, Belgique",
  },
];

function normalizeList(input: unknown): string[] {
  if (Array.isArray(input)) return input.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  if (typeof input === "string" && input.trim()) return [input.trim()];
  return [];
}

function buildResult(raw: GoNoGoRaw, fallbackProduct: string, fallbackCountry: string): GoNoGoResult {
  const actions = normalizeList(raw.actions).concat(normalizeList(raw.recommendations)).slice(0, 3);
  const deliverables = normalizeList(raw.deliverables).concat(normalizeList(raw.checklist)).slice(0, 6);
  const verdict = String(raw.verdict || raw.decision || "Analyse générée").trim();
  const riskScoreRaw = raw.risk_score ?? raw.score_risque ?? raw.riskScore;
  const riskScore = Number.isFinite(Number(riskScoreRaw)) ? Number(riskScoreRaw) : null;
  const priorityAction = String(raw.priority_action || raw.action_prioritaire || actions[0] || "Valider les informations critiques avant engagement").trim();

  const emailDraft =
    raw.email_draft ||
    `Objet: Recommandation Go/No-Go export\n\nVerdict: ${verdict}\nProduit: ${fallbackProduct}\nPays: ${fallbackCountry}\n${riskScore !== null ? `Risque: ${riskScore}/100\n` : ""}Action prioritaire: ${priorityAction}\n\nActions:\n${actions.map((a) => `- ${a}`).join("\n")}`;

  return {
    verdict,
    riskScore,
    actions,
    priorityAction,
    deliverables,
    emailDraft,
  };
}

export function HomeHero({
  labels,
  isEn,
}: {
  labels: HeroLabels;
  isEn: boolean;
}) {
  const [countryCode, setCountryCode] = React.useState<string>("MA");
  const [productId, setProductId] = React.useState<string>("machinery");
  const [hsCode, setHsCode] = React.useState<string>("8471");
  const [showExporterDirectory, setShowExporterDirectory] = React.useState<boolean>(false);
  const [roleId, setRoleId] = React.useState<string>("seller");
  const [objective, setObjective] = React.useState<string>(isEn ? "Reach 3 new distributors in 90 days" : "Signer 3 nouveaux distributeurs en 90 jours");
  const [status, setStatus] = React.useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = React.useState<string>("");
  const [analysis, setAnalysis] = React.useState<GoNoGoResult | null>(null);
  const [showExample, setShowExample] = React.useState<boolean>(false);

  const countryName = React.useMemo(() => {
    try {
      const dn = new Intl.DisplayNames([isEn ? "en" : "fr"], { type: "region" });
      return dn.of(countryCode) || countryCode;
    } catch {
      return countryCode;
    }
  }, [countryCode, isEn]);

  const countryOptions = React.useMemo(() => {
    let regions: string[] = FALLBACK_COUNTRY_CODES;
    if (typeof Intl !== "undefined" && typeof (Intl as any).supportedValuesOf === "function") {
      try {
        regions = ((Intl as any).supportedValuesOf("region") as string[]).filter((c) => /^[A-Z]{2}$/.test(c));
      } catch {
        regions = FALLBACK_COUNTRY_CODES;
      }
    }
    const dedup = Array.from(new Set([...PRIORITY_COUNTRY_CODES, ...regions]));
    const dn = new Intl.DisplayNames([isEn ? "en" : "fr"], { type: "region" });
    return dedup
      .map((code) => ({ code, label: dn.of(code) || code }))
      .sort((a, b) => a.label.localeCompare(b.label, isEn ? "en" : "fr"));
  }, [isEn]);

  const selectedProduct = PRODUCT_OPTIONS.find((p) => p.id === productId) ?? PRODUCT_OPTIONS[0];
  const selectedRole = ROLE_OPTIONS.find((r) => r.id === roleId) ?? ROLE_OPTIONS[0];

  React.useEffect(() => {
    if (!hsCode && selectedProduct.hsHint) {
      setHsCode(selectedProduct.hsHint);
    }
  }, [selectedProduct, hsCode]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("loading");
    setErrorMessage("");
    setAnalysis(null);

    const payload = {
      role: selectedRole.labelFr,
      country: countryName,
      product: isEn ? selectedProduct.labelEn : selectedProduct.labelFr,
      hsCode: hsCode.trim(),
      objective: objective.trim(),
    };

    const { data, error } = await supabase.functions.invoke<GoNoGoRaw>("go-no-go", {
      body: payload,
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message || (isEn ? "Analysis failed" : "L’analyse a échoué"));
      return;
    }

    const built = buildResult(data || {}, payload.product, payload.country);
    setAnalysis(built);
    setStatus("success");
  };

  const copyEmail = async () => {
    if (!analysis?.emailDraft) return;
    try {
      await navigator.clipboard.writeText(analysis.emailDraft);
    } catch {
      // noop
    }
  };

  const downloadChecklist = () => {
    if (!analysis) return;
    const lines = [
      `${isEn ? "Verdict" : "Verdict"}: ${analysis.verdict}`,
      analysis.riskScore !== null ? `${isEn ? "Risk score" : "Score risque"}: ${analysis.riskScore}/100` : "",
      `${isEn ? "Priority action" : "Action prioritaire"}: ${analysis.priorityAction}`,
      "",
      `${isEn ? "Actions" : "Actions"}:`,
      ...analysis.actions.map((x) => `- ${x}`),
      "",
      `${isEn ? "Deliverables" : "Livrables"}:`,
      ...analysis.deliverables.map((x) => `- ${x}`),
    ].filter(Boolean);

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "checklist-go-no-go.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/70 p-6 sm:p-8 lg:p-12">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-r from-primary/5 via-transparent to-emerald-500/5" />
      <div className="relative grid items-start gap-8 lg:grid-cols-[minmax(0,1.12fr)_minmax(380px,0.88fr)] lg:gap-10">
        <div className="space-y-6">
          <Badge variant="secondary" className="w-fit rounded-full px-3 py-1 text-xs">{labels.badge}</Badge>
          <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">{labels.welcomeTitle}</p>
            <p className="text-sm text-slate-700">{labels.welcomeBody}</p>
          </div>
          <div className="space-y-4">
            <h1 className="text-balance text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">{labels.title}</h1>
            <p className="max-w-2xl text-lg text-slate-600">{labels.intro}</p>
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
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Radar className="size-5 text-primary" />
                {isEn ? "AI export copilot" : "Copilote IA export"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-700">
              <p className="text-xs text-slate-500">
                {isEn
                  ? "Launch a real Go/No-Go analysis based on role, product, HS code, country and objective."
                  : "Lancez une vraie analyse Go/No-Go à partir du rôle, produit, code HS, pays et objectif."}
              </p>

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                <div className="mb-2 flex items-start gap-2">
                  <div className="rounded-full bg-primary/10 p-1.5 text-primary"><Bot className="size-4" /></div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">{isEn ? "MPL AI mentor" : "Mentor IA MPL"}</p>
                    <p className="text-xs text-slate-600">
                      {isEn
                        ? "I ask your role, product and target country, then recommend goal, plan and next actions."
                        : "Je vous demande votre rôle, votre produit et votre pays cible, puis je recommande objectif, plan et actions."}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg border bg-white px-2 py-1.5 text-xs text-slate-600">
                  <UserRound className="size-3.5 text-slate-500" />
                  {isEn ? "What do you want to achieve?" : "Que voulez-vous atteindre ?"}
                </div>
              </div>

              <form onSubmit={onSubmit} className="space-y-4">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">{isEn ? "Role" : "Rôle"}</p>
                    <Select value={roleId} onValueChange={setRoleId}>
                      <SelectTrigger>
                        <SelectValue placeholder={isEn ? "Select role" : "Choisir un rôle"} />
                      </SelectTrigger>
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
                      <SelectTrigger>
                        <SelectValue placeholder={isEn ? "Select country" : "Choisir un pays"} />
                      </SelectTrigger>
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
                      <SelectTrigger>
                        <SelectValue placeholder={isEn ? "Select product" : "Choisir un produit"} />
                      </SelectTrigger>
                      <SelectContent>
                        {PRODUCT_OPTIONS.map((item) => (
                          <SelectItem key={item.id} value={item.id}>{isEn ? item.labelEn : item.labelFr}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">HS code</p>
                    <Input value={hsCode} onChange={(e) => setHsCode(e.target.value)} placeholder="Ex: 8471" />
                  </div>
                  <div className="space-y-1 md:col-span-2 xl:col-span-4">
                    <p className="text-xs text-slate-500">{isEn ? "Business objective" : "Objectif business"}</p>
                    <Input
                      value={objective}
                      onChange={(e) => setObjective(e.target.value)}
                      placeholder={isEn ? "Example: secure 2 distributors in Morocco" : "Ex: sécuriser 2 distributeurs au Maroc"}
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={status === "loading"}>
                  {status === "loading" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  {isEn ? "Launch analysis" : "Lancer l’analyse"}
                </Button>
              </form>

              {status === "idle" ? (
                <div className="rounded-lg border bg-white p-3 text-xs text-slate-600">
                  {isEn ? "No result yet. Fill the fields and run the analysis." : "Aucun résultat pour le moment. Renseignez les champs puis lancez l’analyse."}
                  <button
                    type="button"
                    onClick={() => setShowExample((prev) => !prev)}
                    className="mt-2 block text-primary underline"
                  >
                    {showExample ? (isEn ? "Hide example" : "Masquer l’exemple") : (isEn ? "Show example" : "Voir un exemple")}
                  </button>
                  {showExample ? (
                    <div className="mt-2 rounded border bg-slate-50 p-2">
                      <p className="font-medium">{isEn ? "Example" : "Exemple"}: GO sous conditions • Risque 42/100</p>
                      <p>{isEn ? "Priority: validate Incoterm and cargo insurance." : "Priorité : valider Incoterm et assurance transport."}</p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {status === "error" ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  {errorMessage || (isEn ? "Analysis failed" : "L’analyse a échoué")}
                </div>
              ) : null}

              {status === "success" && analysis ? (
                <div className="space-y-3">
                  <div className="rounded-xl border bg-slate-50 p-3">
                    <p className="font-medium">
                      {isEn ? "Role" : "Rôle"}: {isEn ? selectedRole.labelEn : selectedRole.labelFr} • {isEn ? "Country" : "Pays"}: {countryName} • {isEn ? "Product" : "Produit"}: {isEn ? selectedProduct.labelEn : selectedProduct.labelFr} • HS: {hsCode || "—"}
                    </p>
                    <p className="text-emerald-700">{isEn ? "Verdict" : "Verdict"}: {analysis.verdict}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border bg-white p-3">
                      <p className="text-slate-500">{isEn ? "Risk" : "Risque"}</p>
                      <p className="font-semibold">{analysis.riskScore !== null ? `${analysis.riskScore} / 100` : "—"}</p>
                    </div>
                    <div className="rounded-lg border bg-white p-3">
                      <p className="text-slate-500">{isEn ? "Deliverables" : "Livrables"}</p>
                      <p className="font-semibold">{analysis.deliverables.slice(0, 2).join(" • ") || (isEn ? "Checklist + client email" : "Checklist + email client")}</p>
                    </div>
                  </div>

                  <div className="rounded-lg border bg-white p-3">
                    <p className="font-semibold text-slate-900">{isEn ? "Priority action" : "Action prioritaire"}: {analysis.priorityAction}</p>
                  </div>

                  <div className="rounded-lg border bg-white p-3">
                    <p className="mb-1 font-semibold">{isEn ? "Top 3 actions" : "3 actions"}</p>
                    <ul className="list-disc pl-5">
                      {analysis.actions.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="w-full" onClick={copyEmail}>
                      <ClipboardCopy className="mr-2 size-4" />
                      {isEn ? "Copy email" : "Copier email"}
                    </Button>
                    <Button type="button" variant="outline" className="w-full" onClick={downloadChecklist}>
                      <Download className="mr-2 size-4" />
                      {isEn ? "Download checklist" : "Télécharger checklist"}
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="space-y-2 rounded-lg border bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {isEn ? "French exporters database (sample)" : "Base entreprises exportatrices françaises (exemple)"}
                </p>
                <p className="text-xs text-slate-500">
                  {isEn
                    ? "Inspired by ITC-style trade directories: company profile + exported products + target markets, powered by a product/HS-country knowledge base and LLM guidance."
                    : "Inspiré des annuaires type ITC : profil entreprise + produits exportés + marchés cibles, adossé à une base produits/HS/pays et un moteur LLM de conseil."}
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border bg-slate-50 px-2 py-1">{isEn ? "Company profile" : "Profil entreprise"}</span>
                  <span className="rounded-full border bg-slate-50 px-2 py-1">{isEn ? "Exported products" : "Produits exportés"}</span>
                  <span className="rounded-full border bg-slate-50 px-2 py-1">{isEn ? "Target markets" : "Marchés cibles"}</span>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowExporterDirectory((prev) => !prev)}
                >
                  {showExporterDirectory
                    ? (isEn ? "Hide sample directory" : "Masquer l'exemple d'annuaire")
                    : (isEn ? "View sample directory" : "Voir un exemple d'annuaire")}
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
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link to="/contact?topic=exporters-database-signup">
                    {isEn
                      ? "Free listing: add my company and exported products"
                      : "Inscription gratuite : ajouter mon entreprise et mes produits exportés"}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950/95 p-2">
            <video className="aspect-video w-full rounded-lg" autoPlay muted loop playsInline preload="metadata">
              <source src={heroExportVideo} type="video/mp4" />
            </video>
            <p className="px-1 pt-2 text-xs text-slate-300">{isEn ? "Quick product preview in real conditions." : "Aperçu rapide de la plateforme en conditions réelles."}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
