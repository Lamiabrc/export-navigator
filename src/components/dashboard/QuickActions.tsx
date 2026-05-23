import { BriefcaseBusiness, Calculator, FolderPlus, Handshake, MapPinned, Sparkles, UserPlus } from "lucide-react";
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
              title: "Find a buyer or supplier",
              description: "Use the business corner for France, Morocco, Algeria and Tunisia opportunities.",
              cta: "Open business board",
              href: "/app/mise-en-relation",
              icon: Handshake,
            },
            {
              title: "Estimate the landed cost",
              description: "Check transport, duties, taxes and margin before accepting the deal.",
              cta: "Calculate costs",
              href: "/app/simulator",
              icon: Calculator,
            },
          ],
        }
      : {
          sectionTitle: "Demarrer un business France-Maghreb",
          sectionDesc: "Trois actions simples pour trouver une opportunite, la chiffrer puis suivre l'operation.",
          cards: [
            {
              title: "Creer un dossier import-export",
              description: "Suivre une affaire concrete: produit, pays, Incoterm, marge et prochaines actions.",
              cta: "Nouveau dossier",
              href: "/app/dossiers/new",
              icon: FolderPlus,
            },
            {
              title: "Trouver acheteur ou fournisseur",
              description: "Utiliser le coin business pour les opportunites France, Maroc, Algerie et Tunisie.",
              cta: "Ouvrir le board business",
              href: "/app/mise-en-relation",
              icon: Handshake,
            },
            {
              title: "Estimer le cout rendu",
              description: "Verifier transport, droits, taxes et marge avant d'accepter l'affaire.",
              cta: "Calculer les couts",
              href: "/app/simulator",
              icon: Calculator,
            },
          ],
        }
    : isEn
      ? {
          sectionTitle: "A simple business tool for France-Maghreb trade",
          sectionDesc: "Browse opportunities first, then create a free account when you want to publish or manage a deal.",
          cards: [
            {
              title: "Explore opportunities",
              description: "Buyer requests, suppliers, distributors and service partners between France and the Maghreb.",
              cta: "See the board",
              href: "/coin-business",
              icon: MapPinned,
            },
            {
              title: "Publish a business need",
              description: "Looking to buy, sell, import, export or distribute? Post it from a free account.",
              cta: "Create free account",
              href: publishLink,
              icon: UserPlus,
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
          sectionTitle: "Un outil business simple pour commercer France-Maghreb",
          sectionDesc: "Consultez les opportunites, puis creez un compte gratuit pour publier ou piloter une affaire.",
          cards: [
            {
              title: "Explorer les opportunites",
              description: "Demandes acheteurs, fournisseurs, distributeurs et partenaires entre France et Maghreb.",
              cta: "Voir le board",
              href: "/coin-business",
              icon: MapPinned,
            },
            {
              title: "Publier un besoin business",
              description: "Acheter, vendre, importer, exporter ou distribuer: publiez depuis un compte gratuit.",
              cta: "Creer un compte gratuit",
              href: publishLink,
              icon: UserPlus,
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
