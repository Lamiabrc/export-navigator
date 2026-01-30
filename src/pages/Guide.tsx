import React from "react";
import { useParams } from "react-router-dom";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const GUIDE_CONTENT: Record<string, { title: string; intro: string; mistakes: string[]; ctaLabel: string; incoterm?: string }> = {
  "incoterms-ddp": {
    title: "Incoterm DDP: couts, risques, points de vigilance",
    intro: "Le DDP engage le vendeur sur la totalite des couts et risques a l'import. C'est le scenario le plus exigeant.",
    mistakes: [
      "Sous-estimer les formalites locales d'import.",
      "Oublier la TVA et les droits dans le prix de vente.",
      "Ne pas verifier la capacite a dedouaner localement.",
    ],
    ctaLabel: "Simuler un DDP",
    incoterm: "DDP",
  },
  "incoterms-dap": {
    title: "Incoterm DAP: qui paie quoi ?",
    intro: "Le DAP impose au vendeur d'amener la marchandise au point de livraison, mais l'import reste a la charge de l'acheteur.",
    mistakes: [
      "Confondre DAP et DDP sur les obligations d'import.",
      "Ne pas clarifier le lieu de livraison exact.",
      "Oublier de chiffrer le pre-acheminement.",
    ],
    ctaLabel: "Analyser un DAP",
    incoterm: "DAP",
  },
  "tva-import": {
    title: "TVA a l'import: anticiper l'impact cash",
    intro: "La TVA import peut impacter fortement la tresorerie. Elle reste manuelle dans l'outil pour eviter toute erreur.",
    mistakes: [
      "Utiliser un taux standard sans verifier le regime applicable.",
      "Oublier que la TVA s'applique sur valeur + droits + transport.",
      "Ne pas documenter le choix du regime (autoliquidation, report, etc.).",
    ],
    ctaLabel: "Estimer le landed cost",
  },
  "droits-douane": {
    title: "Droits de douane: comment securiser vos estimations",
    intro: "Les droits varient selon le code HS et les accords commerciaux. L'outil vous aide a structurer les hypotheses.",
    mistakes: [
      "Utiliser un code HS incomplet ou approximatif.",
      "Ignorer les accords preferentiels disponibles.",
      "Ne pas conserver la preuve d'origine.",
    ],
    ctaLabel: "Calculer avec vos taux",
  },
  "documents-export": {
    title: "Documents export: checklist essentielle",
    intro: "Facture, packing list, certificat d'origine, transport... La documentation conditionne la fluidite douaniere.",
    mistakes: [
      "Envoyer des documents incoherents entre eux.",
      "Oublier les exigences specifiques pays (certificats, licences).",
      "Ne pas verifier les conditions de transport.",
    ],
    ctaLabel: "Verifier votre scenario",
  },
  "assurance-transport": {
    title: "Assurance transport: proteger la marge",
    intro: "L'assurance represente souvent un faible cout, mais peut eviter une perte majeure en cas d'incident.",
    mistakes: [
      "N'assurer que le fret principal en oubliant la valeur marchandise.",
      "Oublier de preciser les garanties (ICC A/B/C).",
      "Ne pas aligner l'assurance avec l'incoterm choisi.",
    ],
    ctaLabel: "Ajouter l'assurance",
  },
  "strategie-prix-export": {
    title: "Strategie de prix export: securiser la marge",
    intro: "Un prix export solide integre tous les couts logistiques et douaniers. La simulation facilite la decision.",
    mistakes: [
      "Omettre les couts indirects dans le prix.",
      "Fixer une marge sans tenir compte du risque pays.",
      "Ne pas comparer plusieurs scenarios.",
    ],
    ctaLabel: "Comparer les scenarios",
  },
  "transport-maritime": {
    title: "Transport maritime: anticiper les surcouts",
    intro: "Le maritime reste economique, mais expose aux congestions et surcharges. Anticipez ces variations.",
    mistakes: [
      "Oublier les surcharges saisonnieres.",
      "Sous-estimer les delais de transit.",
      "Ne pas prevoir de marge sur le fret principal.",
    ],
    ctaLabel: "Simuler un transport mer",
  },
  "transport-aerien": {
    title: "Transport aerien: quand le temps prime",
    intro: "L'aerien coute plus cher mais reduit le cycle cash. Utile pour les urgences ou produits a forte valeur.",
    mistakes: [
      "Ne pas comparer l'impact marge vs delai.",
      "Oublier les limitations de poids/volume.",
      "Ignorer les contraintes douanieres sur l'aerien.",
    ],
    ctaLabel: "Simuler un transport air",
  },
  "export-control": {
    title: "Export control: anticiper les restrictions",
    intro: "Sanctions, embargo, dual-use: certaines marchandises sont reglementees. La veille vous alerte.",
    mistakes: [
      "Ne pas identifier les pays sensibles.",
      "Oublier de documenter la classification.",
      "Ignorer les restrictions de reexportation.",
    ],
    ctaLabel: "Verifier vos risques",
  },
  "incoterms-cif": {
    title: "Incoterm CIF: obligations et assurance",
    intro: "Le CIF impose au vendeur de payer fret et assurance jusqu'au port d'arrivee, mais le risque transfert plus tot.",
    mistakes: [
      "Confondre point de transfert de risque et lieu de livraison.",
      "Ne pas verifier les garanties d'assurance.",
      "Oublier les couts portuaires a destination.",
    ],
    ctaLabel: "Simuler un CIF",
    incoterm: "CIF",
  },
  "incoterms-fca": {
    title: "Incoterm FCA: clarifier le point de remise",
    intro: "Le FCA est flexible, mais la responsabilite se joue au point de remise. Tout doit etre defini.",
    mistakes: [
      "Ne pas preciser le lieu exact de remise.",
      "Oublier les couts de chargement selon le lieu.",
      "Ignorer la coordination avec le transport principal.",
    ],
    ctaLabel: "Simuler un FCA",
    incoterm: "FCA",
  },
};

