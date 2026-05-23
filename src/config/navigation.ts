import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BookOpen,
  Bot,
  Calculator,
  Compass,
  FileCheck2,
  FolderOpen,
  Handshake,
  LayoutDashboard,
  MessageSquare,
  Scale,
  Settings,
  ShieldCheck,
} from "lucide-react";

import type { LanguageCode } from "@/i18n/translations";

export type NavLabels = Record<LanguageCode, string>;

export type PublicNavItem = {
  id: string;
  to: string;
  labels: NavLabels;
  tKey?: string;
  badge?: NavLabels;
};

export type FooterNavItem = {
  id: string;
  to: string;
  labels: NavLabels;
  legal?: boolean;
};

export type AppNavItem = {
  id: string;
  to: string;
  labels: NavLabels;
  descriptions?: NavLabels;
  icon: LucideIcon;
  aliases?: string[];
  badge?: string;
  featured?: boolean;
  adminOnly?: boolean;
};

export type AppNavSection = {
  id: string;
  labels: NavLabels;
  items: AppNavItem[];
};

export const publicNav: PublicNavItem[] = [
  {
    id: "copilot",
    to: "/copilote",
    tKey: "header.menu.copilot",
    labels: { fr: "Copilote IA", en: "AI Copilot" },
  },
  {
    id: "services",
    to: "/pricing",
    labels: { fr: "Accompagnement", en: "Support" },
  },
  {
    id: "business",
    to: "/coin-business",
    labels: { fr: "Business France-Maghreb", en: "France-Maghreb business" },
    badge: { fr: "Nouveau", en: "New" },
  },
  {
    id: "about",
    to: "/about",
    tKey: "header.menu.about",
    labels: { fr: "A propos", en: "About" },
  },
  {
    id: "contact",
    to: "/contact",
    tKey: "header.menu.contact",
    labels: { fr: "Contact", en: "Contact" },
  },
];

const legalFooter: FooterNavItem[] = [
  { id: "legal-notice", to: "/mentions-legales", labels: { fr: "Mentions legales", en: "Legal notice" }, legal: true },
  { id: "privacy", to: "/confidentialite", labels: { fr: "Confidentialite", en: "Privacy" }, legal: true },
  { id: "cookies", to: "/cookies", labels: { fr: "Cookies", en: "Cookies" }, legal: true },
  { id: "cgu", to: "/cgu", labels: { fr: "CGU", en: "Terms of use" }, legal: true },
  { id: "cgv", to: "/cgv", labels: { fr: "CGV", en: "Terms of sale" }, legal: true },
];

export const footerNav: FooterNavItem[] = [
  ...publicNav.map((item) => ({ id: item.id, to: item.to, labels: item.labels })),
  ...legalFooter,
];

