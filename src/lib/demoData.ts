// ✅ Demo data orientée "France ↔ Monde" (conseil import/export global)
// + logique fallback : pays vide / HS vide

export type DemoProduct = {
  id: string;
  code: string;
  label: string;
  hs_code: string;
  tva: number;
  manufacturer: string;
  created_at: string;
  unit_price_eur?: number;
  weight_kg?: number;
};

export type DemoFeed = {
  id: string;
  name: string;
  source_url: string;
  category: string;
  zone: string;
  enabled: boolean;
  created_at: string;
};

export type DemoItem = {
  id: string;
  feed_id: string;
  title: string;
  summary: string;
  url: string;
  published_at: string;
  category: string;
  zone: string;
  severity: "low" | "medium" | "high";
  created_at: string;

  // ✅ pour personnaliser selon préférences
  country_iso2?: string | null; // ex: "US"
  hs_prefix?: string | null; // ex: "8708" (2/4/6/8)
};

export type DemoAlert = {
  id: string;
  title: string;
  message: string;
  severity: "low" | "medium" | "high";
  country_iso2?: string | null;
  hs_prefix?: string | null;
  detected_at?: string | null;
};

export type DemoTradeFlow = {
  flow_date: string;
  hs_code: string;
  reporter_country: string; // ex: "FR"
  partner_country: string; // ex: "US"
  flow_type: "export" | "import";
  value_eur: number;
  volume_kg: number;
  source: string;
};

const todayIso = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const daysAgo = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const normalizeHs = (v?: string | null) => (v ? String(v).replace(/[^0-9]/g, "").trim() : "");
const normalizeIso2 = (v?: string | null) => (v ? String(v).trim().toUpperCase() : "");

const hsMatches = (itemHs?: string | null, selectedHs: string[] = []) => {
  const item = normalizeHs(itemHs);
  if (!item) return false;
  const hs = selectedHs.map(normalizeHs).filter(Boolean);
  if (hs.length === 0) return false;

  // match exact ou prefix (ex: item=8708, selected=8708xxxx)
  return hs.some((h) => h === item || h.startsWith(item) || item.startsWith(h));
};

const countryMatches = (itemCountry?: string | null, selectedCountries: string[] = []) => {
  const c = normalizeIso2(itemCountry);
  if (!c) return false;
  const list = selectedCountries.map(normalizeIso2).filter(Boolean);
  if (list.length === 0) return false;
  return list.includes(c);
};

// ------------------- DEMO PRODUCTS -------------------
export const demoProducts: DemoProduct[] = [
  { id: "demo-prod-1", code: "P-3004", label: "Gel dermique apaisant", hs_code: "3004", tva: 20, manufacturer: "Laboratoires MPL", created_at: todayIso(), unit_price_eur: 120, weight_kg: 0.4 },
  { id: "demo-prod-2", code: "P-8708", label: "Kit freinage premium", hs_code: "8708", tva: 20, manufacturer: "MPL Auto", created_at: todayIso(), unit_price_eur: 280, weight_kg: 1.2 },
  { id: "demo-prod-3", code: "P-2204", label: "Coffret vin rouge 2022", hs_code: "2204", tva: 20, manufacturer: "Domaine Atlantique", created_at: todayIso(), unit_price_eur: 65, weight_kg: 0.9 },
  { id: "demo-prod-4", code: "P-3304", label: "Soin hydratant visage", hs_code: "3304", tva: 20, manufacturer: "MPL Cosmétique", created_at: todayIso(), unit_price_eur: 45, weight_kg: 0.2 },
  { id: "demo-prod-5", code: "P-9403", label: "Chaise bureau ergonomique", hs_code: "9403", tva: 20, manufacturer: "Atelier Nord", created_at: todayIso(), unit_price_eur: 210, weight_kg: 6.5 },
  { id: "demo-prod-6", code: "P-8504", label: "Transformateur 220V industriel", hs_code: "8504", tva: 20, manufacturer: "ElectroMPL", created_at: todayIso(), unit_price_eur: 420, weight_kg: 8.2 },
  { id: "demo-prod-7", code: "P-4202", label: "Sac de transport textile", hs_code: "4202", tva: 20, manufacturer: "MPL Bags", created_at: todayIso(), unit_price_eur: 80, weight_kg: 0.7 },
  { id: "demo-prod-8", code: "P-8471", label: "Kit capteurs IoT export", hs_code: "8471", tva: 20, manufacturer: "MPL Tech", created_at: todayIso(), unit_price_eur: 320, weight_kg: 1.4 },
  { id: "demo-prod-9", code: "P-3923", label: "Emballage recyclable", hs_code: "3923", tva: 20, manufacturer: "PackMPL", created_at: todayIso(), unit_price_eur: 12, weight_kg: 0.2 },
  { id: "demo-prod-10", code: "P-7616", label: "Profil aluminium sur mesure", hs_code: "7616", tva: 20, manufacturer: "MPL Metal", created_at: todayIso(), unit_price_eur: 90, weight_kg: 2.1 },
];

