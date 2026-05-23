import { BriefcaseBusiness, Calculator, FolderPlus, Handshake, MapPinned, Mail, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type QuickActionsProps = {
  isEn: boolean;
  isAuthenticated: boolean;
};

export function QuickActions({ isEn, isAuthenticated }: QuickActionsProps) {
  const copy = isAuthenticated
    ? isEn
      ? {
          sectionTitle: "Start trading France-Maghreb",
          sectionDesc: "Three simple actions to find an opportunity, price it, then follow the operation.",
          cards: [
            {
              title: "Create an import/export file",
              description: "Track one real deal: product, country, Incoterm, margin and next actions.",
              cta: "New file",
              href: "/app/dossiers/new",
              icon: FolderPlus,
            },
            {
              title: "Manage announcements",
              description: "Publish curated France, Morocco, Algeria and Tunisia opportunities from the private workspace.",
              cta: "Open business board",
              href: "/app/mise-en-relation",
              icon: Handshake,
            },
            {
              title: "Analyze costs and margin",
              description: "Check transport, duties, taxes and margin before accepting the deal.",
              cta: "Calculate costs",
              href: "/app/simulator",
              icon: Calculator,
            },
          ],
        }
      : {
          sectionTitle: "Piloter l'accompagnement France-Maghreb",
          sectionDesc: "Trois actions simples pour publier une annonce, chiffrer une affaire puis suivre l'operation.",
          cards: [
            {
              title: "Creer un dossier import-export",
              description: "Suivre une affaire concrete: produit, pays, Incoterm, marge et prochaines actions.",
              cta: "Nouveau dossier",
              href: "/app/dossiers/new",
              icon: FolderPlus,
            },
            {
              title: "Gerer les annonces",
              description: "Publier les opportunites qualifiees France, Maroc, Algerie et Tunisie depuis l'espace prive.",
              cta: "Ouvrir le board business",
              href: "/app/mise-en-relation",
              icon: Handshake,
            },
            {
              title: "Analyser couts et marge",
              description: "Verifier transport, droits, taxes et marge avant d'accepter l'affaire.",
              cta: "Calculer les couts",
              href: "/app/simulator",
              icon: Calculator,
            },
          ],
        }
    : isEn
      ? {
          sectionTitle: "Import-export support between France and the Maghreb",
          sectionDesc: "A clear offer: understand the opportunity, check costs and documents, then get guided toward the next action.",
          cards: [
            {
              title: "Browse curated opportunities",
              description: "Buyer requests, suppliers, distributors and service partners selected for France-Maghreb trade.",
              cta: "See announcements",
              href: "/coin-business",
              icon: MapPinned,
            },
            {
              title: "Request support",
              description: "Need to import, export, distribute or source? Send the project and get a guided answer.",
              cta: "Contact MPL",
              href: "/contact",
              icon: Mail,
            },
            {
              title: "Ask the AI copilot",
              description: "Get a first answer on customs, Incoterms, documents or market approach.",
              cta: "Open copilot",
              href: "/copilote",
              icon: Sparkles,
            },
          ],
        }
      : {
          sectionTitle: "Accompagnement import-export France-Maghreb",
          sectionDesc: "Une offre claire: comprendre l'opportunite, verifier couts/documents, puis avancer avec la bonne action.",
          cards: [
            {
              title: "Consulter les annonces qualifiees",
              description: "Demandes acheteurs, fournisseurs, distributeurs et partenaires selectionnes pour France-Maghreb.",
              cta: "Voir les annonces",
              href: "/coin-business",
              icon: MapPinned,
            },
            {
              title: "Demander un accompagnement",
              description: "Importer, exporter, distribuer ou sourcer: envoyez le projet pour obtenir un cadrage concret.",
              cta: "Contacter MPL",
              href: "/contact",
              icon: Mail,
            },
            {
              title: "Demander au copilote IA",
              description: "Obtenir une premiere reponse sur douane, Incoterms, documents ou approche marche.",
              cta: "Ouvrir le copilote",
              href: "/copilote",
              icon: Sparkles,
            },
          ],
        };

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-slate-900">{copy.sectionTitle}</h2>
          <p className="text-sm text-slate-600">{copy.sectionDesc}</p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
          <BriefcaseBusiness className="h-3.5 w-3.5" />
          France | Maroc | Algerie | Tunisie
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {copy.cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} className="border-slate-200 bg-white shadow-sm">
              <CardHeader className="space-y-3 pb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
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
