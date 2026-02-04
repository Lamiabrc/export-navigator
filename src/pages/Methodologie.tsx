import { Link, useNavigate } from "react-router-dom";

import { PublicLayout } from "@/components/layout/PublicLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useI18n } from "@/contexts/LanguageContext";

import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileText,
  Info,
  Mail,
  Phone,
  ShieldCheck,
} from "lucide-react";

type Lang = "fr" | "en";

type SourceItem = {
  label: string;
  url: string;
  note: string;
  tags: string[];
};

type Copy = {
  eyebrow: string;
  title: string;
  subtitle: string;

  ctaCall: string;
  ctaRequest: string;
  ctaLaunch: string;

  whatDoesTitle: string;
  whatDoesDesc: string;
  whatNotTitle: string;
  whatNotDesc: string;

  stepsTitle: string;
  stepsDesc: string;
  stepLabel: string;

  checklistTitle: string;
  checklistDesc: string;

  tipTitlePrefix?: string;
  tip: string;

  sourcesTitle: string;
  sourcesDesc: string;
  sourcesCta: string;

  privacyTitle: string;
  privacyDesc: string;

  finalEyebrow: string;
  finalTitle: string;
  finalDesc: string;
  finalExpress: string;
  finalAudit: string;
  finalLaunch: string;

  whatToolDoes: string[];
  whatToolDoesNot: string[];
  steps: Array<{ title: string; body: string }>;
  checklist: string[];
  rgpd: string[];
  sources: SourceItem[];
};