// ------------------- DEMO FEEDS (Monde + France) -------------------
export const demoRegulatoryFeeds: DemoFeed[] = [
  { id: "demo-feed-fr-1", name: "France - Douane (actu & procédures)", source_url: "https://www.douane.gouv.fr", category: "douane", zone: "FR", enabled: true, created_at: todayIso() },
  { id: "demo-feed-fr-2", name: "France - Business France (marchés & opportunités)", source_url: "https://www.businessfrance.fr", category: "markets", zone: "FR", enabled: true, created_at: todayIso() },

  { id: "demo-feed-eu-1", name: "UE - Mesures commerciales & sanctions", source_url: "https://www.consilium.europa.eu", category: "sanctions", zone: "EU", enabled: true, created_at: todayIso() },
  { id: "demo-feed-us-1", name: "US - OFAC (sanctions)", source_url: "https://home.treasury.gov", category: "sanctions", zone: "US", enabled: true, created_at: todayIso() },

  { id: "demo-feed-global-1", name: "OMC - Mesures commerciales (aperçu)", source_url: "https://www.wto.org", category: "trade_measures", zone: "GLOBAL", enabled: true, created_at: todayIso() },
  { id: "demo-feed-global-2", name: "ONU - Listes & conformité (aperçu)", source_url: "https://www.un.org", category: "regulation", zone: "GLOBAL", enabled: true, created_at: todayIso() },
];

// ------------------- DEMO ITEMS -------------------
export const demoRegulatoryItems: DemoItem[] = [
  // ✅ Contenu générique "conditions générales" (utilisé quand HS vide)
  {
    id: "demo-item-gen-1",
    feed_id: "demo-feed-fr-1",
    title: "Conditions générales export : documents et responsabilités",
    summary: "Avant tout envoi : Incoterms, facture proforma, packing list, origine, assurances, conformité sanctions.",
    url: "https://www.douane.gouv.fr",
    published_at: daysAgo(2),
    category: "conditions_generales",
    zone: "GLOBAL",
    severity: "low",
    created_at: todayIso(),
  },
  {
    id: "demo-item-gen-2",
    feed_id: "demo-feed-global-1",
    title: "Contrats & traités : pourquoi la destination change tout",
    summary: "Accords, restrictions, contrôles : pour décider vite, on doit connaître le pays de destination / d'origine.",
    url: "https://www.wto.org",
    published_at: daysAgo(6),
    category: "conditions_generales",
    zone: "GLOBAL",
    severity: "low",
    created_at: todayIso(),
  },

  // ✅ France centre → Monde (exemples ciblés)
  {
    id: "demo-item-1",
    feed_id: "demo-feed-fr-1",
    title: "France - Contrôle renforcé sur pièces auto",
    summary: "Renforcement documentaire sur certaines expéditions HS 8708 (origine / conformité).",
    url: "https://www.douane.gouv.fr",
    published_at: daysAgo(3),
    category: "douane",
    zone: "FR",
    severity: "medium",
    created_at: todayIso(),
    country_iso2: "FR",
    hs_prefix: "8708",
  },
  {
    id: "demo-item-2",
    feed_id: "demo-feed-fr-2",
    title: "Business France - Opportunités export agro (Asie)",
    summary: "Signaux marché + vigilance certifications pour boissons (HS 22xx).",
    url: "https://www.businessfrance.fr",
    published_at: daysAgo(5),
    category: "markets",
    zone: "FR",
    severity: "low",
    created_at: todayIso(),
    country_iso2: "JP",
    hs_prefix: "22",
  },

  // ✅ UE / US / GLOBAL (ciblables pays + HS)
  {
    id: "demo-item-3",
    feed_id: "demo-feed-eu-1",
    title: "UE - Mise à jour sanctions (périmètre export sensible)",
    summary: "Mise à jour de restrictions sur exportations sensibles vers certaines zones.",
    url: "https://www.consilium.europa.eu",
    published_at: daysAgo(1),
    category: "sanctions",
    zone: "EU",
    severity: "high",
    created_at: todayIso(),
    country_iso2: "RU",
  },
  {
    id: "demo-item-4",
    feed_id: "demo-feed-us-1",
    title: "US - OFAC : clarification transport maritime & assurances",
    summary: "Guidelines sur transporteurs, assurances et risques sanctions.",
    url: "https://home.treasury.gov",
    published_at: daysAgo(4),
    category: "maritime",
    zone: "US",
    severity: "medium",
    created_at: todayIso(),
    country_iso2: "US",
  },
  {
    id: "demo-item-5",
    feed_id: "demo-feed-global-2",
    title: "ONU - Focus sur documents d'origine",
    summary: "Renforcement des contrôles : certificats d'origine et traçabilité.",
    url: "https://www.un.org",
    published_at: daysAgo(7),
    category: "docs",
    zone: "GLOBAL",
    severity: "medium",
    created_at: todayIso(),
    hs_prefix: "3004",
  },
  {
    id: "demo-item-6",
    feed_id: "demo-feed-global-1",
    title: "Mesures commerciales : taxes additionnelles sur certains composants",
    summary: "Attention aux hausses de droits sur composants électriques (ex: HS 8504).",
    url: "https://www.wto.org",
    published_at: daysAgo(8),
    category: "taxes",
    zone: "GLOBAL",
    severity: "medium",
    created_at: todayIso(),
    hs_prefix: "8504",
  },
  {
    id: "demo-item-7",
    feed_id: "demo-feed-fr-1",
    title: "France - Rappels conformité : produits cosmétiques",
    summary: "Check réglementaire sur dossiers et marquage / conformité (ex: HS 3304).",
    url: "https://www.douane.gouv.fr",
    published_at: daysAgo(10),
    category: "regulation",
    zone: "FR",
    severity: "medium",
    created_at: todayIso(),
    hs_prefix: "3304",
  },
  {
    id: "demo-item-8",
    feed_id: "demo-feed-fr-2",
    title: "Business France - Tendances import : packaging durable",
    summary: "Sur plusieurs marchés, la conformité environnementale devient un prérequis (ex: HS 3923).",
    url: "https://www.businessfrance.fr",
    published_at: daysAgo(9),
    category: "markets",
    zone: "FR",
    severity: "low",
    created_at: todayIso(),
    hs_prefix: "3923",
  },
  {
    id: "demo-item-9",
    feed_id: "demo-feed-eu-1",
    title: "UE - Ajustement carbone (impact potentiel sur métaux & énergie)",
    summary: "Risque de surcoûts / justification d'origine sur certains segments (ex: HS 7616).",
    url: "https://www.consilium.europa.eu",
    published_at: daysAgo(11),
    category: "taxes",
    zone: "EU",
    severity: "medium",
    created_at: todayIso(),
    hs_prefix: "7616",
  },
];

