type DemoProduct = {
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

type DemoFeed = {
  id: string;
  name: string;
  source_url: string;
  category: string;
  zone: string;
  enabled: boolean;
  created_at: string;
};

type DemoItem = {
  id: string;
  feed_id: string;
  title: string;
  summary: string;
  url: string;
  published_at: string;
  category: string;
  zone: string;
  severity: string;
  created_at: string;
};

type DemoAlert = {
  id: string;
  title: string;
  message: string;
  severity: "low" | "medium" | "high";
  country_iso2?: string | null;
  hs_prefix?: string | null;
  detected_at?: string | null;
};

type DemoTradeFlow = {
  flow_date: string;
  hs_code: string;
  reporter_country: string;
  partner_country: string;
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

export const demoProducts: DemoProduct[] = [
  { id: "demo-prod-1", code: "P-3004", label: "Gel dermique apaisant", hs_code: "3004", tva: 20, manufacturer: "Laboratoires MPL", created_at: todayIso(), unit_price_eur: 120, weight_kg: 0.4 },
  { id: "demo-prod-2", code: "P-8708", label: "Kit freinage premium", hs_code: "8708", tva: 20, manufacturer: "MPL Auto", created_at: todayIso(), unit_price_eur: 280, weight_kg: 1.2 },
  { id: "demo-prod-3", code: "P-2204", label: "Coffret vin rouge 2022", hs_code: "2204", tva: 20, manufacturer: "Domaine Atlantique", created_at: todayIso(), unit_price_eur: 65, weight_kg: 0.9 },
  { id: "demo-prod-4", code: "P-3304", label: "Soin hydratant visage", hs_code: "3304", tva: 20, manufacturer: "MPL Cosmetique", created_at: todayIso(), unit_price_eur: 45, weight_kg: 0.2 },
  { id: "demo-prod-5", code: "P-9403", label: "Chaise bureau ergonomique", hs_code: "9403", tva: 20, manufacturer: "Atelier Nord", created_at: todayIso(), unit_price_eur: 210, weight_kg: 6.5 },
  { id: "demo-prod-6", code: "P-8504", label: "Transformateur 220V industriel", hs_code: "8504", tva: 20, manufacturer: "ElectroMPL", created_at: todayIso(), unit_price_eur: 420, weight_kg: 8.2 },
  { id: "demo-prod-7", code: "P-4202", label: "Sac de transport textile", hs_code: "4202", tva: 20, manufacturer: "MPL Bags", created_at: todayIso(), unit_price_eur: 80, weight_kg: 0.7 },
  { id: "demo-prod-8", code: "P-8471", label: "Kit capteurs IoT export", hs_code: "8471", tva: 20, manufacturer: "MPL Tech", created_at: todayIso(), unit_price_eur: 320, weight_kg: 1.4 },
  { id: "demo-prod-9", code: "P-3923", label: "Emballage recyclable", hs_code: "3923", tva: 20, manufacturer: "PackMPL", created_at: todayIso(), unit_price_eur: 12, weight_kg: 0.2 },
  { id: "demo-prod-10", code: "P-7616", label: "Profil aluminium sur mesure", hs_code: "7616", tva: 20, manufacturer: "MPL Metal", created_at: todayIso(), unit_price_eur: 90, weight_kg: 2.1 },
];

export const demoRegulatoryFeeds: DemoFeed[] = [
  { id: "demo-feed-1", name: "UE - Sanctions et restrictions", source_url: "https://data.europa.eu", category: "sanctions", zone: "EU", enabled: true, created_at: todayIso() },
  { id: "demo-feed-2", name: "OFAC - Alerts", source_url: "https://home.treasury.gov", category: "sanctions", zone: "US", enabled: true, created_at: todayIso() },
  { id: "demo-feed-3", name: "ONU - Listes consolidees", source_url: "https://www.un.org", category: "sanctions", zone: "GLOBAL", enabled: true, created_at: todayIso() },
];

export const demoRegulatoryItems: DemoItem[] = [
  { id: "demo-item-1", feed_id: "demo-feed-1", title: "Mise a jour sanctions secteur energie", summary: "Nouvelles restrictions sur les exportations sensibles vers la Russie.", url: "https://data.europa.eu", published_at: daysAgo(2), category: "sanctions", zone: "EU", severity: "high", created_at: todayIso() },
  { id: "demo-item-2", feed_id: "demo-feed-1", title: "Documents requis pour agroalimentaire", summary: "Certification sanitaire obligatoire pour certains HS 22xx.", url: "https://data.europa.eu", published_at: daysAgo(5), category: "docs", zone: "EU", severity: "medium", created_at: todayIso() },
  { id: "demo-item-3", feed_id: "demo-feed-2", title: "OFAC - Alertes Iran", summary: "Nouvelles entites ajoutees a la SDN list.", url: "https://home.treasury.gov", published_at: daysAgo(4), category: "sanctions", zone: "US", severity: "high", created_at: todayIso() },
  { id: "demo-item-4", feed_id: "demo-feed-2", title: "Taxes additionnelles sur electronics", summary: "Droits additionnels sur certains composants.", url: "https://home.treasury.gov", published_at: daysAgo(8), category: "taxes", zone: "US", severity: "medium", created_at: todayIso() },
  { id: "demo-item-5", feed_id: "demo-feed-3", title: "ONU - Mise a jour liste export control", summary: "Nouveaux controles dual-use sur materiels telecom.", url: "https://www.un.org", published_at: daysAgo(6), category: "regulation", zone: "GLOBAL", severity: "medium", created_at: todayIso() },
  { id: "demo-item-6", feed_id: "demo-feed-1", title: "Procedure douaniere renforcee", summary: "Double verification pour HS 8708.", url: "https://data.europa.eu", published_at: daysAgo(9), category: "douane", zone: "EU", severity: "low", created_at: todayIso() },
  { id: "demo-item-7", feed_id: "demo-feed-3", title: "ONU - Focus sur documents d'origine", summary: "Renforcement des controles sur certificats d'origine.", url: "https://www.un.org", published_at: daysAgo(10), category: "docs", zone: "GLOBAL", severity: "low", created_at: todayIso() },
  { id: "demo-item-8", feed_id: "demo-feed-2", title: "OFAC - Clarification transport maritime", summary: "Guidelines sur assurances et transporteurs.", url: "https://home.treasury.gov", published_at: daysAgo(3), category: "maritime", zone: "US", severity: "medium", created_at: todayIso() },
  { id: "demo-item-9", feed_id: "demo-feed-1", title: "UE - Actualisation taxes carbone", summary: "Impact sur HS 7616 et 8504.", url: "https://data.europa.eu", published_at: daysAgo(7), category: "taxes", zone: "EU", severity: "medium", created_at: todayIso() },
  { id: "demo-item-10", feed_id: "demo-feed-3", title: "ONU - Guide documentation transport", summary: "Nouvelles recommandations pour transport maritime.", url: "https://www.un.org", published_at: daysAgo(12), category: "maritime", zone: "GLOBAL", severity: "low", created_at: todayIso() },
  { id: "demo-item-11", feed_id: "demo-feed-2", title: "US - Notices compliance export", summary: "Mise a jour des exigences de declaration.", url: "https://home.treasury.gov", published_at: daysAgo(1), category: "regulation", zone: "US", severity: "high", created_at: todayIso() },
  { id: "demo-item-12", feed_id: "demo-feed-1", title: "UE - Focus documents pharma", summary: "Verification renforcee des dossiers CE.", url: "https://data.europa.eu", published_at: daysAgo(11), category: "docs", zone: "EU", severity: "medium", created_at: todayIso() },
];

export const demoAlerts: DemoAlert[] = [
  { id: "demo-alert-1", title: "Sanctions UE - Russie", message: "Blocage partiel sur HS 8708.", severity: "high", country_iso2: "RU", hs_prefix: "8708", detected_at: daysAgo(2) },
  { id: "demo-alert-2", title: "Taxes additionnelles US", message: "Droits additionnels sur 8504.", severity: "medium", country_iso2: "US", hs_prefix: "8504", detected_at: daysAgo(4) },
  { id: "demo-alert-3", title: "Documentation Maroc", message: "Certificat d'origine obligatoire pour 2204.", severity: "medium", country_iso2: "MA", hs_prefix: "2204", detected_at: daysAgo(5) },
  { id: "demo-alert-4", title: "Contrôle maritime Chine", message: "Delais portuaires en hausse.", severity: "low", country_iso2: "CN", hs_prefix: "9403", detected_at: daysAgo(7) },
  { id: "demo-alert-5", title: "Alertes conformite UE", message: "Verification renforcee des dossiers pharma.", severity: "high", country_iso2: "DE", hs_prefix: "3004", detected_at: daysAgo(9) },
  { id: "demo-alert-6", title: "US - Contrôles douane", message: "Focus sur HS 3304.", severity: "medium", country_iso2: "US", hs_prefix: "3304", detected_at: daysAgo(12) },
];

export function getDemoTradeFlows(): DemoTradeFlow[] {
  return [
    { flow_date: daysAgo(3), hs_code: "3004", reporter_country: "FR", partner_country: "DE", flow_type: "export", value_eur: 420000, volume_kg: 1400, source: "demo" },
    { flow_date: daysAgo(4), hs_code: "8708", reporter_country: "FR", partner_country: "US", flow_type: "export", value_eur: 680000, volume_kg: 2200, source: "demo" },
    { flow_date: daysAgo(5), hs_code: "2204", reporter_country: "FR", partner_country: "JP", flow_type: "export", value_eur: 250000, volume_kg: 900, source: "demo" },
    { flow_date: daysAgo(7), hs_code: "3304", reporter_country: "FR", partner_country: "AE", flow_type: "export", value_eur: 310000, volume_kg: 800, source: "demo" },
    { flow_date: daysAgo(8), hs_code: "9403", reporter_country: "FR", partner_country: "GB", flow_type: "export", value_eur: 470000, volume_kg: 2000, source: "demo" },
    { flow_date: daysAgo(9), hs_code: "8504", reporter_country: "FR", partner_country: "CA", flow_type: "export", value_eur: 390000, volume_kg: 1600, source: "demo" },
    { flow_date: daysAgo(10), hs_code: "7616", reporter_country: "FR", partner_country: "IN", flow_type: "export", value_eur: 210000, volume_kg: 1000, source: "demo" },
    { flow_date: daysAgo(12), hs_code: "3923", reporter_country: "FR", partner_country: "ES", flow_type: "export", value_eur: 180000, volume_kg: 1200, source: "demo" },
    { flow_date: daysAgo(6), hs_code: "3004", reporter_country: "US", partner_country: "FR", flow_type: "import", value_eur: 510000, volume_kg: 1600, source: "demo" },
    { flow_date: daysAgo(6), hs_code: "3304", reporter_country: "DE", partner_country: "FR", flow_type: "import", value_eur: 260000, volume_kg: 900, source: "demo" },
    { flow_date: daysAgo(2), hs_code: "8708", reporter_country: "CN", partner_country: "FR", flow_type: "import", value_eur: 720000, volume_kg: 2400, source: "demo" },
  ];
}