const COPY: Record<Lang, Copy> = {
  fr: {
    eyebrow: "Méthodologie",
    title: "Comment MPL Export Conseil calcule vos estimations",
    subtitle: "Transparence, limites et sources. Objectif : vous aider à décider vite — sans remplacer un expert.",

    ctaCall: "Appeler",
    ctaRequest: "Demander un diagnostic",
    ctaLaunch: "Lancer l’outil",

    whatDoesTitle: "Ce que l’outil fait",
    whatDoesDesc: "Un diagnostic rapide et structuré pour vous guider.",
    whatNotTitle: "Ce que l’outil ne fait pas",
    whatNotDesc: "Pour rester fiable, l’outil assume ses limites.",

    stepsTitle: "Étapes de calcul",
    stepsDesc: "Une logique simple, reproductible et actionnable.",
    stepLabel: "Étape",

    checklistTitle: "Checklist avant expédition",
    checklistDesc: "Un garde-fou décisionnel avant engagement.",

    tip: "Astuce : si vous êtes en DDP, vérifiez systématiquement qui supporte TVA + droits + frais de dédouanement, et comment la preuve d’export est conservée.",

    sourcesTitle: "Sources de veille",
    sourcesDesc: "Références utilisées comme repères (les contenus peuvent évoluer selon les pays/produits).",
    sourcesCta: "Voir la veille",

    privacyTitle: "RGPD & confidentialité",
    privacyDesc: "Transparence sur le traitement des données.",

    finalEyebrow: "Besoin d’une validation ?",
    finalTitle: "Validation express ou audit complet",
    finalDesc: "L’outil vous alerte. Ensuite, une revue humaine confirme (TVA, DDP, conformité, cas spécifiques).",
    finalExpress: "Validation express",
    finalAudit: "Demander un diagnostic",
    finalLaunch: "Lancer l’outil",

    whatToolDoes: [
      "Structurer un scénario export (destination, coûts, hypothèses).",
      "Calculer un landed cost indicatif à partir de vos données.",
      "Comparer des variantes (transport, incoterm, frais, quantités).",
      "Sortir une lecture décisionnelle : alertes, checklist, points d’attention.",
    ],
    whatToolDoesNot: [
      "Remplacer un conseil douane / transitaire (validation finale requise).",
      "Fournir automatiquement des taux officiels complets pour tous les pays/produits.",
      "Garantir l’exhaustivité juridique : la conformité dépend du produit et du contexte.",
    ],
    steps: [
      {
        title: "Saisie",
        body: "Vous renseignez les coûts et paramètres clés (destination, frais, quantités, incoterm).",
      },
      {
        title: "Calcul",
        body: "L’outil calcule le coût total, le coût unitaire et met en évidence les postes sensibles.",
      },
      {
        title: "Comparaison",
        body: "Vous comparez plusieurs scénarios (transport / incoterm / coûts) pour arbitrer.",
      },
      {
        title: "Décision",
        body: "Sortie actionnable : risques, checklist documents, rappel incoterms & points de vigilance.",
      },
    ],
    rgpd: [
      "Les scénarios gratuits restent dans votre navigateur (pas de stockage serveur imposé).",
      "Les demandes de diagnostic / audit sont traitées manuellement par MPL Export Conseil.",
      "Vous pouvez demander la suppression de vos informations à tout moment.",
    ],
    checklist: [
      "Incoterm choisi cohérent avec le modèle (EXW/FCA/CPT/CIP/DAP/DDP…).",
      "Facture : libellés, quantité, devise, HT/TTC, transport, assurance (si applicable).",
      "Destination : règles spécifiques (TVA, douane, particularités fiscales).",
      "Conformité : restrictions, sanctions, documents requis, preuve d’export (si besoin).",
    ],
    sources: [
      {
        label: "Douane.gouv.fr",
        url: "https://www.douane.gouv.fr/",
        note: "Références douanières, procédures, guides et informations pratiques (France).",
        tags: ["France", "douane"],
      },
      {
        label: "Access2Markets (UE)",
        url: "https://trade.ec.europa.eu/access-to-markets/",
        note: "Infos pays/produits : droits, formalités, exigences et accès au marché.",
        tags: ["UE", "marchés"],
      },
      {
        label: "Service-Public Pro",
        url: "https://entreprendre.service-public.fr/",
        note: "Infos pratiques pour entreprises (démarches, obligations, documents).",
        tags: ["entreprises", "démarches"],
      },
      {
        label: "Économie.gouv.fr",
        url: "https://www.economie.gouv.fr/",
        note: "Cadre réglementaire, actualités et politiques publiques (repères France).",
        tags: ["France", "réglementation"],
      },
      {
        label: "WTO / OMC — Latest News",
        url: "https://www.wto.org/english/news_e/news_e.htm",
        note: "Commerce international, mesures, tendances et annonces.",
        tags: ["international", "commerce"],
      },
    ],
  },

  en: {
    eyebrow: "Methodology",
    title: "How MPL Export Conseil calculates your estimates",
    subtitle: "Transparency, limits, and sources. Goal: help you decide fast — without replacing an expert.",

    ctaCall: "Call",
    ctaRequest: "Request a diagnostic",
    ctaLaunch: "Launch the tool",

    whatDoesTitle: "What the tool does",
    whatDoesDesc: "A quick, structured diagnostic to guide your decisions.",
    whatNotTitle: "What the tool does not do",
    whatNotDesc: "To remain reliable, the tool makes its limits explicit.",

    stepsTitle: "Calculation steps",
    stepsDesc: "A simple, repeatable, action-oriented approach.",
    stepLabel: "Step",

    checklistTitle: "Pre-shipment checklist",
    checklistDesc: "A decision safety net before you commit.",

    tip:
      "Tip: if you ship under DDP, always confirm who bears VAT + duties + clearance fees, and how proof of export is stored.",

    sourcesTitle: "Monitoring sources",
    sourcesDesc: "Reference sources used as guidance (content may evolve depending on countries/products).",
    sourcesCta: "View monitoring",

    privacyTitle: "GDPR & privacy",
    privacyDesc: "Transparency on how data is handled.",

    finalEyebrow: "Need confirmation?",
    finalTitle: "Fast validation or full audit",
    finalDesc:
      "The tool flags risks. Then a human review confirms (VAT, DDP, compliance, special cases).",
    finalExpress: "Fast validation",
    finalAudit: "Request a diagnostic",
    finalLaunch: "Launch the tool",

    whatToolDoes: [
      "Structure an export scenario (destination, costs, assumptions).",
      "Compute an indicative landed cost from your inputs.",
      "Compare variants (transport, incoterm, fees, quantities).",
      "Provide decision-ready outputs: alerts, checklist, key watch-outs.",
    ],
    whatToolDoesNot: [
      "Replace a customs broker / freight forwarder (final validation required).",
      "Automatically provide complete official rates for every country/product.",
      "Guarantee legal exhaustiveness: compliance depends on the product and context.",
    ],
    steps: [
      {
        title: "Input",
        body: "You enter key costs and parameters (destination, fees, quantities, incoterm).",
      },
      {
        title: "Compute",
        body: "The tool calculates total and unit costs and highlights sensitive cost drivers.",
      },
      {
        title: "Compare",
        body: "You compare scenarios (transport / incoterm / costs) to arbitrate.",
      },
      {
        title: "Decide",
        body: "Actionable output: risks, document checklist, incoterm reminders & watch points.",
      },
    ],
    rgpd: [
      "Free scenarios remain in your browser (no mandatory server storage).",
      "Diagnostic / audit requests are handled manually by MPL Export Conseil.",
      "You can request deletion of your information at any time.",
    ],
    checklist: [
      "Incoterm consistent with the scenario (EXW/FCA/CPT/CIP/DAP/DDP…).",
      "Invoice: description, quantity, currency, net/gross, transport, insurance (if applicable).",
      "Destination: specific rules (French overseas territories, local duties, tax specifics).",
      "Compliance: restrictions, sanctions, required documents, proof of export (if needed).",
    ],
    sources: [
      {
        label: "Douane.gouv.fr",
        url: "https://www.douane.gouv.fr/",
        note: "Customs references, procedures, guides and practical information (France).",
        tags: ["France", "customs"],
      },
      {
        label: "Access2Markets (EU)",
        url: "https://trade.ec.europa.eu/access-to-markets/",
        note: "Country/product info: duties, requirements, procedures and market access.",
        tags: ["EU", "markets"],
      },
      {
        label: "Service-Public Pro",
        url: "https://entreprendre.service-public.fr/",
        note: "Practical business information (steps, obligations, documents).",
        tags: ["business", "procedures"],
      },
      {
        label: "Economie.gouv.fr",
        url: "https://www.economie.gouv.fr/",
        note: "Regulatory framework, news and public policy guidance (France).",
        tags: ["France", "regulation"],
      },
      {
        label: "WTO — Latest News",
        url: "https://www.wto.org/english/news_e/news_e.htm",
        note: "International trade: measures, trends and announcements.",
        tags: ["international", "trade"],
      },
    ],
  },
};