// ------------------- DEMO ALERTS -------------------
export const demoAlerts: DemoAlert[] = [
  { id: "demo-alert-1", title: "Sanctions UE - Russie", message: "Blocage partiel ou vigilance sur certains flux (ex: HS 8708).", severity: "high", country_iso2: "RU", hs_prefix: "8708", detected_at: daysAgo(2) },
  { id: "demo-alert-2", title: "Taxes additionnelles (tendance)", message: "Surveillance des hausses possibles sur 8504.", severity: "medium", country_iso2: "US", hs_prefix: "8504", detected_at: daysAgo(4) },
  { id: "demo-alert-3", title: "Documentation Maroc", message: "Certificat d'origine requis sur certains flux (ex: 2204).", severity: "medium", country_iso2: "MA", hs_prefix: "2204", detected_at: daysAgo(5) },
  { id: "demo-alert-4", title: "Logistique Asie", message: "Délais portuaires en hausse (surveillance).", severity: "low", country_iso2: "CN", detected_at: daysAgo(7) },
  { id: "demo-alert-5", title: "Conformité UE", message: "Vigilance dossiers & contrôles sur certains produits santé.", severity: "high", country_iso2: "DE", hs_prefix: "3004", detected_at: daysAgo(9) },
  { id: "demo-alert-6", title: "Cosmétiques", message: "Points de contrôle récurrents sur 3304.", severity: "medium", country_iso2: "US", hs_prefix: "3304", detected_at: daysAgo(12) },
];

