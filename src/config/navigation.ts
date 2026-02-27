import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BookOpen,
  Bot,
  Calculator,
  FileCheck2,
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
    badge: { fr: "Gratuit", en: "Free" },
  },
  {
    id: "services",
    to: "/pricing",
    tKey: "header.menu.services",
    labels: { fr: "Offres & tarifs", en: "Plans & pricing" },
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
    labels: { fr: "Accueil", en: "Home" },
    items: [
      {
        id: "control-tower",
        to: "/app/control-tower",
        icon: Activity,
        labels: { fr: "Tour de controle", en: "Control Tower" },
        descriptions: {
          fr: "Vue globale des flux, alertes et priorites export.",
          en: "Global view of flows, alerts and export priorities.",
        },
        badge: "Live",
        featured: true,
        aliases: ["/dashboard", "/command-center", "/hub", "/app", "/app/command-center", "/tour-de-controle"],
      },
    ],
  },
  {
    id: "decide",
    labels: { fr: "Decider vite", en: "Decide fast" },
    items: [
      {
        id: "simulator",
        to: "/app/simulator",
        icon: Calculator,
        labels: { fr: "Analyse couts", en: "Cost analysis" },
        descriptions: {
          fr: "Simuler prix rendu, documents et risques logistiques.",
          en: "Simulate landed cost, documents and logistics risks.",
        },
        aliases: ["/analyse", "/app/analyse", "/app/export/costing", "/simulator"],
      },
      {
        id: "invoice-check",
        to: "/app/invoice-check",
        icon: FileCheck2,
        labels: { fr: "Controle facture", en: "Invoice check" },
        descriptions: {
          fr: "Verifier coherence facture, Incoterm et conformite de base.",
          en: "Check invoice consistency, Incoterm and base compliance.",
        },
        aliases: ["/invoice-check", "/app/import/check-invoice"],
      },
      {
        id: "taxes",
        to: "/app/taxes-om",
        icon: Scale,
        labels: { fr: "Taxes territoires", en: "Territory taxes" },
        descriptions: {
          fr: "Estimation taxes, droits et regimes specifiques.",
          en: "Estimate taxes, duties and specific regimes.",
        },
        aliases: ["/app/taxes", "/taxes-om", "/taxes", "/app/droits-taxes"],
      },
    ],
  },
  {
    id: "compliance",
    labels: { fr: "Conformite", en: "Compliance" },
    items: [
      {
        id: "audit",
        to: "/app/audit-interne",
        icon: ShieldCheck,
        labels: { fr: "Audit interne", en: "Internal audit" },
        descriptions: {
          fr: "Suivi conformite, screening et points de vigilance.",
          en: "Track compliance, screening and red flags.",
        },
        aliases: ["/app/compliance", "/app/centre-conformite", "/app/controls", "/app/sanctions"],
      },
      {
        id: "watch",
        to: "/app/centre-veille/reglementation",
        icon: BookOpen,
        labels: { fr: "Veille reglementaire", en: "Regulatory watch" },
        descriptions: {
          fr: "Veille officielle par pays, sujet et date.",
          en: "Official watch by country, topic and date.",
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
        labels: { fr: "MPL Export Expert", en: "MPL Export Expert" },
        descriptions: {
          fr: "Assistant export structure, oriente documents et actions.",
          en: "Structured export assistant focused on documents and actions.",
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
