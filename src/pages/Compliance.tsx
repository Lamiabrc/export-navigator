import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, FileCheck2, BookOpen, BellRing, Target } from "lucide-react";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";

type ActionItem = {
  title: string;
  description: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  cta: string;
};

const ACTIONS: ActionItem[] = [
  {
    title: "Vérifier une facture",
    description: "Contrôle rapide : cohérence facture, Incoterm, HS code, taxes.",
    to: "/app/invoice-check",
    icon: FileCheck2,
    cta: "Ouvrir le contrôle",
  },
  {
    title: "Veille réglementaire",
    description: "Sanctions, douanes, contraintes pays et signaux utiles.",
    to: "/app/centre-veille/reglementation",
    icon: BellRing,
    cta: "Voir la veille",
  },
  {
    title: "Guides pratiques",
    description: "Incoterms, documents, TVA/taxes import, risques & bonnes pratiques.",
    to: "/guides/incoterms-ddp",
    icon: BookOpen,
    cta: "Parcourir les guides",
  },
];

export default function Compliance() {
  const { labels, variables } = useGlobalFilters();
  const destinationLabel =
    (labels?.territory_label?.trim() || "") ||
    (String(variables?.territory_code || "").trim() || "");

  return (
    <AppLayout>
      <div className="space-y-6">
        <section className="rounded-3xl border border-border bg-card/95 p-6 shadow-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl space-y-2">
              <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground">
                Centre conformité
              </p>
              <h1 className="text-3xl font-semibold font-display text-foreground">
                Conformité export, claire et actionnable.
              </h1>
              <p className="text-sm text-muted-foreground">
                Vérifiez documents, risques pays, sanctions et obligations avant expédition.
              </p>

              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Priorité : avant expédition</Badge>
                <Badge variant="outline">
                  Destination : {destinationLabel ? destinationLabel : "à définir"}
                </Badge>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild className="gap-2">
                <Link to="/app/control-tower">
                  <Target className="h-4 w-4" />
                  Paramétrer mon profil
                </Link>
              </Button>
              <Button asChild variant="outline" className="gap-2">
                <Link to="/app/simulator">
                  <ShieldCheck className="h-4 w-4" />
                  Simuler un coût
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
            <CardDescription>Les points qui évitent 80% des blocages.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <ul className="list-disc space-y-2 pl-5">
              <li>HS code cohérent (4 à 6 chiffres minimum, idéalement 8/10 selon le flux)</li>
              <li>Incoterm clarifié + cohérence facture / transport / assurances</li>
              <li>Destination confirmée + restrictions (sanctions, licences, contrôles)</li>
              <li>Documents : facture, packing list, origine (si applicable), document transport</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
