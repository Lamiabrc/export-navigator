import { Link } from "react-router-dom";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useI18n } from "@/contexts/LanguageContext";
import heroExportVideo from "@/assets/hero-export.mp4";
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

export default function Home() {
  const { lang } = useI18n();
  const isEn = lang === "en";
  const audiences = isEn
    ? ["SMEs & export sales teams", "Export / import operations", "Consultants & compliance managers"]
    : ["PME & commerciaux export", "ADV export / import", "Consultants & responsables conformité"];

  const valueCards = isEn
    ? [
        {
          icon: ShieldCheck,
          title: "Go / No-Go Export",
          line1: "Sell / do not sell / sell with conditions.",
          line2: "Risk score + recommendations + checklist.",
        },
        {
          icon: Wallet,
          title: "Secure payment",
          line1: "Choose the right method (LC, CAD, OA…).",
          line2: "Reduce non-payment risk.",
        },
        {
          icon: TrendingUp,
          title: "Export pricing (Landed Cost)",
          line1: "Full cost + margin + target price.",
          line2: "PDF/CSV export (Pro).",
        },
        {
          icon: FileText,
          title: "Documents & compliance",
          line1: "Invoice / packing list / mention checks.",
          line2: "Corrections + email templates.",
        },
      ]
    : [
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
  usePageMeta("meta.home.title", "meta.home.description", {
    brandSuffix: "Export Navigator",
  });

  return (
    <PublicLayout>
      <main className="mx-auto max-w-6xl space-y-16 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/70 p-6 sm:p-8 lg:p-10">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-r from-primary/5 via-transparent to-emerald-500/5" />
          <div className="relative grid items-start gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:gap-10">
            <div className="space-y-6">
              <Badge variant="secondary" className="w-fit rounded-full px-3 py-1 text-xs">{isEn ? "Export control tower" : "Tour de contrôle export"}</Badge>
              <div className="space-y-4">
                <h1 className="text-balance text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">{isEn ? "Export control tower? Go/No-Go in 60 seconds." : "Tour de contrôle export ? Go/No-Go en 60 secondes."}</h1>
                <p className="max-w-2xl text-lg text-slate-600">{isEn ? "A professional cockpit to secure your international deals: country Go/No-Go, payment, Incoterms, documents and landed cost." : "Un cockpit pro pour sécuriser vos ventes à l’international : Go/No-Go pays, paiement, Incoterms, documents et prix export (landed cost)."}</p>
              </div>
              <ul className="space-y-2 text-slate-700">
                {[
                  isEn ? "A clear verdict + 3 immediate actions." : "Un verdict clair + 3 actions immédiates.",
                  isEn ? "Checklists and ready-to-send messages." : "Checklists et messages prêts à envoyer.",
                  isEn ? "Secure history + action plan." : "Historique sécurisé + plan d’objectifs.",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button asChild size="lg" className="sm:min-w-60">
                  <a href="#hero-video">
                    {isEn ? "Watch the demo video" : "Voir la vidéo de démo"} <ArrowRight className="ml-2 size-4" />
                  </a>
                </Button>
                <Button asChild variant="outline" size="lg" className="sm:min-w-52">
                  <Link to="/login?next=%2Fapp%2Fcontrol-tower">{isEn ? "Open the control tower" : "Accéder au tour de contrôle"}</Link>
                </Button>
                <Button asChild variant="ghost" size="lg" className="justify-start px-0 text-slate-700 hover:text-slate-900 sm:px-4">
                  <Link to="/contact">{isEn ? "Contact us for a quote" : "Nous contacter pour devis"}</Link>
                </Button>
              </div>
              <p className="text-sm text-slate-500">{isEn ? "Control tower available after sign-in only. Confidential data · EU hosting · GDPR." : "Tour de contrôle accessible uniquement après connexion. Données confidentielles · Hébergement UE · RGPD."}</p>
            </div>

            <div className="space-y-4">
              <Card className="border-slate-200 bg-white shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Radar className="size-5 text-primary" />
                    {isEn ? "Mock — Go/No-Go report" : "Mock — Rapport Go/No-Go"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-slate-700">
                  <div className="rounded-xl border bg-slate-50 p-3">
                    <p className="font-medium">{isEn ? "Country: Morocco • Product: Machinery" : "Pays: Maroc • Produit: Machines"}</p>
                    <p className="text-emerald-700">{isEn ? "Verdict: GO with conditions" : "Verdict: GO sous conditions"}</p>
                  </div>
                  <div className="grid gap-2 grid-cols-2">
                    <div className="rounded-lg border bg-white p-3">
                      <p className="text-slate-500">{isEn ? "Risk" : "Risque"}</p>
                      <p className="font-semibold">42 / 100</p>
                    </div>
                    <div className="rounded-lg border bg-white p-3">
                      <p className="text-slate-500">{isEn ? "Deliverables" : "Livrables"}</p>
                      <p className="font-semibold">{isEn ? "Checklist + client email" : "Checklist + email client"}</p>
                    </div>
                  </div>
                  <div className="rounded-lg border bg-white p-3">
                    <p className="font-semibold text-slate-900">{isEn ? "Action 1: Validate Incoterm + insurance" : "Action 1 : Vérifier Incoterm + assurance"}</p>
                  </div>
                  <p className="text-sm text-slate-600">
                    {isEn ? "Decision-oriented report: VAT/customs risks, priority actions, deliverables and execution follow-up." : "Rapport orienté décision : risques TVA/douane, actions prioritaires, livrables et suivi d’exécution."}
                  </p>
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

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-900">{isEn ? "What you get (in 60 seconds)" : "Ce que vous obtenez (en 60 secondes)"}</h2>
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
          <h2 className="text-2xl font-semibold text-slate-900">{isEn ? "How it works" : "Comment ça marche"}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              isEn ? "You provide country, product, and scenario." : "Vous renseignez le pays, le produit et votre scénario.",
              isEn ? "We analyze risks, costs, and obligations." : "On analyse risques, coûts et obligations.",
              isEn ? "You leave with an action plan + ready-to-send deliverables." : "Vous repartez avec un plan d’actions + des livrables prêts à envoyer.",
            ].map((step, index) => (
              <Card key={step} className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base">
                    <span className="mr-2 inline-flex size-6 items-center justify-center rounded-full bg-primary/10 text-sm text-primary">
                      {index + 1}
                    </span>
                    {isEn ? "Step" : "Étape"} {index + 1}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-600">{step}</CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-900">{isEn ? "Who it's for" : "Pour qui"}</h2>
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
            {isEn ? "Whether you are just starting or already managing multiple countries, the goal stays the same: save time, avoid mistakes, protect margins." : "Que vous débutiez ou que vous gériez déjà plusieurs pays, l’objectif est le même: gagner du temps, éviter les erreurs, sécuriser les marges."}
          </p>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <p className="text-sm font-medium uppercase tracking-wide text-primary">{isEn ? "Prospecting (playbook included)" : "Prospection (playbook inclus)"}</p>
          <h2 className="text-2xl font-semibold text-slate-900">
            {isEn ? "Find international clients without losing focus." : "Trouver des clients à l’international, sans s’éparpiller."}
          </h2>
          <ul className="space-y-2 text-slate-700">
            <li className="flex gap-2">
              <Globe className="mt-0.5 size-5 shrink-0 text-primary" />
              {isEn ? "ICP method (ideal customer profile) + target list" : "Méthode ICP (profil client idéal) + liste cible"}
            </li>
            <li className="flex gap-2">
              <SearchCheck className="mt-0.5 size-5 shrink-0 text-primary" />
              {isEn ? "Email sequence with 3 follow-ups + LinkedIn message" : "Séquence email 3 relances + message LinkedIn"}
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
              {isEn ? "Objections: price, lead-time, risk — ready answers" : "Objections: prix, délais, risque — réponses prêtes"}
            </li>
          </ul>
        </section>

        <section id="hero-video" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-2xl font-semibold text-slate-900">{isEn ? "See the tool in video" : "Voir l’outil en vidéo"}</h2>
          <p className="max-w-3xl text-slate-600">
            {isEn ? "Quick demo of control tower, invoice check and export costing." : "Démonstration rapide de la tour de contrôle, de l’analyse facture et du calcul de coûts export."}
          </p>
          <video className="w-full rounded-xl border border-slate-200" controls preload="metadata">
            <source src={heroExportVideo} type="video/mp4" />
            {isEn ? "Your browser does not support video playback." : "Votre navigateur ne supporte pas la lecture vidéo."}
          </video>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 p-6">
          <h2 className="text-2xl font-semibold text-slate-900">{isEn ? "Your data is confidential." : "Vos données sont confidentielles."}</h2>
          <p className="max-w-3xl text-slate-600">
            {isEn ? "Your information is protected by strict access rules. You can delete your data at any time. Inactive data is automatically purged according to our retention policy." : "Vos informations sont protégées par des règles d’accès strictes. Vous pouvez supprimer vos données à tout moment. Les données inactives sont automatiquement purgées selon notre politique de rétention."}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link to="/legal">{isEn ? "Learn more" : "En savoir plus"}</Link>
            </Button>
            <Button asChild variant="ghost" className="text-slate-700">
              <a href="mailto:privacy@exportnavigator.example?subject=Suppression%20de%20mes%20donn%C3%A9es">
                {isEn ? "Delete my data" : "Supprimer mes données"}
              </a>
            </Button>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl bg-slate-900 p-8 text-white">
          <h2 className="text-3xl font-semibold">{isEn ? "Ready to secure your next export deal?" : "Prêt à sécuriser votre prochain deal export ?"}</h2>
          <p className="text-slate-200">{isEn ? "Run a Go/No-Go in 60 seconds." : "Lancez un Go/No-Go en 60 secondes."}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" variant="secondary" className="sm:min-w-48">
              <Link to="/register">{isEn ? "Start now" : "Démarrer maintenant"}</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10 sm:min-w-48">
              <Link to="/pricing">{isEn ? "View pricing" : "Voir les tarifs"}</Link>
            </Button>
          </div>
        </section>

      </main>
    </PublicLayout>
  );
}