export default function Methodologie() {
  const navigate = useNavigate();
  usePageMeta("meta.methodologie.title", "meta.methodologie.description");

  const phoneRaw = "0676435551";
  const phonePretty = "06 76 43 55 51";
  const emailMain = "contact@exportfrancefacile.com";

  // Route existante de ta veille
  const watchPath = "/watch";

  // Récupère la langue depuis ton LanguageContext (tolérant si le nom de la prop change)
  const i18n = useI18n() as unknown as { language?: string; lang?: string; locale?: string };
  const rawLang = (i18n.language ?? i18n.lang ?? i18n.locale ?? "fr").toLowerCase();
  const lang: Lang = rawLang.startsWith("en") ? "en" : "fr";
  const c = COPY[lang];

  return (
    <PublicLayout>
      <div className="mx-auto max-w-6xl space-y-10">
        {/* HERO */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-r from-blue-700 via-blue-950 to-red-600 p-7 text-white shadow-sm md:p-10">
          <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:radial-gradient(circle_at_20%_10%,white,transparent_45%),radial-gradient(circle_at_80%_35%,white,transparent_40%)]" />
          <div className="relative space-y-3">
            <p className="text-xs uppercase tracking-[0.35em] text-white/80">{c.eyebrow}</p>
            <h1 className="text-3xl font-semibold leading-tight md:text-4xl">{c.title}</h1>
            <p className="max-w-3xl text-base text-white/85 md:text-lg">{c.subtitle}</p>

            <div className="flex flex-wrap gap-2 pt-3">
              <Button
                asChild
                variant="secondary"
                className="rounded-full bg-white/95 text-slate-900 hover:bg-white"
              >
                <a href={`tel:${phoneRaw}`} className="inline-flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  {c.ctaCall} {phonePretty}
                </a>
              </Button>

              <Button
                asChild
                variant="secondary"
                className="rounded-full bg-white/15 text-white hover:bg-white/20"
              >
                <a href={`mailto:${emailMain}`} className="inline-flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {emailMain}
                </a>
              </Button>

              <Button
                asChild
                variant="outline"
                className="rounded-full border-white/40 text-white hover:bg-white/10"
              >
                <Link to="/contact">{c.ctaRequest}</Link>
              </Button>

              <Button asChild className="rounded-full bg-slate-950/40 hover:bg-slate-950/55">
                <Link to="/analyse">{c.ctaLaunch}</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* WHAT / WHAT NOT */}
        <section className="grid gap-6 lg:grid-cols-2">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-slate-900">{c.whatDoesTitle}</CardTitle>
              <CardDescription className="text-slate-600">{c.whatDoesDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              {c.whatToolDoes.map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                  <span>{item}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-slate-900">{c.whatNotTitle}</CardTitle>
              <CardDescription className="text-slate-600">{c.whatNotDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              {c.whatToolDoesNot.map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                  <span>{item}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        {/* STEPS + CHECKLIST */}
        <section className="grid gap-6 lg:grid-cols-2">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-slate-900">{c.stepsTitle}</CardTitle>
              <CardDescription className="text-slate-600">{c.stepsDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              {c.steps.map((s, idx) => (
                <div key={s.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2">
                    <Badge className="border-slate-200 bg-white text-slate-700">
                      {c.stepLabel} {idx + 1}
                    </Badge>
                    <div className="font-semibold text-slate-900">{s.title}</div>
                  </div>
                  <div className="mt-2 text-slate-700">{s.body}</div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-slate-900">{c.checklistTitle}</CardTitle>
              <CardDescription className="text-slate-600">{c.checklistDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              {c.checklist.map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <FileText className="mt-0.5 h-4 w-4 text-blue-700" />
                  <span>{item}</span>
                </div>
              ))}

              <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs text-slate-700">
                <div className="flex items-start gap-2">
                  <Info className="mt-0.5 h-4 w-4 text-blue-800" />
                  <span>{c.tip}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* SOURCES + PRIVACY */}
        <section className="grid gap-6 lg:grid-cols-2">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3 text-slate-900">
                <span>{c.sourcesTitle}</span>
                <Button asChild variant="outline" className="border-slate-200 text-slate-900 hover:bg-slate-50">
                  <Link to={watchPath}>{c.sourcesCta}</Link>
                </Button>
              </CardTitle>
              <CardDescription className="text-slate-600">{c.sourcesDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-700">
              {c.sources.map((s) => (
                <div key={s.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">{s.label}</div>
                      <div className="mt-1 text-slate-700">{s.note}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {s.tags.map((tag) => (
                          <Badge key={tag} className="border-slate-200 bg-white text-slate-700">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs uppercase tracking-[0.25em] text-slate-800 transition hover:bg-slate-50"
                      title={`Open ${s.label}`}
                      aria-label={`Open ${s.label} (new tab)`}
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open
                    </a>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-slate-900">{c.privacyTitle}</CardTitle>
              <CardDescription className="text-slate-600">{c.privacyDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              {c.rgpd.map((p) => (
                <div key={p} className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-600" />
                  <span>{p}</span>
                </div>
              ))}
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
                <div className="flex items-start gap-2">
                  <Info className="mt-0.5 h-4 w-4 text-slate-600" />
                  <span>
                    {lang === "fr"
                      ? "Besoin d’un cadre contractuel (NDA / confidentialité / clauses) : nous pouvons le mettre en place avant tout échange de données sensibles."
                      : "Need a contractual framework (NDA / confidentiality / clauses)? We can set it up before sharing any sensitive data."}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* FINAL CTA */}
        <section className="rounded-3xl border border-slate-200 bg-gradient-to-r from-blue-700 via-blue-950 to-red-600 p-6 text-white shadow-sm md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.25em] text-white/70">{c.finalEyebrow}</div>
              <div className="mt-1 text-2xl font-semibold">{c.finalTitle}</div>
              <div className="mt-2 max-w-2xl text-sm text-white/85">{c.finalDesc}</div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                variant="secondary"
                className="bg-white/95 text-slate-900 hover:bg-white"
                onClick={() => navigate("/contact?offer=express")}
              >
                {c.finalExpress}
              </Button>

              <Button
                variant="outline"
                className="border-white/60 text-white hover:bg-white/10"
                onClick={() => navigate("/contact")}
              >
                {c.finalAudit}
              </Button>

              <Button
                variant="outline"
                className="border-white/40 text-white hover:bg-white/10"
                onClick={() => navigate("/analyse")}
              >
                {c.finalLaunch}
              </Button>
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
