import type { Lang, SourceLink } from "./types";

type BuildOfficialLinksParams = {
  question?: string | null;
  destinationIso2?: string | null;
  originIso2?: string | null;
  product?: string | null;
  lang?: Lang;
};

type CountryNames = {
  fr: string;
  en: string;
};

type CountryDirectory = {
  aliasToIso2: Map<string, string>;
  namesByIso2: Map<string, CountryNames>;
  maxAliasWords: number;
};

const WCO_MEMBERS_URL = "https://www.wcoomd.org/en/about-us/wco-members/membership.aspx";

const EU_SOURCES: SourceLink[] = [
  { title: "Access2Markets (UE)", url: "https://trade.ec.europa.eu/access-to-markets/en/home" },
  { title: "TARIC (UE)", url: "https://ec.europa.eu/taxation_customs/dds2/taric/taric_consultation.jsp?Lang=en" },
  { title: "Douane francaise", url: "https://www.douane.gouv.fr/" },
];

const CUSTOMS_URL_BY_ISO2: Record<string, string> = {
  FR: "https://www.douane.gouv.fr/",
  BE: "https://finances.belgium.be/fr/douanes_et_accises",
  NL: "https://www.belastingdienst.nl/wps/wcm/connect/bldcontenten/belastingdienst/customs",
  DE: "https://www.zoll.de/EN/Home/home_node.html",
  ES: "https://sede.agenciatributaria.gob.es/Sede/en_gb/aduanas.html",
  IT: "https://www.adm.gov.it/portale/",
  PT: "https://info-aduaneiro.portaldasfinancas.gov.pt/",
  IE: "https://www.revenue.ie/en/customs/index.aspx",
  LU: "https://douanes.public.lu/",
  AT: "https://www.bmf.gv.at/en/topics/customs.html",
  PL: "https://www.puesc.gov.pl/",
  CZ: "https://www.celnisprava.cz/en/Pages/default.aspx",
  SE: "https://www.tullverket.se/en/startpage.4.7df61c5915510cfe9e7106e2.html",
  DK: "https://skat.dk/en-us/businesses/customs",
  FI: "https://tulli.fi/en/frontpage",
  RO: "https://www.customs.ro/",
  BG: "https://customs.bg/",
  HR: "https://carina.gov.hr/",
  SI: "https://www.fu.gov.si/en/customs/",
  EE: "https://www.emta.ee/en/business-client/customs-trade-goods",
  LV: "https://www.vid.gov.lv/en/customs",
  LT: "https://lrmuitine.lt/web/en",
  CY: "https://www.mof.gov.cy/mof/customs/customs.nsf/index_en/index_en",
  MT: "https://customs.gov.mt/",
  GB: "https://www.gov.uk/topic/business-tax/import-export",
  US: "https://www.cbp.gov/trade",
  CA: "https://www.cbsa-asfc.gc.ca/import/menu-eng.html",
  MX: "https://www.gob.mx/aduanas",
  BR: "https://www.gov.br/receitafederal/pt-br/assuntos/aduana",
  AR: "https://www.afip.gob.ar/aduana/",
  CL: "https://www.aduana.cl/",
  CO: "https://www.dian.gov.co/aduanas/",
  PE: "https://www.sunat.gob.pe/aduanas.html",
  MA: "https://www.douane.gov.ma/",
  DZ: "https://www.douane.gov.dz/",
  TN: "https://www.douane.gov.tn/",
  EG: "https://www.nafeza.gov.eg/",
  ZA: "https://www.sars.gov.za/customs-and-excise/",
  NG: "https://www.customs.gov.ng/",
  TR: "https://www.trade.gov.tr/customs",
  CH: "https://www.bazg.admin.ch/bazg/en/home.html",
  NO: "https://www.toll.no/en/",
  RU: "https://customs.gov.ru/",
  CN: "http://english.customs.gov.cn/",
  JP: "https://www.customs.go.jp/english/",
  KR: "https://www.customs.go.kr/english/cm/cntnts/cntntsView.do?mi=8056&cntntsId=2724",
  IN: "https://www.cbic.gov.in/htdocs-cbec/customs",
  SG: "https://www.customs.gov.sg/",
  AE: "https://www.fca.gov.ae/en/pages/default.aspx",
  SA: "https://zatca.gov.sa/en/Customs/Pages/default.aspx",
  AU: "https://www.abf.gov.au/importing-exporting-and-manufacturing/importing",
  NZ: "https://www.customs.govt.nz/",
};

const MANUAL_ALIAS_TO_ISO2: Record<string, string> = {
  uk: "GB",
  gb: "GB",
  "great britain": "GB",
  angleterre: "GB",
  "royaume uni": "GB",
  "united kingdom": "GB",
  usa: "US",
  "etats unis": "US",
  "united states": "US",
  "united states of america": "US",
  uae: "AE",
  "emirats arabes unis": "AE",
  emirats: "AE",
  "coree du sud": "KR",
  "south korea": "KR",
  "north korea": "KP",
  "coree du nord": "KP",
  bresil: "BR",
  brazil: "BR",
  russie: "RU",
  russia: "RU",
  chine: "CN",
  china: "CN",
};

