export type GuideEntry = {
  slug: string;
  title: string;
  intro: string;
  mistakes: string[];
  ctaLabel: string;
  incoterm?: string;
};

export const GUIDES: GuideEntry[] = [
  {
    slug: "incoterms-ddp",
    title: "Incoterm DDP: coûts, risques, points de vigilance",
    intro:
      "Le DDP engage le vendeur sur la totalité des coûts et risques à l'import. C'est le scénario le plus exigeant.",
    mistakes: [
      "Sous-estimer les formalités locales d'import.",
      "Oublier la TVA et les droits dans le prix de vente.",
      "Ne pas vérifier la capacité à dédouaner localement.",
    ],
    ctaLabel: "Simuler un DDP",
    incoterm: "DDP",
  },
  {
    slug: "incoterms-dap",
    title: "Incoterm DAP: qui paie quoi ?",
    intro: "Le DAP impose au vendeur d'amener la marchandise au point de livraison, mais l'import reste à la charge de l'acheteur.",
    mistakes: [
      "Confondre DAP et DDP sur les obligations d'import.",
      "Ne pas clarifier le lieu de livraison exact.",
      "Oublier de chiffrer le pré-acheminement.",
    ],
    ctaLabel: "Analyser un DAP",
    incoterm: "DAP",
  },
  {
    slug: "tva-import",
    title: "TVA à l'import: anticiper l'impact cash",
    intro: "La TVA import peut impacter fortement la trésorerie. Elle reste manuelle dans l'outil pour éviter toute erreur.",
    mistakes: [
      "Utiliser un taux standard sans vérifier le régime applicable.",
      "Oublier que la TVA s'applique sur valeur + droits + transport.",
      "Ne pas documenter le choix du régime (autoliquidation, report, etc.).",
    ],
    ctaLabel: "Estimer le landed cost",
  },
  {
    slug: "droits-douane",
    title: "Droits de douane: comment sécuriser vos estimations",
    intro: "Les droits varient selon le code HS et les accords commerciaux. L'outil vous aide à structurer les hypothèses.",
    mistakes: [
      "Utiliser un code HS incomplet ou approximatif.",
      "Ignorer les accords préférentiels disponibles.",
      "Ne pas conserver la preuve d'origine.",
    ],
    ctaLabel: "Calculer avec vos taux",
  },
  {
    slug: "documents-export",
    title: "Documents export: checklist essentielle",
    intro: "Facture, packing list, certificat d'origine, transport... La documentation conditionne la fluidité douanière.",
    mistakes: [
      "Envoyer des documents incohérents entre eux.",
      "Oublier les exigences spécifiques pays (certificats, licences).",
      "Ne pas vérifier les conditions de transport.",
    ],
    ctaLabel: "Vérifier votre scénario",
  },
  {
    slug: "assurance-transport",
    title: "Assurance transport: protéger la marge",
    intro: "L'assurance représente souvent un faible coût, mais peut éviter une perte majeure en cas d'incident.",
    mistakes: [
      "N'assurer que le fret principal en oubliant la valeur marchandise.",
      "Oublier de préciser les garanties (ICC A/B/C).",
      "Ne pas aligner l'assurance avec l'incoterm choisi.",
    ],
    ctaLabel: "Ajouter l'assurance",
  },
  {
    slug: "strategie-prix-export",
    title: "Stratégie de prix export: sécuriser la marge",
    intro: "Un prix export solide intègre tous les coûts logistiques et douaniers. La simulation facilite la décision.",
    mistakes: [
      "Omettre les coûts indirects dans le prix.",
      "Fixer une marge sans tenir compte du risque pays.",
      "Ne pas comparer plusieurs scénarios.",
    ],
    ctaLabel: "Comparer les scénarios",
  },
  {
    slug: "transport-maritime",
    title: "Transport maritime: anticiper les surcoûts",
    intro: "Le maritime reste économique, mais expose aux congestions et surcharges. Anticipez ces variations.",
    mistakes: [
      "Oublier les surcharges saisonnières.",
      "Sous-estimer les délais de transit.",
      "Ne pas prévoir de marge sur le fret principal.",
    ],
    ctaLabel: "Simuler un transport mer",
  },
  {
    slug: "transport-aerien",
    title: "Transport aérien: quand le temps prime",
    intro: "L'aérien coûte plus cher mais réduit le cycle cash. Utile pour les urgences ou produits à forte valeur.",
    mistakes: [
      "Ne pas comparer l'impact marge vs délai.",
      "Oublier les limitations de poids/volume.",
      "Ignorer les contraintes douanières sur l'aérien.",
    ],
    ctaLabel: "Simuler un transport air",
  },
  {
    slug: "export-control",
    title: "Export control: anticiper les restrictions",
    intro: "Sanctions, embargo, dual-use: certaines marchandises sont réglementées. La veille vous alerte.",
    mistakes: [
      "Ne pas identifier les pays sensibles.",
      "Oublier de documenter la classification.",
      "Ignorer les restrictions de réexportation.",
    ],
    ctaLabel: "Vérifier vos risques",
  },
  {
    slug: "incoterms-cif",
    title: "Incoterm CIF: obligations et assurance",
    intro: "Le CIF impose au vendeur de payer fret et assurance jusqu'au port d'arrivée, mais le risque transfert plus tôt.",
    mistakes: [
      "Confondre point de transfert de risque et lieu de livraison.",
      "Ne pas vérifier les garanties d'assurance.",
      "Oublier les coûts portuaires à destination.",
    ],
    ctaLabel: "Simuler un CIF",
    incoterm: "CIF",
  },
  {
    slug: "incoterms-fca",
    title: "Incoterm FCA: clarifier le point de remise",
    intro: "Le FCA est flexible, mais la responsabilité se joue au point de remise. Tout doit être défini.",
    mistakes: [
      "Ne pas préciser le lieu exact de remise.",
      "Oublier les coûts de chargement selon le lieu.",
      "Ignorer la coordination avec le transport principal.",
    ],
    ctaLabel: "Simuler un FCA",
    incoterm: "FCA",
  },
];

export function getGuideBySlug(slug: string | undefined | null): GuideEntry | null {
  if (!slug) return null;
  const candidate = String(slug).trim().toLowerCase();
  return GUIDES.find((guide) => guide.slug === candidate) ?? null;
}

export function getFeaturedGuides(limit = 3, excludeSlug?: string) {
  const filtered = excludeSlug ? GUIDES.filter((guide) => guide.slug !== excludeSlug) : GUIDES;
  return filtered.slice(0, limit);
}
