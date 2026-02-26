export type UiLang = "fr" | "en";

export type LocalizedOption = {
  value: string;
  label_fr: string;
  label_en: string;
};

export type CountryOption = {
  iso2: string;
  label_fr: string;
  label_en: string;
  region: string;
};

export type ProductOption = {
  code: string;
  label_fr: string;
  label_en: string;
  hs6: string;
  tags: string[];
};

export const NEED_OPTIONS: LocalizedOption[] = [
  { value: "guide", label_fr: "Guide export (pays + produit)", label_en: "Export guide (country + product)" },
  { value: "watch", label_fr: "Veille et sanctions", label_en: "Watch and sanctions" },
  { value: "invoice", label_fr: "Verification facture (PDF)", label_en: "Invoice verification (PDF)" },
  { value: "landed_cost", label_fr: "Prix rendu / taxes / Incoterms", label_en: "Landed cost / taxes / Incoterms" },
  { value: "tower", label_fr: "Control Tower (CSV/Excel)", label_en: "Control Tower (CSV/Excel)" },
  { value: "advisory", label_fr: "Conseil et audit (devis)", label_en: "Advisory and audit (quote)" },
];

export const OPERATION_TYPES: LocalizedOption[] = [
  { value: "export", label_fr: "Exporter", label_en: "Exporter" },
  { value: "import", label_fr: "Importer", label_en: "Importer" },
];

export const INCOTERMS: LocalizedOption[] = [
  { value: "EXW", label_fr: "EXW - Ex Works", label_en: "EXW - Ex Works" },
  { value: "FCA", label_fr: "FCA - Free Carrier", label_en: "FCA - Free Carrier" },
  { value: "FOB", label_fr: "FOB - Free On Board", label_en: "FOB - Free On Board" },
  { value: "CFR", label_fr: "CFR - Cost and Freight", label_en: "CFR - Cost and Freight" },
  { value: "CIF", label_fr: "CIF - Cost Insurance Freight", label_en: "CIF - Cost Insurance Freight" },
  { value: "CPT", label_fr: "CPT - Carriage Paid To", label_en: "CPT - Carriage Paid To" },
  { value: "CIP", label_fr: "CIP - Carriage and Insurance Paid To", label_en: "CIP - Carriage and Insurance Paid To" },
  { value: "DAP", label_fr: "DAP - Delivered At Place", label_en: "DAP - Delivered At Place" },
  { value: "DPU", label_fr: "DPU - Delivered at Place Unloaded", label_en: "DPU - Delivered at Place Unloaded" },
  { value: "DDP", label_fr: "DDP - Delivered Duty Paid", label_en: "DDP - Delivered Duty Paid" },
];

export const TRANSPORT_MODES: LocalizedOption[] = [
  { value: "air", label_fr: "Aerien", label_en: "Air" },
  { value: "sea", label_fr: "Maritime", label_en: "Sea" },
  { value: "road", label_fr: "Routier", label_en: "Road" },
  { value: "rail", label_fr: "Ferroviaire", label_en: "Rail" },
  { value: "courier", label_fr: "Express/Courier", label_en: "Express/Courier" },
];

export const CURRENCIES: LocalizedOption[] = [
  { value: "EUR", label_fr: "EUR - Euro", label_en: "EUR - Euro" },
  { value: "USD", label_fr: "USD - Dollar US", label_en: "USD - US Dollar" },
  { value: "GBP", label_fr: "GBP - Livre sterling", label_en: "GBP - Pound sterling" },
  { value: "JPY", label_fr: "JPY - Yen japonais", label_en: "JPY - Japanese yen" },
  { value: "CNY", label_fr: "CNY - Yuan chinois", label_en: "CNY - Chinese yuan" },
  { value: "CHF", label_fr: "CHF - Franc suisse", label_en: "CHF - Swiss franc" },
  { value: "CAD", label_fr: "CAD - Dollar canadien", label_en: "CAD - Canadian dollar" },
  { value: "AUD", label_fr: "AUD - Dollar australien", label_en: "AUD - Australian dollar" },
  { value: "MAD", label_fr: "MAD - Dirham marocain", label_en: "MAD - Moroccan dirham" },
  { value: "BRL", label_fr: "BRL - Real bresilien", label_en: "BRL - Brazilian real" },
];