const GLOBAL_ACTIVITY_RE =
  /\b(mondial|monde|global|world|international|commerce mondial|marche mondial|world trade|trade flow|flux mondial|tendance|bourse|commodity|commodities|supply chain|prix mondial|google alert|rss|who)\b/i;

const PRODUCT_HINT_RE =
  /\b(produit|product|marchandise|exporte|importe|hs|code hs|commodity|goods?)\b/i;

function normalize(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeLinks(links: SourceLink[]) {
  const byUrl = new Map<string, SourceLink>();
  for (const link of links) {
    if (!/^https?:\/\//i.test(link.url)) continue;
    byUrl.set(link.url, link);
  }
  return Array.from(byUrl.values());
}

function createDisplayNames(locale: string) {
  try {
    return new Intl.DisplayNames([locale], { type: "region" });
  } catch {
    return null;
  }
}

function buildCountryDirectory(): CountryDirectory {
  const aliasToIso2 = new Map<string, string>();
  const namesByIso2 = new Map<string, CountryNames>();
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const displayEn = createDisplayNames("en");
  const displayFr = createDisplayNames("fr");

  const addAlias = (alias: string, iso2: string) => {
    const key = normalize(alias);
    if (!key || key.length < 2) return;
    aliasToIso2.set(key, iso2);
  };

  const addCountry = (iso2: string, enName: string, frName: string) => {
    if (!/^[A-Z]{2}$/.test(iso2)) return;
    namesByIso2.set(iso2, { en: enName, fr: frName });
    addAlias(enName, iso2);
    addAlias(frName, iso2);
    addAlias(enName.replace(/^the\s+/i, ""), iso2);
    addAlias(frName.replace(/^(les|la|le)\s+/i, ""), iso2);
  };

  for (let i = 0; i < letters.length; i += 1) {
    for (let j = 0; j < letters.length; j += 1) {
      const iso2 = `${letters[i]}${letters[j]}`;
      const enName = String(displayEn?.of(iso2) || "").trim();
      if (!enName || enName.toUpperCase() === iso2) continue;
      const frName = String(displayFr?.of(iso2) || enName).trim() || enName;
      addCountry(iso2, enName, frName);
    }
  }

  for (const [alias, iso2] of Object.entries(MANUAL_ALIAS_TO_ISO2)) {
    addAlias(alias, iso2);
  }

  let maxAliasWords = 1;
  for (const key of aliasToIso2.keys()) {
    maxAliasWords = Math.max(maxAliasWords, key.split(" ").length);
  }

  return { aliasToIso2, namesByIso2, maxAliasWords };
}

const COUNTRY_DIRECTORY = buildCountryDirectory();

export function countryNameFromIso2(iso2: string | null | undefined, lang: Lang = "fr") {
  const code = String(iso2 || "").trim().toUpperCase();
  const names = COUNTRY_DIRECTORY.namesByIso2.get(code);
  if (!names) return code || "";
  return lang === "en" ? names.en : names.fr;
}

export function resolveCountryIso2(value: string | null | undefined): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const explicitIso = raw.match(/\b([A-Za-z]{2})\b/);
  if (explicitIso) {
    const iso = explicitIso[1].toUpperCase();
    if (COUNTRY_DIRECTORY.namesByIso2.has(iso)) return iso;
  }

  const normalized = normalize(raw);
  if (!normalized) return null;

  if (COUNTRY_DIRECTORY.aliasToIso2.has(normalized)) {
    return COUNTRY_DIRECTORY.aliasToIso2.get(normalized) || null;
  }

  const tokens = normalized.split(" ").filter(Boolean);
  for (let n = Math.min(COUNTRY_DIRECTORY.maxAliasWords, tokens.length); n >= 1; n -= 1) {
    for (let i = 0; i <= tokens.length - n; i += 1) {
      const phrase = tokens.slice(i, i + n).join(" ");
      const iso = COUNTRY_DIRECTORY.aliasToIso2.get(phrase);
      if (iso) return iso;
    }
  }

  return null;
}

export function extractCountriesFromText(text: string, limit = 3): string[] {
  const normalized = normalize(text);
  if (!normalized) return [];

  const tokens = normalized.split(" ").filter(Boolean);
  const matches: Array<{ iso2: string; index: number }> = [];

  for (let n = Math.min(COUNTRY_DIRECTORY.maxAliasWords, tokens.length); n >= 1; n -= 1) {
    for (let i = 0; i <= tokens.length - n; i += 1) {
      const phrase = tokens.slice(i, i + n).join(" ");
      const iso = COUNTRY_DIRECTORY.aliasToIso2.get(phrase);
      if (!iso) continue;
      matches.push({ iso2: iso, index: i });
      i += n - 1;
    }
  }

  const unique = new Set<string>();
  const ordered = matches
    .sort((a, b) => a.index - b.index)
    .map((item) => item.iso2)
    .filter((iso2) => {
      if (unique.has(iso2)) return false;
      unique.add(iso2);
      return true;
    });

  return ordered.slice(0, Math.max(1, limit));
}

function buildCountryCustomsLink(iso2: string, lang: Lang): SourceLink {
  const label = countryNameFromIso2(iso2, lang) || iso2;
  const officialUrl = CUSTOMS_URL_BY_ISO2[iso2];
  if (officialUrl) {
    return {
      title: lang === "en" ? `Customs authority - ${label}` : `Douane officielle - ${label}`,
      url: officialUrl,
    };
  }

  return {
    title: lang === "en" ? `Customs authority - ${label}` : `Douane officielle - ${label}`,
    url: `https://www.google.com/search?q=${encodeURIComponent(`${label} official customs authority`)}`,
  };
}

function extractProductHint(question: string) {
  const normalized = normalize(question);
  if (!normalized) return null;

  const m = normalized.match(
    /\b(?:produit|product|marchandise)\s*(?::|-)?\s*([a-z0-9][a-z0-9\s-]{2,80})\b/
  );
  if (m?.[1]) return m[1].trim();

  const v = normalized.match(
    /\b(?:j exporte|nous exportons|j importe|nous importons|export|import)\s+([a-z0-9][a-z0-9\s-]{2,80})\b/
  );
  if (v?.[1]) return v[1].trim();

  return null;
}

export function detectGlobalTradeIntent(params: { question?: string | null; product?: string | null }) {
  const question = String(params.question || "").trim();
  const product = String(params.product || "").trim();
  const text = `${question} ${product}`.trim();
  if (!text) return false;
  if (!GLOBAL_ACTIVITY_RE.test(text)) return false;
  return PRODUCT_HINT_RE.test(text) || Boolean(product);
}

function buildGlobalMonitoringLinks(params: { question: string; product: string | null; lang: Lang }): SourceLink[] {
  const query = (params.product || extractProductHint(params.question) || "commerce mondial export import")
    .slice(0, 120)
    .trim();
  const googleRssQuery = `${query} commerce mondial export import`;

  return [
    { title: "WHO News", url: "https://www.who.int/news-room" },
    {
      title:
        params.lang === "en"
          ? `Google News RSS - ${query}`
          : `Flux RSS Google News - ${query}`,
      url: `https://news.google.com/rss/search?q=${encodeURIComponent(googleRssQuery)}&hl=fr&gl=FR&ceid=FR:fr`,
    },
    { title: "Google Alerts", url: "https://www.google.com/alerts" },
    { title: "WTO News", url: "https://www.wto.org/english/news_e/news_e.htm" },
  ];
}

export function buildOfficialLinks(params: BuildOfficialLinksParams): SourceLink[] {
  const question = String(params.question || "").trim();
  const lang = params.lang || "fr";
  const product = String(params.product || "").trim() || null;

  const countriesFromQuestion = extractCountriesFromText(question, 3);
  const orderedIso2 = [
    params.destinationIso2,
    params.originIso2,
    ...countriesFromQuestion,
  ]
    .map((value) => resolveCountryIso2(value || null))
    .filter((value): value is string => Boolean(value));

  const uniqueIso2 = Array.from(new Set(orderedIso2));

  const links: SourceLink[] = [];

  for (const iso2 of uniqueIso2.slice(0, 2)) {
    links.push(buildCountryCustomsLink(iso2, lang));
  }

  if (uniqueIso2.length > 0 && product) {
    const countryLabel = countryNameFromIso2(uniqueIso2[0], lang);
    links.push({
      title:
        lang === "en"
          ? `Product rules - ${countryLabel}`
          : `Regles produit - ${countryLabel}`,
      url: `https://www.google.com/search?q=${encodeURIComponent(
        `${product} import requirements ${countryLabel} customs`
      )}`,
    });
  }

  links.push(...EU_SOURCES);
  links.push({
    title: lang === "en" ? "WCO members directory" : "Annuaire OMD des douanes",
    url: WCO_MEMBERS_URL,
  });

  if (detectGlobalTradeIntent({ question, product })) {
    links.push(...buildGlobalMonitoringLinks({ question, product, lang }));
  }

  if (question) {
    links.push({
      title: lang === "en" ? "Targeted search" : "Recherche web ciblee",
      url: `https://www.google.com/search?q=${encodeURIComponent(`${question} reglementation douane`)}`,
    });
  }

  return dedupeLinks(links).slice(0, 12);
}
