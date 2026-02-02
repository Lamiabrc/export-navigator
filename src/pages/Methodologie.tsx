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
    label: "Économie.gouv.fr",
    url: "https://www.economie.gouv.fr/",
    note: "Cadre réglementaire, actualités et politiques publiques (repères France).",
    tags: ["France", "réglementation"],
  },
  {
    label: "Service-Public Pro",
    url: "https://entreprendre.service-public.fr/",
    note: "Infos pratiques pour entreprises (démarches, obligations, documents).",
    tags: ["entreprises", "démarches"],
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
  "Les demandes d’audit sont traitées manuellement par MPL Export Conseil.",
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

  // Change si ton routeur utilise une autre route (ex: /veille)
  const watchPath = "/watch";

  return (
    <PublicLayout>
      <div className="mx-auto max-w-6xl space-y-10">
        {/* HERO */}
        <section className="space-y-3 text-white">
          <p className="text-xs uppercase tracking-[0.35em] text-blue-200">Méthodologie</p>
          <h1 className="text-4xl font-semibold">Comment MPL Export Conseil calcule vos estimations</h1>
          <p className="text-lg text-slate-200">
            Transparence, limites et sources. Objectif : vous aider à décider vite — sans remplacer un expert.
          </p>

          {/* CTA quick */}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button asChild variant="secondary" className="rounded-full">
              <a href={`tel:${phoneRaw}`} className="inline-flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Appeler {phonePretty}
              </a>
            </Button>

            <Button asChild variant="secondary" className="rounded-full">
              <a href={`mailto:${emailMain}`} className="inline-flex items-center gap-2">
                <Mail className="h-4 w-4" />
                {emailMain}
              </a>
            </Button>

            <Button asChild variant="outline" className="rounded-full border-white/30 text-white hover:bg-white/10">
              <Link to="/contact">Demander un audit</Link>
            </Button>

            <Button asChild className="rounded-full">
              <Link to="/analyse">Lancer l’outil</Link>
            </Button>
          </div>
        </section>

        {/* WHAT / WHAT NOT */}
        <section className="grid gap-6 lg:grid-cols-2">
          <Card className="border border-white/15 bg-white/10 text-white backdrop-blur">
            <CardHeader>
              <CardTitle>Ce que l’outil fait</CardTitle>
              <CardDescription className="text-slate-200">
                Un diagnostic rapide et structuré pour vous guider.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-200">
              {whatToolDoes.map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-200" />
                  <span>{item}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border border-white/15 bg-white/10 text-white backdrop-blur">
            <CardHeader>
              <CardTitle>Ce que l’outil ne fait pas</CardTitle>
              <CardDescription className="text-slate-200">
                Pour rester fiable, l’outil assume ses limites.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-200">
              {whatToolDoesNot.map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-200" />
                  <span>{item}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        {/* STEPS + CHECKLIST */}
        <section className="grid gap-6 lg:grid-cols-2">
          <Card className="border border-white/15 bg-white/10 text-white backdrop-blur">
            <CardHeader>
              <CardTitle>Étapes de calcul</CardTitle>
              <CardDescription className="text-slate-200">
                Une logique simple, reproductible et actionnable.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-200">
              {steps.map((s, idx) => (
                <div key={s.title} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center gap-2">
                    <Badge className="border-white/20 bg-white/10 text-white">Étape {idx + 1}</Badge>
                    <div className="font-semibold text-white">{s.title}</div>
                  </div>
                  <div className="mt-2 text-slate-200/90">{s.body}</div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border border-white/15 bg-white/10 text-white backdrop-blur">
            <CardHeader>
              <CardTitle>Checklist avant expédition</CardTitle>
              <CardDescription className="text-slate-200">
                Un garde-fou décisionnel avant engagement.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-200">
              {checklist.map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <FileText className="mt-0.5 h-4 w-4 text-blue-200" />
                  <span>{item}</span>
                </div>
              ))}

              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-slate-200/90">
                <div className="flex items-start gap-2">
                  <Info className="mt-0.5 h-4 w-4 text-white/70" />
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
          <Card className="border border-white/15 bg-white/10 text-white backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3">
                <span>Sources de veille</span>
                <Button asChild variant="outline" className="border-white/20 text-white hover:bg-white/10">
                  <Link to={watchPath}>Voir la veille</Link>
                </Button>
              </CardTitle>
              <CardDescription className="text-slate-200">
                Références utilisées comme repères (les contenus peuvent évoluer selon les pays/produits).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-200">
              {sources.map((s) => (
                <div key={s.label} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">{s.label}</div>
                      <div className="mt-1 text-slate-200/90">{s.note}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {s.tags.map((tag) => (
                          <Badge key={tag} className="border-white/20 bg-white/10 text-white">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs uppercase tracking-[0.25em] text-white/90 transition hover:bg-white/15"
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

          <Card className="border border-white/15 bg-white/10 text-white backdrop-blur">
            <CardHeader>
              <CardTitle>RGPD & confidentialité</CardTitle>
              <CardDescription className="text-slate-200">
                Transparence sur le traitement des données.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-200">
              {rgpd.map((p) => (
                <div key={p} className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-200" />
                  <span>{p}</span>
                </div>
              ))}
              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-slate-200/90">
                <div className="flex items-start gap-2">
                  <Info className="mt-0.5 h-4 w-4 text-white/70" />
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
        <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-blue-700 via-blue-900 to-red-600 p-6 text-white">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.25em] text-white/70">Besoin d’une validation ?</div>
              <div className="mt-1 text-2xl font-semibold">Validation express ou audit complet</div>
              <div className="mt-2 text-sm text-white/80">
                L’outil vous alerte. Ensuite, une revue humaine confirme (TVA, DDP, conformité, cas spécifiques).
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => navigate("/contact?offer=express")}>
                Validation express
              </Button>

              <Button
                variant="outline"
                className="border-white text-white hover:bg-white/10"
                onClick={() => navigate("/contact")}
              >
                Demander un audit
              </Button>

              <Button
                variant="outline"
                className="border-white/70 text-white hover:bg-white/10"
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