export const PAYMENT_TERMS: LocalizedOption[] = [
  { value: "wire", label_fr: "Virement bancaire", label_en: "Wire transfer" },
  { value: "cad", label_fr: "CAD - remise documentaire", label_en: "CAD - documents against payment" },
  { value: "lc", label_fr: "Credit documentaire", label_en: "Letter of credit" },
  { value: "open_account", label_fr: "Open account", label_en: "Open account" },
  { value: "escrow", label_fr: "Escrow", label_en: "Escrow" },
];

export const DISTRIBUTION_CHANNELS: LocalizedOption[] = [
  { value: "direct", label_fr: "Direct", label_en: "Direct" },
  { value: "distributor", label_fr: "Distributeur", label_en: "Distributor" },
  { value: "marketplace", label_fr: "Marketplace", label_en: "Marketplace" },
  { value: "agent", label_fr: "Agent", label_en: "Agent" },
  { value: "retail", label_fr: "Retail", label_en: "Retail" },
];

export const YES_NO_OPTIONS: LocalizedOption[] = [
  { value: "yes", label_fr: "Oui", label_en: "Yes" },
  { value: "no", label_fr: "Non", label_en: "No" },
];

export const WEIGHT_BANDS: LocalizedOption[] = [
  { value: "0-5", label_fr: "0 a 5 kg", label_en: "0 to 5 kg" },
  { value: "5-20", label_fr: "5 a 20 kg", label_en: "5 to 20 kg" },
  { value: "20-100", label_fr: "20 a 100 kg", label_en: "20 to 100 kg" },
  { value: "100-500", label_fr: "100 a 500 kg", label_en: "100 to 500 kg" },
  { value: "500+", label_fr: "500 kg et plus", label_en: "500 kg and above" },
];

export const VOLUME_BANDS: LocalizedOption[] = [
  { value: "0-0.1", label_fr: "0 a 0,1 m3", label_en: "0 to 0.1 m3" },
  { value: "0.1-1", label_fr: "0,1 a 1 m3", label_en: "0.1 to 1 m3" },
  { value: "1-5", label_fr: "1 a 5 m3", label_en: "1 to 5 m3" },
  { value: "5-15", label_fr: "5 a 15 m3", label_en: "5 to 15 m3" },
  { value: "15+", label_fr: "15 m3 et plus", label_en: "15 m3 and above" },
];

export const VALUE_BANDS: LocalizedOption[] = [
  { value: "0-1000", label_fr: "0 a 1 000", label_en: "0 to 1,000" },
  { value: "1000-5000", label_fr: "1 000 a 5 000", label_en: "1,000 to 5,000" },
  { value: "5000-20000", label_fr: "5 000 a 20 000", label_en: "5,000 to 20,000" },
  { value: "20000-100000", label_fr: "20 000 a 100 000", label_en: "20,000 to 100,000" },
  { value: "100000+", label_fr: "100 000 et plus", label_en: "100,000 and above" },
  { value: "other", label_fr: "Autre montant", label_en: "Other amount" },
];

