export type OfficialLinksLang = "fr" | "en";

export type OfficialLink = {
  id: string;
  url: string;
  label: { fr: string; en: string };
  description?: { fr: string; en: string };
};

export const OFFICIAL_LINKS_MAP = {
  access2markets: "https://trade.ec.europa.eu/access-to-markets/en/home",
  taric: "https://ec.europa.eu/taxation_customs/dds2/taric/taric_consultation.jsp",
  douane_fr: "https://www.douane.gouv.fr",
  eu_sanctions: "https://www.sanctionsmap.eu/",
  icc_incoterms: "https://iccwbo.org/business-solutions/incoterms-rules/",
  who_news: "https://www.who.int/news-room",
  wto_news: "https://www.wto.org/english/news_e/news_e.htm",
} as const;

export const OFFICIAL_LINKS: OfficialLink[] = [
  {
    id: "access2markets",
    url: OFFICIAL_LINKS_MAP.access2markets,
    label: { fr: "Access2Markets (UE)", en: "Access2Markets (EU)" },
    description: {
      fr: "Regles d'import/export, droits et exigences par pays/produit.",
      en: "Import/export rules, duties and requirements by country/product.",
    },
  },
  {
    id: "taric",
    url: OFFICIAL_LINKS_MAP.taric,
    label: { fr: "TARIC (UE)", en: "TARIC (EU)" },
    description: {
      fr: "Tarif douanier integre de l'Union europeenne.",
      en: "Integrated customs tariff for the European Union.",
    },
  },
  {
    id: "douane_fr",
    url: OFFICIAL_LINKS_MAP.douane_fr,
    label: { fr: "Douane francaise", en: "French Customs" },
    description: {
      fr: "Formalites, procedures et informations officielles France.",
      en: "Official procedures and customs information in France.",
    },
  },
  {
    id: "eu_sanctions",
    url: OFFICIAL_LINKS_MAP.eu_sanctions,
    label: { fr: "Sanctions UE", en: "EU Sanctions" },
    description: {
      fr: "Carte officielle des mesures restrictives de l'UE.",
      en: "Official map of EU restrictive measures.",
    },
  },
  {
    id: "icc_incoterms",
    url: OFFICIAL_LINKS_MAP.icc_incoterms,
    label: { fr: "ICC Incoterms", en: "ICC Incoterms" },
    description: {
      fr: "Reference officielle sur les regles Incoterms.",
      en: "Official reference for Incoterms rules.",
    },
  },
  {
    id: "who_news",
    url: OFFICIAL_LINKS_MAP.who_news,
    label: { fr: "WHO News", en: "WHO News" },
    description: {
      fr: "Actualites sante pouvant impacter les flux internationaux.",
      en: "Health updates that can impact international flows.",
    },
  },
  {
    id: "wto_news",
    url: OFFICIAL_LINKS_MAP.wto_news,
    label: { fr: "OMC/WTO News", en: "WTO News" },
    description: {
      fr: "Actualites commerce international et mesures sectorielles.",
      en: "International trade updates and sectoral measures.",
    },
  },
];

export function getOfficialLinks(lang: OfficialLinksLang, limit = 6) {
  return OFFICIAL_LINKS.slice(0, Math.max(1, limit)).map((link) => ({
    id: link.id,
    url: link.url,
    label: link.label[lang],
    description: link.description?.[lang] || "",
  }));
}

