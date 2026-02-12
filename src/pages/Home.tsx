import { Link } from "react-router-dom";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePageMeta } from "@/hooks/usePageMeta";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Globe,
  Radar,
  SearchCheck,
  ShieldCheck,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";

const valueCards = [
  {
    icon: ShieldCheck,
    title: "Go / No-Go Export",
    line1: "Vendez / ne vendez pas / vendez sous conditions.",
    line2: "Score risque + recommandations + checklist.",
  },
  {
    icon: Wallet,
    title: "Sécuriser le paiement",
    line1: "Choisissez le bon mode (LC, CAD, OA…).",
    line2: "Réduisez le risque d’impayé.",
  },
  {
    icon: TrendingUp,
    title: "Prix export (Landed Cost)",
    line1: "Coût complet + marge + prix cible.",
    line2: "Export PDF/CSV (Pro).",
  },
  {
    icon: FileText,
    title: "Documents & conformité",
    line1: "Contrôle facture / packing / mentions.",
    line2: "Corrections + modèles de mail.",
  },
];

const audiences = [
  "PME & commerciaux export",
  "ADV export / import",
  "Consultants & responsables conformité",
];

export default function Home() {
  usePageMeta("meta.home.title", "meta.home.description", {
    brandSuffix: "Export Navigator",
  });

  return (
    <PublicLayout>
      <main className="mx-auto max-w-6xl space-y-16 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <section className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <Badge variant="secondary" className="w-fit rounded-full px-3 py-1 text-xs">
              Tour de contrôle import-export
            </Badge>
            <div className="space-y-4">
              <h1 className="text-balance text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                Décidez vite. Exportez sans erreurs.
              </h1>
              <p className="max-w-2xl text-lg text-slate-600">
                Un copilote pro pour sécuriser vos ventes à l’international: Go/No-Go pays, paiement, Incoterms,
                documents et prix export (landed cost).
              </p>
            </div>
            <ul className="space-y-2 text-slate-700">
              {[
                "Un verdict clair + 3 actions immédiates.",
                "Checklists et messages prêts à envoyer.",
                "Historique sécurisé + plan d’objectifs.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="sm:min-w-52">
                <Link to="/register">
                  Essayer gratuitement <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="sm:min-w-52">
                <Link to="/pricing#plans">Payer en ligne et démarrer</Link>
              </Button>
            </div>
            <p className="text-sm text-slate-500">
              Données confidentielles. Suppression à tout moment. Purge automatique selon politique de rétention.
            </p>
          </div>

          <Card className="border-slate-200 bg-gradient-to-br from-slate-50 to-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Radar className="size-5 text-primary" />
                Mock — Rapport Go/No-Go
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-700">
              <div className="rounded-xl border bg-white p-3">
                <p className="font-medium">Pays: Maroc • Produit: Machines</p>
                <p className="text-emerald-700">Verdict: GO sous conditions</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border bg-white p-3">
                  <p className="text-slate-500">Risque</p>
                  <p className="font-semibold">42 / 100</p>
                </div>
                <div className="rounded-lg border bg-white p-3">
                  <p className="text-slate-500">Livrables</p>
                  <p className="font-semibold">Checklist + email client</p>
                </div>
              </div>
              <p className="text-sm text-slate-200">
                Rapport orienté décision: risques TVA/douane, actions prioritaires, livrables et suivi d’exécution.
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-900">Ce que vous obtenez (en 60 secondes)</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {valueCards.map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.title} className="h-full border-slate-200">
                  <CardHeader className="space-y-3 pb-3">
                    <Icon className="size-6 text-primary" />
                    <CardTitle className="text-base">{card.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-slate-600">
                    <p>{card.line1}</p>
                    <p>{card.line2}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-900">Comment ça marche</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              "Vous renseignez le pays, le produit et votre scénario.",
              "On analyse risques, coûts et obligations.",
              "Vous repartez avec un plan d’actions + des livrables prêts à envoyer.",
            ].map((step, index) => (
              <Card key={step} className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base">
                    <span className="mr-2 inline-flex size-6 items-center justify-center rounded-full bg-primary/10 text-sm text-primary">
                      {index + 1}
                    </span>
                    Étape {index + 1}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-600">{step}</CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-900">Pour qui</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {audiences.map((audience) => (
              <Card key={audience} className="border-slate-200">
                <CardContent className="flex items-center gap-3 p-5 text-slate-700">
                  <Target className="size-5 text-primary" />
                  <span className="font-medium">{audience}</span>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-slate-600">
            Que vous débutiez ou que vous gériez déjà plusieurs pays, l’objectif est le même: gagner du temps,
            éviter les erreurs, sécuriser les marges.
          </p>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <p className="text-sm font-medium uppercase tracking-wide text-primary">Prospection (playbook inclus)</p>
          <h2 className="text-2xl font-semibold text-slate-900">
            Trouver des clients à l’international, sans s’éparpiller.
          </h2>
          <ul className="space-y-2 text-slate-700">
            <li className="flex gap-2">
              <Globe className="mt-0.5 size-5 shrink-0 text-primary" />
              Méthode ICP (profil client idéal) + liste cible
            </li>
            <li className="flex gap-2">
              <SearchCheck className="mt-0.5 size-5 shrink-0 text-primary" />
              Séquence email 3 relances + message LinkedIn
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
              Objections: prix, délais, risque — réponses prêtes
            </li>
          </ul>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-2xl font-semibold text-slate-900">Voir l’outil en vidéo</h2>
          <p className="max-w-3xl text-slate-600">
            Démonstration rapide de la tour de contrôle, de l’analyse facture et du calcul de coûts export.
          </p>
          <video className="w-full rounded-xl border border-slate-200" controls preload="metadata" poster="/videos/hero-export.jpg">
            <source src="/videos/hero-export.mp4" type="video/mp4" />
            <source src="/videos/hero-export.webm" type="video/webm" />
            Votre navigateur ne supporte pas la lecture vidéo.
          </video>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 p-6">
          <h2 className="text-2xl font-semibold text-slate-900">Vos données sont confidentielles.</h2>
          <p className="max-w-3xl text-slate-600">
            Vos informations sont protégées par des règles d’accès strictes. Vous pouvez supprimer vos données à
            tout moment. Les données inactives sont automatiquement purgées selon notre politique de rétention.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link to="/legal">En savoir plus</Link>
            </Button>
            <Button asChild variant="ghost" className="text-slate-700">
              <a href="mailto:privacy@exportnavigator.example?subject=Suppression%20de%20mes%20donn%C3%A9es">
                Supprimer mes données
              </a>
            </Button>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl bg-slate-900 p-8 text-white">
          <h2 className="text-3xl font-semibold">Prêt à sécuriser votre prochain deal export ?</h2>
          <p className="text-slate-200">Lancez un Go/No-Go en 60 secondes.</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" variant="secondary" className="sm:min-w-48">
              <Link to="/register">Démarrer maintenant</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10 sm:min-w-48">
              <Link to="/pricing">Voir les tarifs</Link>
            </Button>
          </div>
        </section>

      </main>
    </PublicLayout>
  );
}
