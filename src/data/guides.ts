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
    title: "Incoterm DDP : coûts, risques, points de vigilance",
    intro:
      "Le DDP engage le vendeur sur la totalité des coûts et risques à l'import. C'est le scénario le plus exigeant en process et trésorerie.",
    mistakes: [
      "Sous-estimer les formalités locales d'import et les taxes locales.",
      "Oublier la TVA et les droits dans le prix de vente (base douane incorrecte).",
      "Ne pas vérifier la capacité à dédouaner localement (EORI / représentant fiscal).",
    ],
    ctaLabel: "Simuler un DDP",
    incoterm: "DDP",
  },
  {
    slug: "incoterms-dap",
    title: "Incoterm DAP : qui paie quoi ?",
    intro:
      "Le DAP impose au vendeur d'amener la marchandise au point de livraison, mais l'import reste à la charge de l'acheteur.",
    mistakes: [
      "Confondre DAP et DDP sur les obligations d'import.",
      "Ne pas clarifier le lieu exact de livraison (adresse / zone).",
      "Oublier de chiffrer le transport principal et la manutention.",
    ],
    ctaLabel: "Analyser un DAP",
    incoterm: "DAP",
  },
  {
    slug: "incoterms-choisir",
    title: "Choisir le bon Incoterm : méthode simple",
    intro:
      "Le bon Incoterm dépend du niveau de contrôle souhaité, du transport et de la capacité à gérer les formalités douanières.",
    mistakes: [
      "Choisir un Incoterm pour 'faire plaisir' sans maîtriser les coûts.",
      "Utiliser le même Incoterm pour tous les clients / destinations.",
      "Ne pas documenter qui paie le transport, l'assurance et les taxes.",
    ],
    ctaLabel: "Comparer les scénarios",
  },
  {
    slug: "tva-import",
    title: "TVA à l'import : anticiper l'impact cash",
    intro:
      "La TVA import peut impacter fortement la trésorerie. Elle reste manuelle dans l'outil pour éviter toute erreur.",
    mistakes: [
      "Utiliser un taux standard sans vérifier le régime applicable.",
      "Oublier que la TVA s'applique sur valeur + droits + transport.",
      "Ne pas documenter le choix du régime (autoliquidation, report, etc.).",
    ],
    ctaLabel: "Estimer le landed cost",
  },
  {
    slug: "droits-douane",
    title: "Droits de douane : comment sécuriser vos estimations",
    intro:
      "Les droits varient selon le code HS et les accords commerciaux. L'outil vous aide à structurer les hypothèses.",
    mistakes: [
      "Utiliser un code HS incomplet ou approximatif.",
      "Ignorer les accords préférentiels disponibles.",
      "Ne pas conserver la preuve d'origine.",
    ],
    ctaLabel: "Calculer avec vos taux",
  },
  {
    slug: "documents-export",
    title: "Documents export : checklist essentielle",
    intro:
      "Facture, packing list, certificat d'origine, transport… La documentation conditionne la fluidité douanière.",
    mistakes: [
      "Envoyer des documents incohérents entre eux.",
      "Oublier les exigences spécifiques pays (certificats, licences).",
      "Ne pas vérifier les conditions de transport.",
    ],
    ctaLabel: "Vérifier votre scénario",
  },
  {
    slug: "assurance-transport",
    title: "Assurance transport : protéger la marge",
    intro:
      "L'assurance représente souvent un faible coût, mais évite une perte majeure en cas d'incident.",
    mistakes: [
      "N'assurer que le fret principal en oubliant la valeur marchandise.",
      "Oublier de préciser les garanties (ICC A/B/C).",
      "Ne pas aligner l'assurance avec l'incoterm choisi.",
    ],
    ctaLabel: "Ajouter l'assurance",
  },
  {
    slug: "strategie-prix-export",
    title: "Stratégie de prix export : sécuriser la marge",
    intro:
      "Un prix export solide intègre tous les coûts logistiques et douaniers. La simulation facilite la décision.",
    mistakes: [
      "Omettre les coûts indirects dans le prix.",
      "Fixer une marge sans tenir compte du risque pays.",
      "Ne pas comparer plusieurs scénarios.",
    ],
    ctaLabel: "Comparer les scénarios",
  },
  {
    slug: "geopolitique-export",
    title: "Géopolitique : impacts sur l'export",
    intro:
      "Les tensions géopolitiques modifient les coûts, les délais et les risques (sanctions, contrôles, restrictions).",
    mistakes: [
      "Négliger la veille sur les sanctions et les pays sensibles.",
      "Sous-estimer l'impact sur les coûts logistiques et l'assurance.",
      "Continuer à vendre sans plan B (transport, paiement, sourcing).",
    ],
    ctaLabel: "Activer la veille",
  },
  {
    slug: "erreurs-process-export",
    title: "Erreurs de process export : ce qu'elles coûtent",
    intro:
      "Une erreur de process peut générer blocages douane, surcoûts et pertes de marge. L'audit interne permet de réduire ces risques.",
    mistakes: [
      "Données produit incomplètes (HS, origine, poids/volume).",
      "Incoterm non aligné avec la facture et le transport.",
      "Absence de contrôle de cohérence avant expédition.",
    ],
    ctaLabel: "Lancer un audit interne",
  },
  {
    slug: "export-control",
    title: "Export control : anticiper les restrictions",
    intro:
      "Sanctions, embargo, dual-use : certaines marchandises sont réglementées. La veille vous alerte.",
    mistakes: [
      "Ne pas identifier les pays sensibles.",
      "Oublier de documenter la classification.",
      "Ignorer les restrictions de réexportation.",
    ],
    ctaLabel: "Vérifier vos risques",
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
