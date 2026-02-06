import * as React from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, FileCheck2, BookOpen, BellRing, Target } from "lucide-react";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";

const ACTIONS = [
  {
    title: "Verifier une facture",
    description: "Controle rapide des incoherences, HS, incoterm, TVA.",
    to: "/app/invoice-check",
    icon: FileCheck2,
    cta: "Ouvrir le controle",
  },
  {
    title: "Veille reglementaire",
    description: "Sanctions, douanes, contraintes pays et signaux utiles.",
    to: "/app/centre-veille/reglementation",
    icon: BellRing,
    cta: "Voir la veille",
  },
  {
    title: "Guides pratiques",
    description: "Incoterms, TVA import, documents, risques export.",
    to: "/guides/incoterms-ddp",
    icon: BookOpen,
    cta: "Parcourir les guides",
  },
];

export default function Compliance() {
  const { labels, variables } = useGlobalFilters();
  const destinationLabel = labels.territory_label || variables.territory_code || null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <section className="rounded-3xl border border-border bg-card/95 p-6 shadow-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl space-y-2">
              <p className="text-xs tracking-[0.2em] font-semibold text-muted-foreground">Centre conformite</p>
              <h1 className="text-3xl font-semibold font-display text-foreground">
                Conformite export, claire et actionnable.
              </h1>
              <p className="text-sm text-muted-foreground">
                Controle des documents, risques pays, sanctions et obligations avant expedition.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Priorite : pre-shipment</Badge>
                {destinationLabel ? (
                  <Badge variant="outline">Destination : {destinationLabel}</Badge>
                ) : (
                  <Badge variant="outline">Destination : a definir</Badge>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild className="gap-2">
                <Link to="/app/control-tower">
                  <Target className="h-4 w-4" />
                  Regler le profil
                </Link>
              </Button>
              <Button asChild variant="outline" className="gap-2">
                <Link to="/app/simulator">
                  <ShieldCheck className="h-4 w-4" />
                  Simuler un cout
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-3">
          {ACTIONS.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.title} className="card-hover">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Icon className="h-5 w-5" />
                    {item.title}
                  </CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="secondary">
                    <Link to={item.to}>{item.cta}</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Checklist avant envoi</CardTitle>
            <CardDescription>Les points qui evitent 80% des blocages.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div>- HS code complet (4 a 6 chiffres minimum)</div>
            <div>- Incoterm clarifie et coherences facture/transport</div>
            <div>- Pays de destination + restrictions (sanctions, licences)</div>
            <div>- Documents: facture, packing list, origine, transport</div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
