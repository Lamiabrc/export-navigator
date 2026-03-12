import { BriefcaseBusiness, FolderPlus, Radar, Sparkles, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type QuickActionsProps = {
  isEn: boolean;
  isAuthenticated: boolean;
};

export function QuickActions({ isEn, isAuthenticated }: QuickActionsProps) {
  const publishLink = isAuthenticated
    ? "/coin-business#publier"
    : `/register?next=${encodeURIComponent("/coin-business#publier")}`;

  const copy = isAuthenticated
    ? isEn
      ? {
          sectionTitle: "Quick Actions",
          sectionDesc: "Push the most useful account actions right after the hero.",
          cards: [
            {
              title: "Create Export File",
              description: "Manage an export operation from A to Z.",
              cta: "New file",
              href: "/app/dossiers/new",
              icon: FolderPlus,
            },
            {
              title: "Publish Opportunity",
              description: "Post a buyer request, sourcing need or partnership offer.",
              cta: "Open business corner",
              href: "/coin-business#publier",
              icon: BriefcaseBusiness,
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
          sectionDesc: "Mettez en avant les actions les plus utiles des la sortie du hero.",
          cards: [
            {
              title: "Creer un dossier export",
              description: "Piloter une operation export de A a Z.",
              cta: "Nouveau dossier",
              href: "/app/dossiers/new",
              icon: FolderPlus,
            },
            {
              title: "Publier une proposition",
              description: "Diffusez un besoin acheteur, un sourcing ou une offre de partenariat.",
              cta: "Ouvrir le coin business",
              href: "/coin-business#publier",
              icon: BriefcaseBusiness,
            },
            {
              title: "Activer veille export",
              description: "Surveiller marches, routes et reglementations.",
              cta: "Voir la veille",
              href: "/app/veille",
              icon: Radar,
            },
          ],
        }
    : isEn
      ? {
          sectionTitle: "Quick Actions",
          sectionDesc: "Give visitors a clear reason to register instead of bouncing.",
          cards: [
            {
              title: "Create Free Account",
              description: "Publish opportunities, unlock the free tools and centralize your export actions.",
              cta: "Create account",
              href: publishLink,
              icon: UserPlus,
            },
            {
              title: "Explore Business Corner",
              description: "Browse buyer requests, distributor searches and partnership offers.",
              cta: "See opportunities",
              href: "/coin-business",
              icon: BriefcaseBusiness,
            },
            {
              title: "Try AI Copilot",
              description: "Start with a free answer before building your export pipeline.",
              cta: "Open copilot",
              href: "/copilote",
              icon: Sparkles,
            },
          ],
        }
      : {
          sectionTitle: "Actions rapides",
          sectionDesc: "Donnez une raison claire de creer un compte au lieu de perdre la visite.",
          cards: [
            {
              title: "Creer mon compte gratuit",
              description: "Publier des propositions, debloquer les outils gratuits et centraliser les actions export.",
              cta: "Creer un compte",
              href: publishLink,
              icon: UserPlus,
            },
            {
              title: "Explorer le coin business",
              description: "Consulter des recherches acheteurs, distributeurs et partenariats.",
              cta: "Voir les propositions",
              href: "/coin-business",
              icon: BriefcaseBusiness,
            },
            {
              title: "Tester le copilote IA",
              description: "Obtenir une premiere reponse gratuite avant de construire le pipeline export.",
              cta: "Ouvrir le copilote",
              href: "/copilote",
              icon: Sparkles,
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