export const COUNTRIES: CountryOption[] = [
  { iso2: "AE", label_fr: "Emirats arabes unis", label_en: "United Arab Emirates", region: "MENA" },
  { iso2: "AL", label_fr: "Albanie", label_en: "Albania", region: "Europe" },
  { iso2: "AR", label_fr: "Argentine", label_en: "Argentina", region: "Americas" },
  { iso2: "AT", label_fr: "Autriche", label_en: "Austria", region: "Europe" },
  { iso2: "AU", label_fr: "Australie", label_en: "Australia", region: "Oceania" },
  { iso2: "BE", label_fr: "Belgique", label_en: "Belgium", region: "Europe" },
  { iso2: "BG", label_fr: "Bulgarie", label_en: "Bulgaria", region: "Europe" },
  { iso2: "BR", label_fr: "Bresil", label_en: "Brazil", region: "Americas" },
  { iso2: "CA", label_fr: "Canada", label_en: "Canada", region: "Americas" },
  { iso2: "CH", label_fr: "Suisse", label_en: "Switzerland", region: "Europe" },
  { iso2: "CL", label_fr: "Chili", label_en: "Chile", region: "Americas" },
  { iso2: "CN", label_fr: "Chine", label_en: "China", region: "Asia" },
  { iso2: "CO", label_fr: "Colombie", label_en: "Colombia", region: "Americas" },
  { iso2: "CR", label_fr: "Costa Rica", label_en: "Costa Rica", region: "Americas" },
  { iso2: "CZ", label_fr: "Tchequie", label_en: "Czech Republic", region: "Europe" },
  { iso2: "DE", label_fr: "Allemagne", label_en: "Germany", region: "Europe" },
  { iso2: "DK", label_fr: "Danemark", label_en: "Denmark", region: "Europe" },
  { iso2: "DZ", label_fr: "Algerie", label_en: "Algeria", region: "Africa" },
  { iso2: "EE", label_fr: "Estonie", label_en: "Estonia", region: "Europe" },
  { iso2: "EG", label_fr: "Egypte", label_en: "Egypt", region: "Africa" },
  { iso2: "ES", label_fr: "Espagne", label_en: "Spain", region: "Europe" },
  { iso2: "FI", label_fr: "Finlande", label_en: "Finland", region: "Europe" },
  { iso2: "FR", label_fr: "France", label_en: "France", region: "Europe" },
  { iso2: "GB", label_fr: "Royaume-Uni", label_en: "United Kingdom", region: "Europe" },
  { iso2: "GH", label_fr: "Ghana", label_en: "Ghana", region: "Africa" },
  { iso2: "GR", label_fr: "Grece", label_en: "Greece", region: "Europe" },
  { iso2: "HK", label_fr: "Hong Kong", label_en: "Hong Kong", region: "Asia" },
  { iso2: "HR", label_fr: "Croatie", label_en: "Croatia", region: "Europe" },
  { iso2: "HU", label_fr: "Hongrie", label_en: "Hungary", region: "Europe" },
  { iso2: "ID", label_fr: "Indonesie", label_en: "Indonesia", region: "Asia" },
  { iso2: "IE", label_fr: "Irlande", label_en: "Ireland", region: "Europe" },
  { iso2: "IL", label_fr: "Israel", label_en: "Israel", region: "MENA" },
  { iso2: "IN", label_fr: "Inde", label_en: "India", region: "Asia" },
  { iso2: "IT", label_fr: "Italie", label_en: "Italy", region: "Europe" },
  { iso2: "JP", label_fr: "Japon", label_en: "Japan", region: "Asia" },
  { iso2: "KE", label_fr: "Kenya", label_en: "Kenya", region: "Africa" },
  { iso2: "KR", label_fr: "Coree du Sud", label_en: "South Korea", region: "Asia" },
  { iso2: "LT", label_fr: "Lituanie", label_en: "Lithuania", region: "Europe" },
  { iso2: "LU", label_fr: "Luxembourg", label_en: "Luxembourg", region: "Europe" },
  { iso2: "LV", label_fr: "Lettonie", label_en: "Latvia", region: "Europe" },
  { iso2: "MA", label_fr: "Maroc", label_en: "Morocco", region: "Africa" },
  { iso2: "ME", label_fr: "Montenegro", label_en: "Montenegro", region: "Europe" },
  { iso2: "MG", label_fr: "Madagascar", label_en: "Madagascar", region: "Africa" },
  { iso2: "MK", label_fr: "Macedoine du Nord", label_en: "North Macedonia", region: "Europe" },
  { iso2: "MX", label_fr: "Mexique", label_en: "Mexico", region: "Americas" },
  { iso2: "MY", label_fr: "Malaisie", label_en: "Malaysia", region: "Asia" },
  { iso2: "NG", label_fr: "Nigeria", label_en: "Nigeria", region: "Africa" },
  { iso2: "NL", label_fr: "Pays-Bas", label_en: "Netherlands", region: "Europe" },
  { iso2: "NO", label_fr: "Norvege", label_en: "Norway", region: "Europe" },
  { iso2: "NZ", label_fr: "Nouvelle-Zelande", label_en: "New Zealand", region: "Oceania" },
  { iso2: "PE", label_fr: "Perou", label_en: "Peru", region: "Americas" },
  { iso2: "PH", label_fr: "Philippines", label_en: "Philippines", region: "Asia" },
  { iso2: "PL", label_fr: "Pologne", label_en: "Poland", region: "Europe" },
  { iso2: "PT", label_fr: "Portugal", label_en: "Portugal", region: "Europe" },
  { iso2: "QA", label_fr: "Qatar", label_en: "Qatar", region: "MENA" },
  { iso2: "RO", label_fr: "Roumanie", label_en: "Romania", region: "Europe" },
  { iso2: "SA", label_fr: "Arabie saoudite", label_en: "Saudi Arabia", region: "MENA" },
  { iso2: "SE", label_fr: "Suede", label_en: "Sweden", region: "Europe" },
  { iso2: "SG", label_fr: "Singapour", label_en: "Singapore", region: "Asia" },
  { iso2: "SI", label_fr: "Slovenie", label_en: "Slovenia", region: "Europe" },
  { iso2: "SK", label_fr: "Slovaquie", label_en: "Slovakia", region: "Europe" },
  { iso2: "SN", label_fr: "Senegal", label_en: "Senegal", region: "Africa" },
  { iso2: "TH", label_fr: "Thailande", label_en: "Thailand", region: "Asia" },
  { iso2: "TN", label_fr: "Tunisie", label_en: "Tunisia", region: "Africa" },
  { iso2: "TR", label_fr: "Turquie", label_en: "Turkey", region: "MENA" },
  { iso2: "TW", label_fr: "Taiwan", label_en: "Taiwan", region: "Asia" },
  { iso2: "UA", label_fr: "Ukraine", label_en: "Ukraine", region: "Europe" },
  { iso2: "US", label_fr: "Etats-Unis", label_en: "United States", region: "Americas" },
  { iso2: "UY", label_fr: "Uruguay", label_en: "Uruguay", region: "Americas" },
  { iso2: "VN", label_fr: "Vietnam", label_en: "Vietnam", region: "Asia" },
  { iso2: "ZA", label_fr: "Afrique du Sud", label_en: "South Africa", region: "Africa" },
];