export const appNav: AppNavSection[] = [
  {
    id: "home",
    labels: { fr: "Demarrer", en: "Start" },
    items: [
      {
        id: "control-tower",
        to: "/app/control-tower",
        icon: Activity,
        labels: { fr: "Accueil business", en: "Business home" },
        descriptions: {
          fr: "Vue simple des flux, marges, alertes et priorites France-Maghreb.",
          en: "Simple view of flows, margins, alerts and France-Maghreb priorities.",
        },
        badge: "Live",
        featured: true,
        aliases: ["/dashboard", "/command-center", "/hub", "/app", "/app/command-center", "/tour-de-controle"],
      },
    ],
  },
  {
    id: "business",
    labels: { fr: "Faire du business", en: "Do business" },
    items: [
      {
        id: "business-relations",
        to: "/app/mise-en-relation",
        icon: Handshake,
        labels: { fr: "Acheteurs & fournisseurs", en: "Buyers & suppliers" },
        descriptions: {
          fr: "Publier une opportunite, demander un contact et trouver des partenaires France-Maghreb.",
          en: "Publish an opportunity, request contact and find France-Maghreb partners.",
        },
        badge: "New",
        featured: true,
        aliases: ["/app/business", "/app/business-relations", "/app/network"],
      },
      {
        id: "dossiers-board",
        to: "/app/dossiers",
        icon: FolderOpen,
        labels: { fr: "Mes affaires", en: "My deals" },
        descriptions: {
          fr: "Dossiers import-export: client, produit, prix, documents et prochaine action.",
          en: "Import-export files: client, product, price, documents and next action.",
        },
        featured: true,
        aliases: ["/app/deals", "/deals", "/app/dossiers/new"],
      },
      {
        id: "sales-dashboard",
        to: "/app/sales-dashboard",
        icon: LayoutDashboard,
        labels: { fr: "Suivi ventes", en: "Sales tracking" },
        descriptions: {
          fr: "Top pays/produits, pipeline commercial et avancee des opportunites.",
          en: "Top countries/products, sales pipeline and opportunity progress.",
        },
        aliases: ["/app/explore", "/explore", "/sales"],
      },
      {
        id: "market-finder",
        to: "/app/market-finder",
        icon: Compass,
        labels: { fr: "Choisir un marche", en: "Choose a market" },
        descriptions: {
          fr: "Comparer France, Maroc, Algerie, Tunisie et autres pays selon le produit.",
          en: "Compare France, Morocco, Algeria, Tunisia and other countries by product.",
        },
      },
      {
        id: "lead-templates",
        to: "/app/lead-templates",
        icon: MessageSquare,
        labels: { fr: "Messages de prospection", en: "Prospecting messages" },
        descriptions: {
          fr: "Modeles FR/EN pour contacter acheteurs, fournisseurs et distributeurs.",
          en: "FR/EN templates to contact buyers, suppliers and distributors.",
        },
      },
    ],
  },
  {
    id: "decide",
    labels: { fr: "Chiffrer", en: "Price" },
    items: [
      {
        id: "simulator",
        to: "/app/simulator",
        icon: Calculator,
        labels: { fr: "Cout rendu & marge", en: "Landed cost & margin" },
        descriptions: {
          fr: "Calculer prix rendu, transport, droits, taxes et marge avant de signer.",
          en: "Calculate landed price, freight, duties, taxes and margin before signing.",
        },
        aliases: ["/analyse", "/app/analyse", "/app/export/costing", "/simulator"],
      },
      {
        id: "invoice-check",
        to: "/app/invoice-check",
        icon: FileCheck2,
        labels: { fr: "Controle facture", en: "Invoice check" },
        descriptions: {
          fr: "Verifier facture, Incoterm, TVA et coherence douane avant expedition.",
          en: "Check invoice, Incoterm, VAT and customs consistency before shipment.",
        },
        aliases: ["/invoice-check", "/app/import/check-invoice"],
      },
      {
        id: "taxes",
        to: "/app/taxes-om",
        icon: Scale,
        labels: { fr: "Droits & taxes", en: "Duties & taxes" },
        descriptions: {
          fr: "Estimer droits, taxes et regimes specifiques par territoire.",
          en: "Estimate duties, taxes and specific regimes by territory.",
        },
        aliases: ["/app/taxes", "/taxes-om", "/taxes", "/app/droits-taxes"],
      },
    ],
  },
  {
    id: "compliance",
    labels: { fr: "Securiser", en: "Secure" },
    items: [
      {
        id: "audit",
        to: "/app/audit-interne",
        icon: ShieldCheck,
        labels: { fr: "Conformite", en: "Compliance" },
        descriptions: {
          fr: "Verifier documents, restrictions, screening et points de vigilance.",
          en: "Check documents, restrictions, screening and red flags.",
        },
        aliases: ["/app/compliance", "/app/centre-conformite", "/app/controls", "/app/sanctions"],
      },
      {
        id: "watch",
        to: "/app/centre-veille/reglementation",
        icon: BookOpen,
        labels: { fr: "Veille pays", en: "Country watch" },
        descriptions: {
          fr: "Suivre douane, reglementation, transport et actualites par pays.",
          en: "Monitor customs, regulation, transport and news by country.",
        },
        aliases: ["/veille", "/watch", "/app/centre-veille", "/watch/regulatory"],
      },
    ],
  },
  {
    id: "assistant",
    labels: { fr: "IA", en: "AI" },
    items: [
      {
        id: "assistant",
        to: "/app/assistant",
        icon: Bot,
        labels: { fr: "Assistant commerce", en: "Trade assistant" },
        descriptions: {
          fr: "Reponses simples sur documents, douane, Incoterms, prix et action suivante.",
          en: "Simple answers on documents, customs, Incoterms, price and next action.",
        },
        aliases: ["/assistant", "/expert", "/app/expert"],
      },
    ],
  },
  {
    id: "admin",
    labels: { fr: "Admin", en: "Admin" },
    items: [
      {
        id: "admin",
        to: "/app/admin",
        icon: Settings,
        labels: { fr: "Admin", en: "Admin" },
        descriptions: {
          fr: "Base documentaire, donnees de reference et supervision.",
          en: "Knowledge base, reference data and supervision.",
        },
        adminOnly: true,
      },
      {
        id: "admin-realtime",
        to: "/app/admin/realtime",
        icon: Activity,
        labels: { fr: "Realtime debug", en: "Realtime debug" },
        descriptions: {
          fr: "Tester postgres_changes en direct sur les tables cles.",
          en: "Test live postgres_changes on key tables.",
        },
        adminOnly: true,
      },
    ],
  },
];

export function isPathActive(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  if (pathname === to) return true;
  return pathname.startsWith(`${to}/`);
}

export function matchAppNavItem(pathname: string) {
  for (const section of appNav) {
    for (const item of section.items) {
      if (isPathActive(pathname, item.to)) return item;
      if (item.aliases?.some((alias) => pathname === alias || pathname.startsWith(`${alias}/`))) {
        return item;
      }
    }
  }
  return null;
}