export default function Guide() {
  const params = useParams();
  const slug = params.slug || "";
  const content = GUIDE_CONTENT[slug];

  if (!content) {
    return (
      <PublicLayout>
        <Card className="border border-white/15 bg-white/10 text-white backdrop-blur">
          <CardHeader>
            <CardTitle>Guide introuvable</CardTitle>
            <CardDescription className="text-slate-200">Ce guide n'existe pas.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => (window.location.href = "/analyse")}>Analyser un export</Button>
          </CardContent>
        </Card>
      </PublicLayout>
    );
  }

  const ctaUrl = content.incoterm
    ? `/analyse?incoterm=${content.incoterm}`
    : "/analyse";

  return (
    <PublicLayout>
      <div className="space-y-8">
        <section className="space-y-3 text-white">
          <p className="text-xs uppercase tracking-[0.35em] text-blue-200">Guide export</p>
          <h1 className="text-4xl font-semibold">{content.title}</h1>
          <p className="text-lg text-slate-200">{content.intro}</p>
        </section>

        <Card className="border border-white/15 bg-white/10 text-white backdrop-blur">
          <CardHeader>
            <CardTitle>Erreurs frequentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-slate-200">
            {content.mistakes.map((mistake) => (
              <div key={mistake} className="flex items-start gap-2">
                <Badge className="bg-white/10 text-white border-white/20">Risque</Badge>
                <span>{mistake}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-blue-700 via-blue-900 to-red-600 p-6 text-white">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.25em] text-white/70">Passez a l'action</div>
              <div className="text-2xl font-semibold">{content.ctaLabel}</div>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => (window.location.href = ctaUrl)}>
                Analyser un export
              </Button>
              <Button
                variant="outline"
                className="border-white text-white hover:bg-white/10"
                onClick={() => (window.location.href = "/contact")}
              >
                Demander un audit
              </Button>
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