export const PRODUCTS: ProductOption[] = [
  { code: "strawberries", label_fr: "Fraises fraiches", label_en: "Fresh strawberries", hs6: "081010", tags: ["agri", "fresh"] },
  { code: "frozen_berries", label_fr: "Fruits rouges surgeles", label_en: "Frozen berries", hs6: "081190", tags: ["agri", "frozen"] },
  { code: "olive_oil", label_fr: "Huile d'olive", label_en: "Olive oil", hs6: "150910", tags: ["food"] },
  { code: "wine", label_fr: "Vin en bouteille", label_en: "Bottled wine", hs6: "220421", tags: ["beverage"] },
  { code: "chocolate", label_fr: "Chocolat", label_en: "Chocolate", hs6: "180690", tags: ["food"] },
  { code: "cheese", label_fr: "Fromage affiné", label_en: "Aged cheese", hs6: "040690", tags: ["food"] },
  { code: "yogurt", label_fr: "Yaourt", label_en: "Yogurt", hs6: "040310", tags: ["food", "cold_chain"] },
  { code: "coffee", label_fr: "Cafe torrefie", label_en: "Roasted coffee", hs6: "090121", tags: ["food"] },
  { code: "tea", label_fr: "The noir", label_en: "Black tea", hs6: "090240", tags: ["food"] },
  { code: "honey", label_fr: "Miel", label_en: "Honey", hs6: "040900", tags: ["food"] },
  { code: "biscuits", label_fr: "Biscuits", label_en: "Biscuits", hs6: "190531", tags: ["food"] },
  { code: "baby_food", label_fr: "Aliments pour bebes", label_en: "Baby food", hs6: "190110", tags: ["food", "regulated"] },
  { code: "perfume", label_fr: "Parfum", label_en: "Perfume", hs6: "330300", tags: ["cosmetics"] },
  { code: "cream", label_fr: "Creme de soin", label_en: "Skincare cream", hs6: "330499", tags: ["cosmetics"] },
  { code: "shampoo", label_fr: "Shampooing", label_en: "Shampoo", hs6: "330510", tags: ["cosmetics"] },
  { code: "soap", label_fr: "Savon", label_en: "Soap", hs6: "340111", tags: ["cosmetics"] },
  { code: "medical_gloves", label_fr: "Gants medicaux", label_en: "Medical gloves", hs6: "401519", tags: ["medical"] },
  { code: "syringes", label_fr: "Seringues", label_en: "Syringes", hs6: "901831", tags: ["medical"] },
  { code: "diagnostic_kits", label_fr: "Kits diagnostiques", label_en: "Diagnostic kits", hs6: "382219", tags: ["medical", "regulated"] },
  { code: "pharma_pack", label_fr: "Conditionnement pharma", label_en: "Pharma packaging", hs6: "392329", tags: ["medical"] },
  { code: "cotton_tshirts", label_fr: "T-shirts coton", label_en: "Cotton t-shirts", hs6: "610910", tags: ["textile"] },
  { code: "sports_shoes", label_fr: "Chaussures sport", label_en: "Sports shoes", hs6: "640411", tags: ["textile"] },
  { code: "handbags", label_fr: "Sacs a main", label_en: "Handbags", hs6: "420221", tags: ["fashion"] },
  { code: "wool_coats", label_fr: "Manteaux laine", label_en: "Wool coats", hs6: "620211", tags: ["fashion"] },
  { code: "leather_belts", label_fr: "Ceintures cuir", label_en: "Leather belts", hs6: "420330", tags: ["fashion"] },
  { code: "ceramic_tiles", label_fr: "Carrelage ceramique", label_en: "Ceramic tiles", hs6: "690721", tags: ["construction"] },
  { code: "aluminium_profiles", label_fr: "Profiles aluminium", label_en: "Aluminium profiles", hs6: "760421", tags: ["construction"] },
  { code: "steel_tubes", label_fr: "Tubes acier", label_en: "Steel tubes", hs6: "730661", tags: ["construction"] },
  { code: "wood_panels", label_fr: "Panneaux bois", label_en: "Wood panels", hs6: "441233", tags: ["construction"] },
  { code: "electrical_transformers", label_fr: "Transformateurs electriques", label_en: "Electrical transformers", hs6: "850433", tags: ["industry"] },
  { code: "solar_panels", label_fr: "Panneaux solaires", label_en: "Solar panels", hs6: "854143", tags: ["energy"] },
  { code: "lithium_batteries", label_fr: "Batteries lithium-ion", label_en: "Lithium-ion batteries", hs6: "850760", tags: ["dangerous_goods"] },
  { code: "smartphones", label_fr: "Smartphones", label_en: "Smartphones", hs6: "851713", tags: ["electronics"] },
  { code: "laptops", label_fr: "Ordinateurs portables", label_en: "Laptops", hs6: "847130", tags: ["electronics"] },
  { code: "routers", label_fr: "Routeurs reseau", label_en: "Network routers", hs6: "851762", tags: ["electronics"] },
  { code: "industrial_sensors", label_fr: "Capteurs industriels", label_en: "Industrial sensors", hs6: "903180", tags: ["industry"] },
  { code: "auto_brake_kits", label_fr: "Kits de freinage auto", label_en: "Automotive brake kits", hs6: "870830", tags: ["automotive"] },
  { code: "auto_filters", label_fr: "Filtres automobiles", label_en: "Automotive filters", hs6: "842123", tags: ["automotive"] },
  { code: "engine_oil", label_fr: "Huile moteur", label_en: "Engine oil", hs6: "271019", tags: ["automotive"] },
  { code: "bicycle_parts", label_fr: "Pieces de velos", label_en: "Bicycle parts", hs6: "871499", tags: ["mobility"] },
  { code: "furniture_chairs", label_fr: "Chaises de bureau", label_en: "Office chairs", hs6: "940130", tags: ["furniture"] },
  { code: "mattresses", label_fr: "Matelas", label_en: "Mattresses", hs6: "940421", tags: ["furniture"] },
  { code: "packaging_boxes", label_fr: "Boites carton", label_en: "Cardboard boxes", hs6: "481910", tags: ["packaging"] },
  { code: "plastic_bottles", label_fr: "Bouteilles plastiques", label_en: "Plastic bottles", hs6: "392330", tags: ["packaging"] },
  { code: "glass_bottles", label_fr: "Bouteilles en verre", label_en: "Glass bottles", hs6: "701090", tags: ["packaging"] },
  { code: "fish_frozen", label_fr: "Poisson surgele", label_en: "Frozen fish", hs6: "030389", tags: ["food", "cold_chain"] },
  { code: "shrimp_frozen", label_fr: "Crevettes surgelees", label_en: "Frozen shrimp", hs6: "030617", tags: ["food", "cold_chain"] },
  { code: "rice", label_fr: "Riz", label_en: "Rice", hs6: "100630", tags: ["food"] },
  { code: "wheat_flour", label_fr: "Farine de ble", label_en: "Wheat flour", hs6: "110100", tags: ["food"] },
  { code: "sugar", label_fr: "Sucre de canne", label_en: "Cane sugar", hs6: "170114", tags: ["food"] },
  { code: "mineral_water", label_fr: "Eau minerale", label_en: "Mineral water", hs6: "220110", tags: ["beverage"] },
  { code: "fruit_juice", label_fr: "Jus de fruits", label_en: "Fruit juice", hs6: "200990", tags: ["beverage"] },
  { code: "beer", label_fr: "Biere", label_en: "Beer", hs6: "220300", tags: ["beverage"] },
  { code: "cement", label_fr: "Ciment", label_en: "Cement", hs6: "252329", tags: ["construction"] },
  { code: "paint", label_fr: "Peinture acrylique", label_en: "Acrylic paint", hs6: "320910", tags: ["construction"] },
  { code: "fertilizer", label_fr: "Engrais NPK", label_en: "NPK fertilizer", hs6: "310520", tags: ["agri"] },
  { code: "seeds", label_fr: "Semences potageres", label_en: "Vegetable seeds", hs6: "120991", tags: ["agri", "phytosanitary"] },
  { code: "wood_pellets", label_fr: "Granules de bois", label_en: "Wood pellets", hs6: "440131", tags: ["energy"] },
  { code: "paper_reels", label_fr: "Bobines papier", label_en: "Paper reels", hs6: "480255", tags: ["industry"] },
];

