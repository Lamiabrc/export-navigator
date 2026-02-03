import { Link, useNavigate } from "react-router-dom";

import { PublicLayout } from "@/components/layout/PublicLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePageMeta } from "@/hooks/usePageMeta";

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

type SourceItem = {
  label: string;
  url: string;
  note: string;
  tags: string[];
};

const sources: SourceItem[] = [
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
];

const whatToolDoes = [
  "Structurer un scénario export (destination, coûts, hypothèses).",
  "Calculer un landed cost indicatif à partir de vos données.",
  "Comparer des variantes (transport, incoterm, frais, quantités).",
  "Sortir une lecture décisionnelle : alertes, checklist, points d’attention.",
];

const whatToolDoesNot = [
  "Remplacer un conseil douane / transitaire (validation finale requise).",
  "Fournir automatiquement des taux officiels complets pour tous les pays/produits.",
  "Garantir l’exhaustivité juridique : la conformité dépend du produit et du contexte.",
];

const steps = [
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
];

const rgpd = [
  "Les scénarios gratuits restent dans votre navigateur (pas de stockage serveur imposé).",
  "Les demandes de diagnostic / audit sont traitées manuellement par MPL Export Conseil.",
  "Vous pouvez demander la suppression de vos informations à tout moment.",
];

const checklist = [
  "Incoterm choisi cohérent avec le modèle (EXW/FCA/CPT/CIP/DAP/DDP…).",
  "Facture : libellés, quantité, devise, HT/TTC, transport, assurance (si applicable).",
  "Destination : règles spécifiques (DROM, OM, octroi, particularités fiscales).",
  "Conformité : restrictions, sanctions, documents requis, preuve d’export (si besoin).",
];

export default function Methodologie() {
  const navigate = useNavigate();
  usePageMeta("meta.methodologie.title", "meta.methodologie.description");

  const phoneRaw = "0676435551";
  const phonePretty = "06 76 43 55 51";
  const emailMain = "contact@exportfrancefacile.com";

  // Change si ton routeur utilise une autre route (ex: /watch-center)
  const watchPath = "/watch";

  return (
    <PublicLayout>
      <div className="mx-auto max-w-6xl space-y-10">
        {/* HERO (contraste garanti même sur layout clair) */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-r from-blue-700 via-blue-950 to-red-600 p-7 text-white shadow-sm md:p-10">
          <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:radial-gradient(circle_at_20%_10%,white,transparent_45%),radial-gradient(circle_at_80%_35%,white,transparent_40%)]" />
          <div className="relative space-y-3">
            <p className="text-xs uppercase tracking-[0.35em] text-white/80">Méthodologie</p>
            <h1 className="text-3xl font-semibold leading-tight md:text-4xl">
              Comment MPL Export Conseil calcule vos estimations
            </h1>
            <p className="max-w-3xl text-base text-white/85 md:text-lg">
              Transparence, limites et sources. Objectif : vous aider à décider vite — sans remplacer un expert.
            </p>

            <div className="flex flex-wrap gap-2 pt-3">
              <Button
                asChild
                variant="secondary"
                className="rounded-full bg-white/95 text-slate-900 hover:bg-white"
              >
                <a href={`tel:${phoneRaw}`} className="inline-flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Appeler {phonePretty}
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
                <Link to="/contact">Demander un diagnostic</Link>
              </Button>

              <Button asChild className="rounded-full bg-slate-950/40 hover:bg-slate-950/55">
                <Link to="/analyse">Lancer l’outil</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* WHAT / WHAT NOT */}
        <section className="grid gap-6 lg:grid-cols-2">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-slate-900">Ce que l’outil fait</CardTitle>
              <CardDescription className="text-slate-600">
                Un diagnostic rapide et structuré pour vous guider.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              {whatToolDoes.map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                  <span>{item}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-slate-900">Ce que l’outil ne fait pas</CardTitle>
              <CardDescription className="text-slate-600">
                Pour rester fiable, l’outil assume ses limites.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              {whatToolDoesNot.map((item) => (
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
              <CardTitle className="text-slate-900">Étapes de calcul</CardTitle>
              <CardDescription className="text-slate-600">
                Une logique simple, reproductible et actionnable.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              {steps.map((s, idx) => (
                <div key={s.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2">
                    <Badge className="border-slate-200 bg-white text-slate-700">Étape {idx + 1}</Badge>
                    <div className="font-semibold text-slate-900">{s.title}</div>
                  </div>
                  <div className="mt-2 text-slate-700">{s.body}</div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-slate-900">Checklist avant expédition</CardTitle>
              <CardDescription className="text-slate-600">
                Un garde-fou décisionnel avant engagement.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              {checklist.map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <FileText className="mt-0.5 h-4 w-4 text-blue-700" />
                  <span>{item}</span>
                </div>
              ))}

              <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs text-slate-700">
                <div className="flex items-start gap-2">
                  <Info className="mt-0.5 h-4 w-4 text-blue-800" />
                  <span>
                    Astuce : si vous êtes en <strong>DDP</strong>, vérifiez systématiquement qui supporte{" "}
                    <strong>TVA + droits + frais de dédouanement</strong>, et comment la{" "}
                    <strong>preuve d’export</strong> est conservée.
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* SOURCES + RGPD */}
        <section className="grid gap-6 lg:grid-cols-2">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3 text-slate-900">
                <span>Sources de veille</span>
                <Button asChild variant="outline" className="border-slate-200 text-slate-900 hover:bg-slate-50">
                  <Link to={watchPath}>Voir la veille</Link>
                </Button>
              </CardTitle>
              <CardDescription className="text-slate-600">
                Références utilisées comme repères (les contenus peuvent évoluer selon les pays/produits).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-700">
              {sources.map((s) => (
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
                      title={`Ouvrir ${s.label}`}
                      aria-label={`Ouvrir ${s.label} (nouvel onglet)`}
                    >
                      <ExternalLink className="h-4 w-4" />
                      Ouvrir
                    </a>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-slate-900">RGPD & confidentialité</CardTitle>
              <CardDescription className="text-slate-600">Transparence sur le traitement des données.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              {rgpd.map((p) => (
                <div key={p} className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-600" />
                  <span>{p}</span>
                </div>
              ))}
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
                <div className="flex items-start gap-2">
                  <Info className="mt-0.5 h-4 w-4 text-slate-600" />
                  <span>
                    Besoin d’un cadre contractuel (NDA / confidentialité / clauses) : nous pouvons le mettre en place
                    avant tout échange de données sensibles.
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* CTA */}
        <section className="rounded-3xl border border-slate-200 bg-gradient-to-r from-blue-700 via-blue-950 to-red-600 p-6 text-white shadow-sm md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.25em] text-white/70">Besoin d’une validation ?</div>
              <div className="mt-1 text-2xl font-semibold">Validation express ou audit complet</div>
              <div className="mt-2 max-w-2xl text-sm text-white/85">
                L’outil vous alerte. Ensuite, une revue humaine confirme (TVA, DDP, conformité, cas spécifiques).
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                variant="secondary"
                className="bg-white/95 text-slate-900 hover:bg-white"
                onClick={() => navigate("/contact?offer=express")}
              >
                Validation express
              </Button>

              <Button
                variant="outline"
                className="border-white/60 text-white hover:bg-white/10"
                onClick={() => navigate("/contact")}
              >
                Demander un diagnostic
              </Button>

              <Button
                variant="outline"
                className="border-white/40 text-white hover:bg-white/10"
                onClick={() => navigate("/analyse")}
              >
                Lancer l’outil
              </Button>
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
