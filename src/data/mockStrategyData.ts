import type {
  Competitor,
  DecisionBrief,
  LppReference,
  PriceObservation,
} from "@/types/strategy";

export const competitors: Competitor[] = [
  {
    id: "thuasne",
    name: "Thuasne",
    positioning: "Leader reimbursement, forte presence hospitaliere",
    strengths: ["Gamme remboursement", "Reseau hospitalier", "Brand equity"],
    weaknesses: ["Prix premium", "Reputation digitale faible"],
    markets: ["FR", "DROM", "ES"],
  },
  {
    id: "donjoy",
    name: "DonJoy / Enovis",
    group: "Enovis",
    positioning: "Performance sport / ortho",
    strengths: ["Innovation", "Distribution sport"],
    weaknesses: ["Moins LPP", "Prix eleves"],
    markets: ["FR", "US", "DROM"],
  },
  {
    id: "gibaud",
    name: "Gibaud",
    positioning: "Volume retail + remboursement",
    strengths: ["Distribution retail", "Tarifs agressifs"],
    weaknesses: ["Moins tech", "Couverture sport limitee"],
    markets: ["FR", "DROM", "IT"],
  },
  {
    id: "orliman",
    name: "ORLIMAN",
    positioning: "Equilibre prix / innovation, focus DROM",
    strengths: ["Agilite DROM", "Mix remboursement / sport", "Relations grossistes"],
    weaknesses: ["Visibilite marque", "Equipe reduite"],
    markets: ["FR", "DROM", "LATAM"],
    notes: "Cible: consolider DROM et pousser offres combinees",
  },
];

export const priceObservations: PriceObservation[] = [
  {
    id: "obs-1",
    competitorId: "thuasne",
    category: "Chevillere",
    productName: "Chevillere ligamentaire",
    market: "DROM",
    currency: "EUR",
    price: 68,
    date: "2025-01-10",
    sourceLabel: "Grossiste DROM",
  },
  {
    id: "obs-2",
    competitorId: "donjoy",
    category: "Genou",
    productName: "Genouillere sport",
    market: "FR",
    currency: "EUR",
    price: 110,
    date: "2025-01-08",
    sourceLabel: "Sport retailer",
  },
  {
    id: "obs-3",
    competitorId: "gibaud",
    category: "Ceinture",
    productName: "Ceinture lombaire",
    market: "DROM",
    currency: "EUR",
    price: 55,
    date: "2025-01-05",
    sourceLabel: "Pharmacie",
  },
  {
    id: "obs-4",
    competitorId: "orliman",
    category: "Chevillere",
    productName: "Chevillere premium",
    market: "DROM",
    currency: "EUR",
    price: 72,
    date: "2025-01-10",
    sourceLabel: "Orliman distrib",
  },
];

export const lppReferences: LppReference[] = [
  {
    id: "lpp-1",
    code: "1234567",
    label: "Reeducation orthopedique - placeholder",
    notes: "A completer avec tarifs LPP",
  },
  {
    id: "lpp-2",
    code: "2345678",
    label: "Orthese membre inferieur - placeholder",
    notes: "Verifier eligibility DROM",
  },
];

export const sampleDecisionBrief: DecisionBrief = {
  id: "brief-1",
  title: "Positionnement chevillere DROM Q1",
  context:
    "Pression concurrentielle accrue en DROM sur la chevillere ligamentaire, besoin d'arbitrer la politique prix.",
  assumptions: [
    "Logistique DROM stable (lead time 4 semaines)",
    "Elasticite prix moyenne sur segment sport",
    "Maintien remboursement LPP actuel",
  ],
  options: [
    "Premium +10% vs Thuasne avec pack service",
    "Alignement Gibaud sur DROM pour volume",
    "Penetration ciblant clubs et kine",
  ],
  recommendation:
    "Combiner premium sur canal hospitalier + pack service, penetration sur clubs sport en DROM.",
  risks: [
    "Volume inferieur si pas de traction marque",
    "Ecart prix vs Gibaud peut limiter retail",
    "Dependance a la logistique maritime",
  ],
  nextActions: [
    "Valider prix cible par canal",
    "Preparer argumentaire LPP simplifie",
    "Piloter 3 observatoires prix grossistes",
  ],
};