export const HS_OPTIONS: LocalizedOption[] = PRODUCTS.map((product) => ({
  value: product.hs6,
  label_fr: `${product.hs6} - ${product.label_fr}`,
  label_en: `${product.hs6} - ${product.label_en}`,
}));

export function getLocalizedLabel(option: LocalizedOption, lang: UiLang) {
  return lang === "en" ? option.label_en : option.label_fr;
}

export function getCountryLabel(countryIso2: string | null | undefined, lang: UiLang) {
  const code = String(countryIso2 || "").toUpperCase();
  if (!code) return "-";
  const found = COUNTRIES.find((item) => item.iso2 === code);
  if (!found) return code;
  return lang === "en" ? found.label_en : found.label_fr;
}

export function getProductByCode(code: string | null | undefined) {
  const value = String(code || "").trim();
  return PRODUCTS.find((item) => item.code === value) || null;
}

export function getProductByHs6(hs6: string | null | undefined) {
  const value = String(hs6 || "").replace(/[^0-9]/g, "").slice(0, 6);
  if (!value) return null;
  return PRODUCTS.find((item) => item.hs6 === value) || null;
}

export function getBandMidValue(band: string) {
  if (band === "0-1000") return 500;
  if (band === "1000-5000") return 3000;
  if (band === "5000-20000") return 12000;
  if (band === "20000-100000") return 50000;
  if (band === "100000+") return 150000;
  return 0;
}

export function getWeightApproxKg(band: string) {
  if (band === "0-5") return 3;
  if (band === "5-20") return 12;
  if (band === "20-100") return 60;
  if (band === "100-500") return 250;
  if (band === "500+") return 700;
  return 0;
}

export function getVolumeApproxM3(band: string) {
  if (band === "0-0.1") return 0.05;
  if (band === "0.1-1") return 0.5;
  if (band === "1-5") return 2.5;
  if (band === "5-15") return 8;
  if (band === "15+") return 20;
  return 0;
}

export const OFFICIAL_LINKS = {
  access2markets: "https://trade.ec.europa.eu/access-to-markets/en/home",
  taric: "https://ec.europa.eu/taxation_customs/dds2/taric/taric_consultation.jsp",
  douane_fr: "https://www.douane.gouv.fr",
  eu_sanctions: "https://www.sanctionsmap.eu/",
  ofac: "https://ofac.treasury.gov/sanctions-programs-and-country-information",
  un_sanctions: "https://main.un.org/securitycouncil/en/sanctions/information",
  incoterms_icc: "https://iccwbo.org/business-solutions/incoterms-rules/",
};