// ------------------- DEMO TRADE FLOWS -------------------
export function getDemoTradeFlows(): DemoTradeFlow[] {
  return [
    // FR -> Monde (exports)
    { flow_date: daysAgo(3), hs_code: "3004", reporter_country: "FR", partner_country: "DE", flow_type: "export", value_eur: 420000, volume_kg: 1400, source: "demo" },
    { flow_date: daysAgo(4), hs_code: "8708", reporter_country: "FR", partner_country: "US", flow_type: "export", value_eur: 680000, volume_kg: 2200, source: "demo" },
    { flow_date: daysAgo(5), hs_code: "2204", reporter_country: "FR", partner_country: "JP", flow_type: "export", value_eur: 250000, volume_kg: 900, source: "demo" },
    { flow_date: daysAgo(7), hs_code: "3304", reporter_country: "FR", partner_country: "AE", flow_type: "export", value_eur: 310000, volume_kg: 800, source: "demo" },
    { flow_date: daysAgo(8), hs_code: "9403", reporter_country: "FR", partner_country: "GB", flow_type: "export", value_eur: 470000, volume_kg: 2000, source: "demo" },
    { flow_date: daysAgo(9), hs_code: "8504", reporter_country: "FR", partner_country: "CA", flow_type: "export", value_eur: 390000, volume_kg: 1600, source: "demo" },
    { flow_date: daysAgo(10), hs_code: "7616", reporter_country: "FR", partner_country: "IN", flow_type: "export", value_eur: 210000, volume_kg: 1000, source: "demo" },
    { flow_date: daysAgo(12), hs_code: "3923", reporter_country: "FR", partner_country: "ES", flow_type: "export", value_eur: 180000, volume_kg: 1200, source: "demo" },

    // Monde -> FR (imports)
    { flow_date: daysAgo(6), hs_code: "3004", reporter_country: "US", partner_country: "FR", flow_type: "import", value_eur: 510000, volume_kg: 1600, source: "demo" },
    { flow_date: daysAgo(6), hs_code: "3304", reporter_country: "DE", partner_country: "FR", flow_type: "import", value_eur: 260000, volume_kg: 900, source: "demo" },
    { flow_date: daysAgo(2), hs_code: "8708", reporter_country: "CN", partner_country: "FR", flow_type: "import", value_eur: 720000, volume_kg: 2400, source: "demo" },
  ];
}

// ------------------- ✅ LOGIQUE FALLBACK : pays vide / HS vide -------------------
export type DemoWatchPrefs = {
  countries?: string[]; // ISO2 list
  hsCodes?: string[]; // list of HS
};

export type DemoWatchBundle = {
  message?: string; // message de guidance (si manque pays/hs)
  items: DemoItem[];
  alerts: DemoAlert[];
};

export function getDemoWatchBundle(prefs?: DemoWatchPrefs): DemoWatchBundle {
  const countries = (prefs?.countries ?? []).map(normalizeIso2).filter(Boolean);
  const hsCodes = (prefs?.hsCodes ?? []).map(normalizeHs).filter(Boolean);

  // ✅ Si pays vide : on doit connaître la destination/origine
  if (countries.length === 0) {
    const genericItems = demoRegulatoryItems.filter((i) => i.category === "conditions_generales");
    return {
      message:
        "L’import/export est une affaire de relations, d’accords et de traités : pour une veille vraiment utile, indique au moins un pays (destination ou origine).",
      items: genericItems,
      alerts: [],
    };
  }

  // ✅ Si HS vide : on affiche conditions générales + items pays (si existants)
  if (hsCodes.length === 0) {
    const general = demoRegulatoryItems.filter((i) => i.category === "conditions_generales");
    const countryOnly = demoRegulatoryItems.filter((i) => i.country_iso2 && countryMatches(i.country_iso2, countries));

    return {
      message:
        "Aucun produit (HS) renseigné : voici les conditions générales + les signaux pays. Ajoute un HS (ou un préfixe 2/4/6) pour cibler la veille produit.",
      items: [...general, ...countryOnly].slice(0, 20),
      alerts: demoAlerts.filter((a) => a.country_iso2 && countryMatches(a.country_iso2, countries)).slice(0, 10),
    };
  }

  // ✅ Sinon : filtre pays + HS
  const items = demoRegulatoryItems.filter((i) => {
    const countryOk = i.country_iso2 ? countryMatches(i.country_iso2, countries) : true; // si pas précisé -> global ok
    const hsOk = i.hs_prefix ? hsMatches(i.hs_prefix, hsCodes) : true; // si pas précisé -> global ok
    return countryOk && hsOk;
  });

  const alerts = demoAlerts.filter((a) => {
    const countryOk = a.country_iso2 ? countryMatches(a.country_iso2, countries) : true;
    const hsOk = a.hs_prefix ? hsMatches(a.hs_prefix, hsCodes) : true;
    return countryOk && hsOk;
  });

  return {
    items: items.slice(0, 30),
    alerts: alerts.slice(0, 10),
  };
}
