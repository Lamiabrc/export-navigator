import { Calculator, FolderPlus, Radar } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type QuickActionsProps = {
  isEn: boolean;
};

export function QuickActions({ isEn }: QuickActionsProps) {
  const copy = isEn
    ? {
        sectionTitle: "Quick Actions",
        sectionDesc: "Start the most useful export tasks in one click.",
        cards: [
          {
            title: "Create Export File",
            description: "Manage an export operation from A to Z.",
            cta: "New file",
            href: "/app/dossiers/new",
            icon: FolderPlus,
          },
          {
            title: "Simulate Taxes and Duties",
            description: "Calculate customs duties and VAT.",
            cta: "Tax simulation",
            href: "/app/taxes",
            icon: Calculator,
          },
          {
            title: "Enable Export Monitoring",
            description: "Track markets, routes and regulations.",
            cta: "Open monitoring",
            href: "/app/veille",
            icon: Radar,
          },
        ],
      }
    : {
        sectionTitle: "Actions rapides",
        sectionDesc: "Lancez les tâches export essentielles en un clic.",
        cards: [
          {
            title: "Créer un dossier export",
            description: "Piloter une opération export de A à Z.",
            cta: "Nouveau dossier",
            href: "/app/dossiers/new",
            icon: FolderPlus,
          },
          {
            title: "Simuler impôts et taxes",
            description: "Calculer droits de douane et TVA.",
            cta: "Simulation taxes",
            href: "/app/taxes",
            icon: Calculator,
          },
          {
            title: "Activer veille export",
            description: "Surveiller marchés, routes et réglementations.",
            cta: "Voir la veille",
            href: "/app/veille",
            icon: Radar,
          },
        ],
      };

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-slate-900">{copy.sectionTitle}</h2>
        <p className="text-sm text-slate-600">{copy.sectionDesc}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {copy.cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} className="border-slate-200 bg-white shadow-sm">
              <CardHeader className="space-y-3 pb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-base text-slate-900">{card.title}</CardTitle>
                  <CardDescription className="text-sm text-slate-600">{card.description}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link to={card.href}>{card.cta}</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
