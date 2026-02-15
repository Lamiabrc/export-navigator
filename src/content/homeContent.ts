import { FileText, ShieldCheck, TrendingUp, Wallet } from "lucide-react";

export type HomeLang = "fr" | "en";

export type HeroLabels = {
  badge: string;
  title: string;
  intro: string;
  bullets: string[];
  ctaVideo: string;
  ctaTower: string;
  ctaContact: string;
  confidentiality: string;
};

export const heroByLang: Record<HomeLang, HeroLabels> = {
  en: {
    badge: "Export control tower",
    title: "Export control tower? Go/No-Go in 60 seconds.",
    intro:
      "A professional cockpit to secure your international deals: country Go/No-Go, payment, Incoterms, documents and landed cost.",
    bullets: [
      "A clear verdict + 3 immediate actions.",
      "Checklists and ready-to-send messages.",
      "Secure history + action plan.",
    ],
    ctaVideo: "Watch the demo video",
    ctaTower: "Open the control tower",
    ctaContact: "Contact us for a quote",
    confidentiality: "Control tower available after sign-in only. Confidential data · EU hosting · GDPR.",
  },
  fr: {
    badge: "Tour de contrôle export",
    title: "Tour de contrôle export ? Go/No-Go en 60 secondes.",
    intro:
      "Un cockpit pro pour sécuriser vos ventes à l’international : Go/No-Go pays, paiement, Incoterms, documents et prix export (landed cost).",
    bullets: [
      "Un verdict clair + 3 actions immédiates.",
      "Checklists et messages prêts à envoyer.",
      "Historique sécurisé + plan d’objectifs.",
    ],
    ctaVideo: "Voir la vidéo de démo",
    ctaTower: "Accéder au tour de contrôle",
    ctaContact: "Nous contacter pour devis",
    confidentiality: "Tour de contrôle accessible uniquement après connexion. Données confidentielles · Hébergement UE · RGPD.",
  },
};

export const valueCardsByLang: Record<HomeLang, Array<{ icon: typeof ShieldCheck; title: string; line1: string; line2: string }>> = {
  en: [
    { icon: ShieldCheck, title: "Go / No-Go Export", line1: "Sell / do not sell / sell with conditions.", line2: "Risk score + recommendations + checklist." },
    { icon: Wallet, title: "Secure payment", line1: "Choose the right method (LC, CAD, OA…).", line2: "Reduce non-payment risk." },
    { icon: TrendingUp, title: "Export pricing (Landed Cost)", line1: "Full cost + margin + target price.", line2: "PDF/CSV export (Pro)." },
    { icon: FileText, title: "Documents & compliance", line1: "Invoice / packing list / mention checks.", line2: "Corrections + email templates." },
  ],
  fr: [
    { icon: ShieldCheck, title: "Go / No-Go Export", line1: "Vendez / ne vendez pas / vendez sous conditions.", line2: "Score risque + recommandations + checklist." },
    { icon: Wallet, title: "Sécuriser le paiement", line1: "Choisissez le bon mode (LC, CAD, OA…).", line2: "Réduisez le risque d’impayé." },
    { icon: TrendingUp, title: "Prix export (Landed Cost)", line1: "Coût complet + marge + prix cible.", line2: "Export PDF/CSV (Pro)." },
    { icon: FileText, title: "Documents & conformité", line1: "Contrôle facture / packing / mentions.", line2: "Corrections + modèles de mail." },
  ],
};

export const audiencesByLang: Record<HomeLang, string[]> = {
  en: ["SMEs & export sales teams", "Export / import operations", "Consultants & compliance managers"],
  fr: ["PME & commerciaux export", "ADV export / import", "Consultants & responsables conformité"],
};

export const stepsByLang: Record<HomeLang, string[]> = {
  en: [
    "You provide country, product, and scenario.",
    "We analyze risks, costs, and obligations.",
    "You leave with an action plan + ready-to-send deliverables.",
  ],
  fr: [
    "Vous renseignez le pays, le produit et votre scénario.",
    "On analyse risques, coûts et obligations.",
    "Vous repartez avec un plan d’actions + des livrables prêts à envoyer.",
  ],
};

export const prospectionByLang: Record<HomeLang, string[]> = {
  en: [
    "ICP method (ideal customer profile) + target list",
    "Email sequence with 3 follow-ups + LinkedIn message",
    "Objections: price, lead-time, risk — ready answers",
  ],
  fr: [
    "Méthode ICP (profil client idéal) + liste cible",
    "Séquence email 3 relances + message LinkedIn",
    "Objections: prix, délais, risque — réponses prêtes",
  ],
};
