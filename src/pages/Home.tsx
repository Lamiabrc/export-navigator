import { Link } from "react-router-dom";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePageMeta } from "@/hooks/usePageMeta";
import { CheckCircle2, ClipboardCheck, FileSearch, ShieldCheck, TrendingUp } from "lucide-react";

const deliverables = [
  {
    icon: FileSearch,
    title: "État des lieux & audit",
    description: "Procédures, documents, TVA/douane, Incoterms, paiement.",
  },
  {
    icon: ShieldCheck,
    title: "Risques fiscaux & conformité",
    description: "Points de vigilance TVA, preuves, incohérences.",
  },
  {
    icon: TrendingUp,
    title: "Plan d’amélioration",
    description: "Quick wins + procédures simplifiées + templates.",
  },
  {
    icon: ClipboardCheck,
    title: "Tour de contrôle",
    description: "Suivi des objectifs + décisions Go/No-Go + historique.",
  },
];

export default function Home() {
  usePageMeta("meta.home.title", "meta.home.description", {
    brandSuffix: "Export Navigator",
  });

  return (
    <PublicLayout>
      <main className="mx-auto max-w-6xl space-y-16 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <section className="grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <Badge variant="secondary" className="w-fit rounded-full px-3 py-1 text-xs">
              Audit import-export & risques fiscaux
            </Badge>

            <div className="space-y-4">
              <h1 className="text-balance text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                Sécurisez vos procédures import-export avant d’outiller.
              </h1>
              <p className="max-w-2xl text-lg text-slate-600">
                Nous réalisons un état des lieux de vos procédures (TVA/douane/documents/paiement), puis nous mettons
                en place un plan d’amélioration et un tour de contrôle.
              </p>
            </div>

            <ul className="space-y-2 text-slate-700">
              {[
                "Analyse des risques fiscaux (TVA) et douaniers",
                "Plan d’amélioration + checklists + modèles",
                "Tour de contrôle pour suivre vos actions",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="sm:min-w-52">
                <Link to="/contact">Nous contacter</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="sm:min-w-52">
                <Link to="/register">S’inscrire gratuitement</Link>
              </Button>
            </div>

            <p className="text-sm text-slate-500">
              Données confidentielles • Suppression à tout moment • Purge automatique selon politique de rétention
            </p>
          </div>

          <Card className="overflow-hidden border-slate-200 bg-slate-950 text-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Aperçu — audit + tour de contrôle</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="overflow-hidden rounded-xl border border-white/20 bg-black/20">
                <video
                  className="h-56 w-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                  poster="/videos/hero-export.jpg"
                >
                  <source src="/videos/hero-export.webm" type="video/webm" />
                  <source src="/videos/hero-export.mp4" type="video/mp4" />
                </video>
              </div>
              <p className="text-sm text-slate-200">
                Rapport orienté décision: risques TVA/douane, actions prioritaires, livrables et suivi d’exécution.
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-900">Ce que vous obtenez</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {deliverables.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.title} className="h-full border-slate-200">
                  <CardHeader className="space-y-3 pb-3">
                    <Icon className="size-6 text-primary" />
                    <CardTitle className="text-base">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-slate-600">{item.description}</CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-900">Comment ça marche</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              "Vous nous contactez",
              "On réalise l’audit et on vous remet un plan",
              "Vous pilotez avec le tour de contrôle",
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

        <section className="space-y-4 rounded-2xl border border-slate-200 p-6">
          <h2 className="text-2xl font-semibold text-slate-900">Vos données sont confidentielles.</h2>
          <p className="max-w-3xl text-slate-600">
            Accès strict, suppression à tout moment, purge automatique selon la politique de rétention.
          </p>
        </section>

        <section className="space-y-4 rounded-2xl bg-slate-900 p-8 text-white">
          <h2 className="text-3xl font-semibold">Demander un état des lieux</h2>
          <p className="text-slate-200">Audit d’abord, outillage ensuite — avec un plan concret.</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" variant="secondary" className="sm:min-w-48">
              <Link to="/contact">Nous contacter</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/40 text-white hover:bg-white/10 sm:min-w-48"
            >
              <Link to="/register">S’inscrire gratuitement</Link>
            </Button>
          </div>
        </section>
      </main>
    </PublicLayout>
  );
}
