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
          sectionTitle: "Run your export operations",
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
              description: "Publish curated opportunities from the private workspace.",
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
          sectionTitle: "Piloter vos operations export",
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
              description: "Publier les opportunites qualifiees depuis l'espace prive.",
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
          sectionTitle: "AI for your export team, in three steps",
          sectionDesc: "A clear offer: a quote and scoping, a tailored workshop on your real cases, then follow-up sessions.",
          cards: [
            {
              title: "Discover the AI & Export workshop",
              description: "Half a day or a full day on your own products, markets and documents, with the team already in place.",
              cta: "See the workshop",
              href: "/pricing",
              icon: MapPinned,
            },
            {
              title: "Request a quote",
              description: "Tell us about your products, your markets and your team: the quote starts from there.",
              cta: "Contact MPL",
              href: "/contact?offer=atelier",
              icon: Mail,
            },
            {
              title: "Who supports you",
              description: "Export field experience since 2018, law and regulation, and AI for export teams.",
              cta: "About Lamia Bréchet",
              href: "/about",
              icon: Sparkles,
            },
          ],
        }
      : {
          sectionTitle: "L'IA pour votre équipe export, en trois temps",
          sectionDesc: "Une offre claire : un devis et un cadrage, un atelier sur mesure sur vos cas réels, puis des demi-journées de suivi.",
          cards: [
            {
              title: "Découvrir l'atelier IA & Export",
              description: "Une demi-journée ou une journée sur vos produits, vos marchés et vos documents, avec l'équipe déjà en place.",
              cta: "Voir l'atelier",
              href: "/pricing",
              icon: MapPinned,
            },
            {
              title: "Demander un devis",
              description: "Présentez vos produits, vos marchés et votre équipe : le devis part de là.",
              cta: "Contacter MPL",
              href: "/contact?offer=atelier",
              icon: Mail,
            },
            {
              title: "Qui vous accompagne",
              description: "Le terrain export depuis 2018, le droit et la réglementation, et l'IA au service des équipes export.",
              cta: "Découvrir Lamia Bréchet",
              href: "/about",
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
          {isEn ? "AI & Export" : "IA & Export"}
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
