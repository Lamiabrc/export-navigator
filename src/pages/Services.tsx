import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";

import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePageMeta } from "@/hooks/usePageMeta";

const offers = [
  {
    title: "Diagnostic",
    description: "Premier échange structuré pour qualifier vos flux et vos priorités.",
    details: ["Prise de contact", "Cadrage des enjeux", "Feuille de route initiale"],
  },
  {
    title: "Audit & plan d’amélioration",
    description: "Service principal: audit des procédures import/export et plan d’actions concret.",
    details: ["Risques TVA/douane", "Procédures et documents", "Plan d’amélioration priorisé"],
    highlighted: true,
  },
  {
    title: "Pilotage",
    description: "Abonnement au tour de contrôle pour suivre l’exécution et les décisions.",
    details: ["Suivi continu", "Historique décisions", "Checklists opérationnelles"],
  },
];

export default function ServicesPage() {
  usePageMeta("meta.services.title", "meta.services.description", { brandSuffix: "Export Navigator" });

  return (
    <MarketingLayout>
      <section className="mkt-section mkt-section-hero">
        <div className="mkt-container space-y-6">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Offre</p>
          <h1 className="text-4xl font-semibold text-slate-900 sm:text-5xl">
            Audit d’abord. Outil ensuite.
          </h1>
          <p className="max-w-3xl text-base leading-relaxed text-slate-600 sm:text-lg">
            Nous vendons d’abord un audit de vos procédures import/export et de vos risques fiscaux/douaniers. Puis,
            nous déployons le tour de contrôle pour exécuter le plan et garder un pilotage constant.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/contact">Nous contacter</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/register">S’inscrire gratuitement</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 md:grid-cols-3">
          {offers.map((offer) => (
            <Card
              key={offer.title}
              className={offer.highlighted ? "border-primary/40 ring-1 ring-primary/20" : "border-slate-200"}
            >
              <CardHeader>
                <CardTitle>{offer.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-slate-600">{offer.description}</p>
                <ul className="space-y-2 text-sm text-slate-700">
                  {offer.details.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-col gap-2 pt-2">
                  <Button asChild>
                    <Link to="/contact">Nous contacter</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to="/register">S’inscrire gratuitement</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="pb-16">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 lg:grid-cols-2">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>Ce que couvre l’audit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-700">
              <p>TVA (règles, preuves, facturation, points d’alerte)</p>
              <p>Douane (classement, origine, valeur, contrôles)</p>
              <p>Incoterms, paiement, documents, sanctions et zones sensibles</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>Pourquoi ensuite l’outil</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-700">
              <p>Suivi continu du plan d’amélioration</p>
              <p>Historique des décisions et des actions</p>
              <p>Checklists et livrables opérationnels dans un espace unique</p>
            </CardContent>
          </Card>
        </div>
      </section>
    </MarketingLayout>
  );
}
