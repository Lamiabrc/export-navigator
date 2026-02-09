import * as React from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, ExternalLink, FileSpreadsheet, MapPin, RotateCcw, Rss, Upload } from "lucide-react";
import worldMap from "@/assets/world-map.svg";
import { useCompanyProfile } from "@/hooks/useCompanyProfile";
import { TERRITORY_PCT } from "@/domain/geo/territoryPct";

type CsvState = {
  headers: string[];
  rows: string[][];
  delimiter: string;
};

type SalesRow = {
  line: number;
  hs: string;
  destination: string;
  destinationLabel: string;
  productLabel: string | null;
  quantity: number;
  unitPrice: number | null;
  totalSales: number;
  currency: string;
  unitCost: number;
  transportCost: number;
  packagingCost: number;
  dossierFee: number;
  otherCosts: number;
  totalCosts: number;
  margin: number;
  marginPct: number | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
};

type Agg = {
  code: string;
  name: string;
  revenue: number;
  costs: number;
  margin: number;
  quantity: number;
  lines: number;
};

type RssSource = { name: string; url: string };
type RssItem = {
  id: string;
  title: string;
  link: string;
  sourceName: string;
  publishedAt: number | null;
};

const MAP_WIDTH = 1010;
const MAP_HEIGHT = 666;
const MAP_INSET = { left: 0, right: 0, top: 0, bottom: 0 };

const COUNTRY_COORDS: Record<string, { name: string; lat: number; lon: number }> = {
  FR: { name: "France", lat: 46.2276, lon: 2.2137 },
  DE: { name: "Allemagne", lat: 51.1657, lon: 10.4515 },
  ES: { name: "Espagne", lat: 40.4637, lon: -3.7492 },
  IT: { name: "Italie", lat: 41.8719, lon: 12.5674 },
  GB: { name: "Royaume-Uni", lat: 55.3781, lon: -3.436 },
  BE: { name: "Belgique", lat: 50.5039, lon: 4.4699 },
  NL: { name: "Pays-Bas", lat: 52.1326, lon: 5.2913 },
  CH: { name: "Suisse", lat: 46.8182, lon: 8.2275 },
  US: { name: "États-Unis", lat: 37.0902, lon: -95.7129 },
  CA: { name: "Canada", lat: 56.1304, lon: -106.3468 },
  MX: { name: "Mexique", lat: 23.6345, lon: -102.5528 },
  BR: { name: "Brésil", lat: -14.235, lon: -51.9253 },
  CN: { name: "Chine", lat: 35.8617, lon: 104.1954 },
  JP: { name: "Japon", lat: 36.2048, lon: 138.2529 },
  KR: { name: "Corée du Sud", lat: 35.9078, lon: 127.7669 },
  IN: { name: "Inde", lat: 20.5937, lon: 78.9629 },
  AE: { name: "Émirats arabes unis", lat: 23.4241, lon: 53.8478 },
  SA: { name: "Arabie saoudite", lat: 23.8859, lon: 45.0792 },
  TR: { name: "Turquie", lat: 38.9637, lon: 35.2433 },
  MA: { name: "Maroc", lat: 31.7917, lon: -7.0926 },
  DZ: { name: "Algérie", lat: 28.0339, lon: 1.6596 },
  TN: { name: "Tunisie", lat: 33.8869, lon: 9.5375 },
  ZA: { name: "Afrique du Sud", lat: -30.5595, lon: 22.9375 },
  AU: { name: "Australie", lat: -25.2744, lon: 133.7751 },
};

const COLUMN_ALIASES = {
  hs: ["hs_code", "hscode", "hs", "code_hs", "codehs"],
  destination: ["destination_country", "destination", "pays", "country", "country_code", "dest"],
  quantity: ["quantity", "quantite", "qty", "qte"],
  unitPrice: ["unit_price", "prix_unitaire", "prix_vente", "sale_price", "price"],
  totalPrice: ["total_price", "montant", "total", "sales_total", "ca"],
  currency: ["currency", "devise"],
  productLabel: ["product_label", "produit", "libelle", "description", "product_name"],
  unitCost: ["unit_cost", "cout_unitaire", "cost_unit", "cogs_unit", "cost_of_goods"],
  transportCost: ["transport_cost", "frais_transport", "shipping_cost", "freight_cost"],
  packagingCost: ["packaging_cost", "frais_emballage", "packaging"],
  dossierFee: ["dossier_fee", "frais_dossier", "file_fee"],
  otherCosts: ["other_costs", "autres_frais", "misc_fees"],
  invoiceNumber: ["invoice_number", "numero_facture", "facture", "invoice_no"],
  invoiceDate: ["invoice_date", "date_facture", "date"],
};

const CSV_TEMPLATE = [
  // ✅ Template PME-friendly (simple + extensible, séparateur ;)
  // Colonnes obligatoires: hs_code, destination_country, quantity, (unit_price OU total_price)
  "invoice_number;invoice_date;destination_country;hs_code;product_label;quantity;unit_price;total_price;currency;incoterm;unit_cost;transport_cost;packaging_cost;dossier_fee;other_costs;notes",
  "INV-2026-0001;2026-01-15;DE;85044090;Alimentation électrique industrielle;120;89;;EUR;DAP;35;180;40;25;10;Commande B2B",
  "INV-2026-0002;2026-01-18;US;94036090;Mobilier en bois (lot);80;920;;EUR;CIF;540;220;60;30;12;Export salon",
].join("\n");

/** RSS sources (country-specific + global). */
const GLOBAL_RSS_SOURCES: RssSource[] = [
  { name: "UE – Actualités commerce", url: "https://policy.trade.ec.europa.eu/node/2/rss_en" },
  { name: "OMC – Dernières nouvelles", url: "https://www.wto.org/library/rss/latest_news_e.xml" },
];

const COUNTRY_RSS_SOURCES: Record<string, RssSource[]> = {
  FR: [
    { name: "Economie.gouv.fr – Actualités", url: "https://www.economie.gouv.fr/rss/toutesactualites" },
    { name: "Service-Public Pro – Actualités", url: "https://www.service-public.gouv.fr/abonnements/rss/actu-actu-pro.rss" },
    { name: "France Diplomatie – News", url: "https://www.diplomatie.gouv.fr/en/backend-fd.php3" },
  ],
  DE: [{ name: "BMWK – Pressemitteilungen", url: "https://www.bmwk.de/SiteGlobals/Functions/RSSFeed/RSSFeed-Pressemitteilung.xml" }],
  BE: [{ name: "news.belgium.be – All news", url: "https://news.belgium.be/en/feeds/all" }],
  NL: [{ name: "Government.nl – All news", url: "https://feeds.government.nl/news.rss" }],
  CH: [
    { name: "FINMA – International sanctions", url: "https://www.finma.ch/en/rss/rss-internationale-sanktionen.xml" },
    { name: "FINMA – News", url: "https://www.finma.ch/en/rss/rss-finma-news.xml" },
  ],
  CA: [
    {
      name: "Global Affairs Canada – News releases (Atom)",
      url: "https://api.io.canada.ca/io-server/gc/news/en/v2?atomtitle=Global+Affairs+Canada+news+releases&dept=departmentofforeignaffairstradeanddevelopment&format=atom&orderBy=desc&pick=1000&publishedDate%3E=2015-01-01&sort=publishedDate&type=newsreleases",
    },
  ],
  US: [
    { name: "USTR – Press releases", url: "https://ustr.gov/archive/Meta_Content/RSS/ustr_press_releases_10475.xml" },
    { name: "USTR – Recent news", url: "https://ustr.gov/archive/Meta_Content/RSS/ustr_recent_news_10495.xml" },
  ],
};

function stripDiacritics(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeHeader(value: string) {
  return stripDiacritics(String(value || ""))
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeHS(value: string) {
  return String(value || "").replace(/[^0-9]/g, "");
}

function normalizeCountryCode(value: string) {
  const raw = stripDiacritics(String(value || "")).trim();
  if (!raw) return "";
  return raw.split(/[\s,;/_-]+/)[0].toUpperCase();
}

function parseNumber(value: string | null | undefined) {
  if (value === null || value === undefined) return null;
  let s = String(value).trim();
  if (!s) return null;
  s = s.replace(/\s+/g, "").replace(/[^0-9,.-]/g, "");
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
  }
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${Math.round(value * 1000) / 10}%`;
}

function territoryLabel(code: string) {
  if (!code) return "—";
  const upper = code.toUpperCase();
  if (COUNTRY_COORDS[upper]?.name) return COUNTRY_COORDS[upper].name;
  try {
    const dn = new Intl.DisplayNames(["fr"], { type: "region" });
    return dn.of(upper) || upper;
  } catch {
    return upper;
  }
}

function guessDelimiter(line: string) {
  const candidates = [";", ",", "\t"];
  let best = candidates[0];
  let bestCount = -1;
  for (const c of candidates) {
    const count = line.split(c).length - 1;
    if (count > bestCount) {
      bestCount = count;
      best = c;
    }
  }
  return best;
}

function parseCsvRows(text: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === delimiter) {
      row.push(current);
      current = "";
      continue;
    }

    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && next === "\n") i += 1;
      row.push(current);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += ch;
  }

  row.push(current);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
}

function parseCsvText(text: string): CsvState {
  const clean = text.replace(/^\uFEFF/, "").trim();
  if (!clean) return { headers: [], rows: [], delimiter: ";" };
  const firstLine = clean.split(/\r?\n/)[0] ?? "";
  const delimiter = guessDelimiter(firstLine);
  const rows = parseCsvRows(clean, delimiter);
  const headers = rows.shift() || [];
  return { headers, rows, delimiter };
}

function downloadTextFile(filename: string, content: string) {
  try {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch {
    // noop
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

/** Equirectangular projection on the SVG world map (works well to place FR correctly). */
function projectLatLon(lat: number, lon: number) {
  const x = ((lon + 180) / 360) * (MAP_WIDTH - MAP_INSET.left - MAP_INSET.right) + MAP_INSET.left;
  const y = ((90 - lat) / 180) * (MAP_HEIGHT - MAP_INSET.top - MAP_INSET.bottom) + MAP_INSET.top;
  return { x, y };
}

function projectOnMap(code: string, lat: number, lon: number) {
  const pct = (TERRITORY_PCT as Record<string, { x: number; y: number }>)[code];
  if (pct?.x != null && pct?.y != null) {
    return { x: (pct.x / 100) * MAP_WIDTH, y: (pct.y / 100) * MAP_HEIGHT };
  }
  return projectLatLon(lat, lon);
}

function buildArc(a: { x: number; y: number }, b: { x: number; y: number }) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const bend = clamp(len * 0.14, 16, 140);
  const cx = mx + nx * bend;
  const cy = my + ny * bend;
  return `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
}

function readUserHsPrefs() {
  try {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem("mpl_user_prefs");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const hs = Array.isArray(parsed?.hsCodes) ? parsed.hsCodes : [];
    return hs.map((v: string) => normalizeHS(v)).filter(Boolean);
  } catch {
    return [];
  }
}

/** RSS helpers (client-side parsing). Uses AllOrigins fallback if CORS blocks direct fetch. */
function safeText(el: Element | null | undefined) {
  return (el?.textContent || "").trim();
}

function parseDateToTs(value: string) {
  const s = (value || "").trim();
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

function parseRssXml(xmlText: string, sourceName: string): RssItem[] {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "text/xml");
    const parseError = doc.querySelector("parsererror");
    if (parseError) return [];

    // Atom
    const entries = Array.from(doc.querySelectorAll("entry"));
    if (entries.length) {
      return entries
        .map((entry) => {
          const title = safeText(entry.querySelector("title"));
          const linkEl = entry.querySelector("link");
          const link = (linkEl?.getAttribute("href") || safeText(linkEl))?.trim();
          const published = safeText(entry.querySelector("published")) || safeText(entry.querySelector("updated"));
          const publishedAt = parseDateToTs(published);
          if (!title || !link) return null;
          return {
            id: `${sourceName}::${link}::${publishedAt ?? 0}`,
            title,
            link,
            sourceName,
            publishedAt,
          } as RssItem;
        })
        .filter(Boolean) as RssItem[];
    }

    // RSS
    const items = Array.from(doc.querySelectorAll("item"));
    return items
      .map((item) => {
        const title = safeText(item.querySelector("title"));
        const link = safeText(item.querySelector("link"));
        const pubDate = safeText(item.querySelector("pubDate")) || safeText(item.querySelector("date"));
        const publishedAt = parseDateToTs(pubDate);
        if (!title || !link) return null;
        return {
          id: `${sourceName}::${link}::${publishedAt ?? 0}`,
          title,
          link,
          sourceName,
          publishedAt,
        } as RssItem;
      })
      .filter(Boolean) as RssItem[];
  } catch {
    return [];
  }
}

async function fetchRssRaw(url: string) {
  const proxied = `/api/rss?url=${encodeURIComponent(url)}`;
  const res = await fetch(proxied, {
    method: "GET",
    headers: {
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Fetch RSS impossible (proxy).");
  return await res.text();
}

function getWatchSourcesForCountry(code: string): RssSource[] {
  const upper = (code || "").toUpperCase();
  const specific = COUNTRY_RSS_SOURCES[upper] ?? [];
  // Toujours garder UE/OMC en fond de panier pour que “tous les pays” aient une veille minimale
  return [...specific, ...GLOBAL_RSS_SOURCES];
}

function formatDate(ts: number | null) {
  if (!ts) return "—";
  try {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(ts));
  } catch {
    return "—";
  }
}

export default function ControlTower() {
  const { profile } = useCompanyProfile();
  const companyName = profile?.company_name?.trim() || "Votre entreprise";

  const [csvState, setCsvState] = React.useState<CsvState | null>(null);
  const [csvError, setCsvError] = React.useState<string | null>(null);
  const [csvName, setCsvName] = React.useState<string | null>(null);

  const [defaults, setDefaults] = React.useState({
    currency: "EUR",
    unitCost: 0,
    transport: 0,
    packaging: 0,
    dossier: 0,
    other: 0,
  });

  const [destinationFilter, setDestinationFilter] = React.useState<string>("ALL");
  const [currencyFilter, setCurrencyFilter] = React.useState<string>("ALL");
  const [hsQuery, setHsQuery] = React.useState("");

  const [preferredHs, setPreferredHs] = React.useState<string[]>([]);
  const [focusPreferred, setFocusPreferred] = React.useState(false);

  // RSS watch panel
  const [selectedWatchCountry, setSelectedWatchCountry] = React.useState<string>("FR");
  const [rssLoading, setRssLoading] = React.useState(false);
  const [rssError, setRssError] = React.useState<string | null>(null);
  const [rssItems, setRssItems] = React.useState<RssItem[]>([]);
  const [rssSources, setRssSources] = React.useState<RssSource[]>([]);
  const rssCacheRef = React.useRef<Map<string, { items: RssItem[]; at: number }>>(new Map());

  const [hovered, setHovered] = React.useState<{
    code: string;
    name: string;
    revenue: number;
    x: number;
    y: number;
  } | null>(null);
  const [tooltipPos, setTooltipPos] = React.useState<{ x: number; y: number } | null>(null);

  React.useEffect(() => {
    const hs = readUserHsPrefs();
    setPreferredHs(hs);
    if (hs.length) setFocusPreferred(true);
  }, []);

  const handleCsvUpload = async (file: File) => {
    setCsvError(null);
    try {
      const text = await file.text();
      const parsed = parseCsvText(text);
      if (!parsed.headers.length) {
        setCsvError("CSV vide ou illisible.");
        setCsvState(null);
        setCsvName(null);
        return;
      }
      setCsvState(parsed);
      setCsvName(file.name);
    } catch (err: any) {
      setCsvError(err?.message || "Impossible de lire le CSV.");
      setCsvState(null);
      setCsvName(null);
    }
  };

  const computed = React.useMemo(() => {
    if (!csvState) {
      return {
        rows: [] as SalesRow[],
        errors: [] as string[],
        warnings: [] as string[],
        currencies: [] as string[],
      };
    }

    const headerMap = new Map<string, number>();
    csvState.headers.forEach((h, idx) => {
      headerMap.set(normalizeHeader(h), idx);
    });

    const pickIndex = (aliases: string[]) => {
      for (const alias of aliases) {
        const key = normalizeHeader(alias);
        const idx = headerMap.get(key);
        if (idx !== undefined) return idx;
      }
      return null;
    };

    const idx = {
      hs: pickIndex(COLUMN_ALIASES.hs),
      destination: pickIndex(COLUMN_ALIASES.destination),
      quantity: pickIndex(COLUMN_ALIASES.quantity),
      unitPrice: pickIndex(COLUMN_ALIASES.unitPrice),
      totalPrice: pickIndex(COLUMN_ALIASES.totalPrice),
      currency: pickIndex(COLUMN_ALIASES.currency),
      productLabel: pickIndex(COLUMN_ALIASES.productLabel),
      unitCost: pickIndex(COLUMN_ALIASES.unitCost),
      transportCost: pickIndex(COLUMN_ALIASES.transportCost),
      packagingCost: pickIndex(COLUMN_ALIASES.packagingCost),
      dossierFee: pickIndex(COLUMN_ALIASES.dossierFee),
      otherCosts: pickIndex(COLUMN_ALIASES.otherCosts),
      invoiceNumber: pickIndex(COLUMN_ALIASES.invoiceNumber),
      invoiceDate: pickIndex(COLUMN_ALIASES.invoiceDate),
    };

    const missing: string[] = [];
    if (idx.hs === null) missing.push("hs_code");
    if (idx.destination === null) missing.push("destination_country");
    if (idx.quantity === null) missing.push("quantity");
    if (idx.unitPrice === null && idx.totalPrice === null) missing.push("unit_price (ou total_price)");

    if (missing.length) {
      return {
        rows: [] as SalesRow[],
        errors: [`Colonnes obligatoires manquantes : ${missing.join(", ")}.`],
        warnings: [] as string[],
        currencies: [] as string[],
      };
    }

    const rows: SalesRow[] = [];
    const warnings: string[] = [];
    const currencySet = new Set<string>();

    const getValue = (cells: string[], index: number | null) => {
      if (index === null) return "";
      return cells[index] ?? "";
    };

    csvState.rows.forEach((cells, i) => {
      if (!cells.some((c) => String(c || "").trim() !== "")) return;

      const lineNumber = i + 2;
      const hs = normalizeHS(getValue(cells, idx.hs));
      if (!hs) {
        warnings.push(`Ligne ${lineNumber} : HS code manquant.`);
        return;
      }

      const destRaw = getValue(cells, idx.destination);
      const destination = normalizeCountryCode(destRaw);
      if (!destination) {
        warnings.push(`Ligne ${lineNumber} : destination manquante.`);
        return;
      }

      const quantity = parseNumber(getValue(cells, idx.quantity));
      if (!quantity || quantity <= 0) {
        warnings.push(`Ligne ${lineNumber} : quantité invalide.`);
        return;
      }

      const unitPrice = parseNumber(getValue(cells, idx.unitPrice));
      const totalPrice = parseNumber(getValue(cells, idx.totalPrice));
      const totalSales = totalPrice ?? (unitPrice !== null ? unitPrice * quantity : null);

      if (totalSales === null || !Number.isFinite(totalSales)) {
        warnings.push(`Ligne ${lineNumber} : prix de vente manquant (unit_price ou total_price).`);
        return;
      }

      const currencyRaw = getValue(cells, idx.currency);
      const currency = (currencyRaw || defaults.currency || "EUR").toUpperCase();
      currencySet.add(currency);

      const unitCostRaw = parseNumber(getValue(cells, idx.unitCost));
      const transportRaw = parseNumber(getValue(cells, idx.transportCost));
      const packagingRaw = parseNumber(getValue(cells, idx.packagingCost));
      const dossierRaw = parseNumber(getValue(cells, idx.dossierFee));
      const otherRaw = parseNumber(getValue(cells, idx.otherCosts));

      const unitCost = unitCostRaw ?? defaults.unitCost;
      const transportCost = transportRaw ?? defaults.transport;
      const packagingCost = packagingRaw ?? defaults.packaging;
      const dossierFee = dossierRaw ?? defaults.dossier;
      const otherCosts = otherRaw ?? defaults.other;

      const totalCosts = unitCost * quantity + transportCost + packagingCost + dossierFee + otherCosts;
      const margin = totalSales - totalCosts;
      const marginPct = totalSales > 0 ? margin / totalSales : null;

      rows.push({
        line: lineNumber,
        hs,
        destination,
        destinationLabel: territoryLabel(destination),
        productLabel: getValue(cells, idx.productLabel) || null,
        quantity,
        unitPrice,
        totalSales,
        currency,
        unitCost,
        transportCost,
        packagingCost,
        dossierFee,
        otherCosts,
        totalCosts,
        margin,
        marginPct,
        invoiceNumber: getValue(cells, idx.invoiceNumber) || null,
        invoiceDate: getValue(cells, idx.invoiceDate) || null,
      });
    });

    return {
      rows,
      errors: [] as string[],
      warnings,
      currencies: Array.from(currencySet),
    };
  }, [csvState, defaults]);

  const rowsAll = computed.rows;
  const currencyList = computed.currencies.length ? computed.currencies : [defaults.currency];

  React.useEffect(() => {
    // Si plusieurs devises: on force un filtre pour éviter de mélanger sans conversion.
    if (currencyList.length > 1) {
      if (currencyFilter === "ALL") setCurrencyFilter(currencyList[0] || "EUR");
    } else {
      setCurrencyFilter("ALL");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currencyList.join("|")]);

  const filteredRows = React.useMemo(() => {
    let base = rowsAll;

    if (destinationFilter !== "ALL") {
      base = base.filter((r) => r.destination === destinationFilter);
    }

    if (currencyFilter !== "ALL") {
      base = base.filter((r) => r.currency === currencyFilter);
    }

    if (focusPreferred && preferredHs.length) {
      const set = new Set(preferredHs);
      base = base.filter((r) => set.has(r.hs));
    }

    const q = hsQuery.trim().toLowerCase();
    if (q) {
      base = base.filter((r) => `${r.hs} ${(r.productLabel || "")}`.toLowerCase().includes(q));
    }

    return base;
  }, [rowsAll, destinationFilter, currencyFilter, focusPreferred, preferredHs, hsQuery]);

  const totals = React.useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => {
        acc.revenue += row.totalSales;
        acc.costs += row.totalCosts;
        acc.margin += row.margin;
        acc.quantity += row.quantity;
        acc.lines += 1;
        return acc;
      },
      { revenue: 0, costs: 0, margin: 0, quantity: 0, lines: 0 }
    );
  }, [filteredRows]);

  const destinationAgg = React.useMemo(() => {
    const map = new Map<string, Agg>();
    filteredRows.forEach((row) => {
      const existing = map.get(row.destination);
      if (existing) {
        existing.revenue += row.totalSales;
        existing.costs += row.totalCosts;
        existing.margin += row.margin;
        existing.quantity += row.quantity;
        existing.lines += 1;
      } else {
        map.set(row.destination, {
          code: row.destination,
          name: row.destinationLabel,
          revenue: row.totalSales,
          costs: row.totalCosts,
          margin: row.margin,
          quantity: row.quantity,
          lines: 1,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filteredRows]);

  const destinationAggAll = React.useMemo(() => {
    const map = new Map<string, Agg>();
    rowsAll.forEach((row) => {
      // ✅ on agrège seulement sur la devise courante si filtrée
      if (currencyFilter !== "ALL" && row.currency !== currencyFilter) return;

      const existing = map.get(row.destination);
      if (existing) {
        existing.revenue += row.totalSales;
        existing.costs += row.totalCosts;
        existing.margin += row.margin;
        existing.quantity += row.quantity;
        existing.lines += 1;
      } else {
        map.set(row.destination, {
          code: row.destination,
          name: row.destinationLabel,
          revenue: row.totalSales,
          costs: row.totalCosts,
          margin: row.margin,
          quantity: row.quantity,
          lines: 1,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [rowsAll, currencyFilter]);

  const productAgg = React.useMemo(() => {
    const map = new Map<string, Agg & { label: string | null }>();
    filteredRows.forEach((row) => {
      const existing = map.get(row.hs);
      if (existing) {
        existing.revenue += row.totalSales;
        existing.costs += row.totalCosts;
        existing.margin += row.margin;
        existing.quantity += row.quantity;
        existing.lines += 1;
      } else {
        map.set(row.hs, {
          code: row.hs,
          name: row.hs,
          label: row.productLabel,
          revenue: row.totalSales,
          costs: row.totalCosts,
          margin: row.margin,
          quantity: row.quantity,
          lines: 1,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filteredRows]);

  const byDestinationProduct = React.useMemo(() => {
    const map = new Map<string, Agg & { hs: string; productLabel: string | null }>();
    filteredRows.forEach((row) => {
      const key = `${row.destination}::${row.hs}`;
      const existing = map.get(key);
      if (existing) {
        existing.revenue += row.totalSales;
        existing.costs += row.totalCosts;
        existing.margin += row.margin;
        existing.quantity += row.quantity;
        existing.lines += 1;
      } else {
        map.set(key, {
          code: row.destination,
          name: row.destinationLabel,
          hs: row.hs,
          productLabel: row.productLabel,
          revenue: row.totalSales,
          costs: row.totalCosts,
          margin: row.margin,
          quantity: row.quantity,
          lines: 1,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.margin - a.margin);
  }, [filteredRows]);

  const mapNodes = React.useMemo(() => {
    const nodes: Array<{ code: string; name: string; x: number; y: number; revenue: number }> = [];
    let missing = 0;

    destinationAggAll.forEach((entry) => {
      const meta = COUNTRY_COORDS[entry.code];
      const pct = (TERRITORY_PCT as Record<string, { x: number; y: number }>)[entry.code];
      if (!meta && !pct) {
        missing += 1;
        return;
      }
      const point = pct
        ? { x: (pct.x / 100) * MAP_WIDTH, y: (pct.y / 100) * MAP_HEIGHT }
        : projectOnMap(entry.code, meta.lat, meta.lon);
      nodes.push({ code: entry.code, name: entry.name, x: point.x, y: point.y, revenue: entry.revenue });
    });

    // ✅ Hub France: position fiable via projection lat/lon (évite un mauvais TERRITORY_PCT/HUB_FR)
    const fr = COUNTRY_COORDS.FR;
    const hubPoint = projectLatLon(fr.lat, fr.lon);
    if (!nodes.some((n) => n.code === "FR")) {
      nodes.push({ code: "FR", name: territoryLabel("FR"), x: hubPoint.x, y: hubPoint.y, revenue: 0 });
    } else {
      // si FR existe déjà mais est mal placé via pct, on force la position hub (plus fiable)
      nodes.forEach((n) => {
        if (n.code === "FR") {
          n.x = hubPoint.x;
          n.y = hubPoint.y;
        }
      });
    }

    return { nodes, missing, hubPoint };
  }, [destinationAggAll]);

  const hubNode = React.useMemo(() => {
    const frName = territoryLabel("FR");
    return { code: "FR", name: frName, x: mapNodes.hubPoint.x, y: mapNodes.hubPoint.y, revenue: 0 };
  }, [mapNodes.hubPoint.x, mapNodes.hubPoint.y]);

  const maxRevenue = Math.max(0, ...mapNodes.nodes.map((n) => n.revenue || 0));

  const setDefaultsField = (key: keyof typeof defaults) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    setDefaults((prev) => ({
      ...prev,
      [key]: key === "currency" ? raw.toUpperCase() : parseNumber(raw) ?? 0,
    }));
  };

  async function loadRssForCountry(code: string, force = false) {
    const upper = (code || "FR").toUpperCase();
    const cacheKey = `${upper}`;
    const cached = rssCacheRef.current.get(cacheKey);
    const now = Date.now();
    if (!force && cached && now - cached.at < 10 * 60 * 1000) {
      setRssItems(cached.items);
      setRssError(null);
      setRssSources(getWatchSourcesForCountry(upper));
      return;
    }

    setRssLoading(true);
    setRssError(null);
    const sources = getWatchSourcesForCountry(upper);
    setRssSources(sources);

    try {
      const settled = await Promise.allSettled(
        sources.map(async (src) => {
          const raw = await fetchRssRaw(src.url);
          return parseRssXml(raw, src.name);
        })
      );

      const items: RssItem[] = [];
      let okCount = 0;

      settled.forEach((r) => {
        if (r.status === "fulfilled") {
          okCount += 1;
          items.push(...r.value);
        }
      });

      const uniq = new Map<string, RssItem>();
      items.forEach((it) => uniq.set(it.id, it));
      const merged = Array.from(uniq.values()).sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));

      if (!merged.length) {
        setRssError(okCount ? "Aucun item RSS trouvé (sources vides ou format non reconnu)." : "Impossible de récupérer les flux RSS (blocage réseau/CORS).");
      } else {
        setRssError(null);
      }

      setRssItems(merged);
      rssCacheRef.current.set(cacheKey, { items: merged, at: now });
    } catch (e: any) {
      setRssItems([]);
      setRssError(e?.message || "Erreur lors du chargement RSS.");
    } finally {
      setRssLoading(false);
    }
  }

  React.useEffect(() => {
    void loadRssForCountry(selectedWatchCountry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWatchCountry]);

  const displayCurrency = currencyFilter !== "ALL" ? currencyFilter : (currencyList[0] || defaults.currency || "EUR");

  const selectedCountryLabel = territoryLabel(selectedWatchCountry);

  return (
    <AppLayout contentClassName="md:p-6">
      <div className="space-y-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-blue-600">Tour de contrôle</p>
            <h1 className="text-3xl font-bold text-slate-900">Pilotage ventes & marges</h1>
            <p className="text-sm text-slate-600">Tableau de bord connecté pour {companyName} : suivi par HS code et destination.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              className="gap-2"
              onClick={() => downloadTextFile("template-ventes-pme.csv", CSV_TEMPLATE)}
            >
              <Download className="h-4 w-4" />
              Template CSV (PME)
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                setCsvState(null);
                setCsvName(null);
                setCsvError(null);
                setDestinationFilter("ALL");
                setHsQuery("");
                setCurrencyFilter("ALL");
              }}
            >
              <RotateCcw className="h-4 w-4" />
              Vider les données
            </Button>
          </div>
        </header>

        {/* ✅ Carte + sidebar : plus grand */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4 text-blue-600" />
                Flux par destination
              </CardTitle>
              <CardDescription>Survole un point pour voir les volumes. Clic = filtre + veille RSS du pays.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative h-[520px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 lg:h-[680px]">
                <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} className="absolute inset-0 h-full w-full">
                  <image
                    href={worldMap}
                    x="0"
                    y="0"
                    width={MAP_WIDTH}
                    height={MAP_HEIGHT}
                    opacity="0.45"
                    style={{ filter: "invert(1) saturate(1.2) contrast(1.05)" }}
                  />

                  {/* Arcs depuis hub FR */}
                  {mapNodes.nodes
                    .filter((n) => n.code !== "FR" && n.revenue > 0)
                    .map((node) => {
                      const path = buildArc(hubNode, node);
                      const strokeWidth = clamp(1.5 + (node.revenue / Math.max(1, maxRevenue)) * 4, 1.5, 6);
                      return (
                        <path
                          key={`arc-${node.code}`}
                          d={path}
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth={strokeWidth}
                          strokeOpacity={0.35}
                          vectorEffect="non-scaling-stroke"
                        />
                      );
                    })}

                  {/* Nodes */}
                  {mapNodes.nodes.map((node) => {
                    const radius = node.code === "FR"
                      ? 14
                      : clamp(6 + (node.revenue / Math.max(1, maxRevenue)) * 10, 6, 14);

                    const isSelected = destinationFilter === node.code;
                    const isWatch = selectedWatchCountry === node.code;

                    return (
                      <g key={node.code}>
                        <circle cx={node.x} cy={node.y} r={radius + 8} fill="#0f172a" opacity={0.35} />
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r={radius}
                          fill={node.code === "FR" ? "#22d3ee" : isSelected ? "#38bdf8" : "#22d3ee"}
                          opacity={node.code === "FR" ? 0.95 : node.revenue > 0 ? 0.9 : 0.35}
                          className="cursor-pointer"
                          stroke={isWatch ? "#ffffff" : "none"}
                          strokeWidth={isWatch ? 2 : 0}
                          onMouseEnter={(evt) => {
                            setHovered({
                              code: node.code,
                              name: node.code === "FR" ? "Hub France" : node.name,
                              revenue: node.revenue,
                              x: node.x,
                              y: node.y,
                            });
                            setTooltipPos({ x: evt.clientX, y: evt.clientY });
                          }}
                          onMouseMove={(evt) => setTooltipPos({ x: evt.clientX, y: evt.clientY })}
                          onMouseLeave={() => {
                            setHovered(null);
                            setTooltipPos(null);
                          }}
                          onClick={() => {
                            setDestinationFilter(node.code);
                            setSelectedWatchCountry(node.code);
                          }}
                          onDoubleClick={() => setDestinationFilter("ALL")}
                        />

                        {node.code === "FR" ? (
                          <text x={node.x + 14} y={node.y + 5} className="text-xs font-semibold fill-cyan-100">
                            Hub France
                          </text>
                        ) : null}
                      </g>
                    );
                  })}
                </svg>

                {hovered && tooltipPos ? (
                  <div
                    className="pointer-events-none fixed z-50 rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs text-slate-100 shadow-xl"
                    style={{ left: tooltipPos.x + 12, top: tooltipPos.y + 12 }}
                  >
                    <div className="font-semibold">{hovered.name}</div>
                    <div className="text-slate-400">{hovered.code}</div>
                    <div className="mt-1 text-slate-200">CA: {formatMoney(hovered.revenue, displayCurrency)}</div>
                  </div>
                ) : null}

                {mapNodes.missing > 0 ? (
                  <div className="absolute bottom-3 right-3 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-xs text-slate-200">
                    {mapNodes.missing} destinations hors carte
                  </div>
                ) : null}

                {!rowsAll.length ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 shadow-lg">
                      Importe un CSV pour afficher les flux.
                    </div>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3 lg:col-span-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Synthèse</CardTitle>
                <CardDescription>Ventes et marges (filtres actifs)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Chiffre d&apos;affaires</span>
                  <span className="text-lg font-semibold text-slate-900">{formatMoney(totals.revenue, displayCurrency)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Coûts totaux</span>
                  <span className="text-lg font-semibold text-slate-900">{formatMoney(totals.costs, displayCurrency)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Marge</span>
                  <span className="text-lg font-semibold text-emerald-600">{formatMoney(totals.margin, displayCurrency)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Marge %</span>
                  <span className="text-lg font-semibold text-slate-900">
                    {formatPercent(totals.revenue ? totals.margin / totals.revenue : null)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Badge variant="outline">Lignes: {totals.lines}</Badge>
                  <Badge variant="outline">HS: {productAgg.length}</Badge>
                  <Badge variant="outline">Destinations: {destinationAgg.length}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Filtres rapides</CardTitle>
                <CardDescription>Affiche un sous-ensemble cohérent (devise incluse).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select
                  value={destinationFilter}
                  onValueChange={(v) => {
                    setDestinationFilter(v);
                    if (v !== "ALL") setSelectedWatchCountry(v);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Destination" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Toutes les destinations</SelectItem>
                    {destinationAggAll.map((d) => (
                      <SelectItem key={d.code} value={d.code}>
                        {d.name} ({d.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {currencyList.length > 1 ? (
                  <Select value={currencyFilter} onValueChange={(v) => setCurrencyFilter(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Devise" />
                    </SelectTrigger>
                    <SelectContent>
                      {currencyList.map((c) => (
                        <SelectItem key={c} value={c}>
                          Devise: {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}

                <Input value={hsQuery} onChange={(e) => setHsQuery(e.target.value)} placeholder="Filtrer par HS ou libellé" />

                {preferredHs.length ? (
                  <Button
                    type="button"
                    variant={focusPreferred ? "default" : "outline"}
                    onClick={() => setFocusPreferred((v) => !v)}
                    className="w-full"
                  >
                    {focusPreferred ? "Mes HS uniquement" : "Tous les HS"}
                  </Button>
                ) : (
                  <div className="text-xs text-muted-foreground">Aucun HS préféré détecté (profil non configuré).</div>
                )}
              </CardContent>
            </Card>

            {/* ✅ Veille RSS (au clic sur pays) */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Rss className="h-4 w-4 text-blue-600" />
                    Veille RSS – {selectedCountryLabel} ({selectedWatchCountry})
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => void loadRssForCountry(selectedWatchCountry, true)}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Rafraîchir
                  </Button>
                </CardTitle>
                <CardDescription>
                  Sources pays + UE/OMC (fallback). Si certains flux bloquent (CORS), le proxy est utilisé.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {rssSources.slice(0, 6).map((s) => (
                    <Badge key={s.url} variant="outline" className="max-w-full truncate">
                      {s.name}
                    </Badge>
                  ))}
                  {rssSources.length > 6 ? <Badge variant="outline">+{rssSources.length - 6}</Badge> : null}
                </div>

                {rssLoading ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    Chargement des flux RSS…
                  </div>
                ) : null}

                {rssError ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    {rssError}
                    <div className="mt-2 text-xs text-amber-800">
                      Astuce : si un pays n’a pas encore de source dédiée, ajoute un flux national dans ta config plus tard.
                    </div>
                  </div>
                ) : null}

                <div className="max-h-[340px] overflow-auto rounded-xl border border-slate-200">
                  <ul className="divide-y">
                    {rssItems.slice(0, 20).map((it) => (
                      <li key={it.id} className="p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-slate-900 line-clamp-2">{it.title}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              <span>{it.sourceName}</span>
                              <span>•</span>
                              <span>{formatDate(it.publishedAt)}</span>
                            </div>
                          </div>
                          <a
                            href={it.link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900"
                          >
                            Ouvrir <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      </li>
                    ))}
                    {!rssItems.length && !rssLoading ? (
                      <li className="p-4 text-sm text-slate-500">Aucun item à afficher pour le moment.</li>
                    ) : null}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                Import CSV
              </CardTitle>
              <CardDescription>
                HS code obligatoire. Prix (unit_price ou total_price) + quantité requis. Les frais peuvent être fournis
                ou complétés par les valeurs manuelles.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleCsvUpload(file);
                }}
                className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-md file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-800"
              />

              {csvName ? (
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <span className="truncate">{csvName}</span>
                  <Badge variant="outline">{rowsAll.length} lignes valides</Badge>
                </div>
              ) : null}

              {csvError ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{csvError}</div>
              ) : null}

              {computed.errors.length ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {computed.errors.join(" ")}
                </div>
              ) : null}

              {computed.warnings.length ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {computed.warnings.slice(0, 5).map((w) => (
                    <div key={w}>{w}</div>
                  ))}
                  {computed.warnings.length > 5 ? <div>+{computed.warnings.length - 5} autres alertes</div> : null}
                </div>
              ) : null}

              {currencyList.length > 1 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Plusieurs devises détectées ({currencyList.join(", ")}). Pour éviter de mélanger sans conversion,
                  un filtre devise est appliqué.
                </div>
              ) : null}

              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Séparateurs acceptés : <b>;</b> ou <b>,</b>. Décimales : virgule ou point.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-blue-600" />
                Valeurs manuelles (fallback)
              </CardTitle>
              <CardDescription>
                Utilisées si le CSV ne fournit pas les frais (transport, packaging, dossier, autres).
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Devise par défaut</div>
                <Input value={defaults.currency} onChange={setDefaultsField("currency")} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Coût unitaire produit</div>
                <Input type="number" value={defaults.unitCost} onChange={setDefaultsField("unitCost")} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Frais transport</div>
                <Input type="number" value={defaults.transport} onChange={setDefaultsField("transport")} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Frais packaging</div>
                <Input type="number" value={defaults.packaging} onChange={setDefaultsField("packaging")} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Frais dossier</div>
                <Input type="number" value={defaults.dossier} onChange={setDefaultsField("dossier")} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Autres frais</div>
                <Input type="number" value={defaults.other} onChange={setDefaultsField("other")} />
              </div>
              <div className="sm:col-span-2 text-xs text-muted-foreground">
                Les valeurs sont appliquées par ligne si la colonne correspondante est vide.
              </div>
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-blue-600" />
              Template CSV (PME)
            </CardTitle>
            <CardDescription>
              Modèle standard : facture, destination, HS, quantités, prix, devise, incoterm (optionnel), coûts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-900/90 p-3 text-xs text-slate-100">
{CSV_TEMPLATE}
            </pre>
          </CardContent>
        </Card>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Ventes par destination</CardTitle>
              <CardDescription>CA, coûts et marges par pays (devise filtrée si nécessaire).</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Destination</th>
                      <th className="px-3 py-2 text-right">CA</th>
                      <th className="px-3 py-2 text-right">Coûts</th>
                      <th className="px-3 py-2 text-right">Marge</th>
                      <th className="px-3 py-2 text-right">Marge %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {destinationAgg.slice(0, 200).map((row) => (
                      <tr key={row.code} className="border-t">
                        <td className="px-3 py-2">
                          <div className="font-medium">{row.name}</div>
                          <div className="text-xs text-slate-500">{row.code}</div>
                        </td>
                        <td className="px-3 py-2 text-right">{formatMoney(row.revenue, displayCurrency)}</td>
                        <td className="px-3 py-2 text-right">{formatMoney(row.costs, displayCurrency)}</td>
                        <td className="px-3 py-2 text-right text-emerald-700">{formatMoney(row.margin, displayCurrency)}</td>
                        <td className="px-3 py-2 text-right">{formatPercent(row.revenue ? row.margin / row.revenue : null)}</td>
                      </tr>
                    ))}
                    {!destinationAgg.length ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-500">
                          Aucune donnée. Importe un CSV ou ajuste les filtres.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ventes par produit (HS)</CardTitle>
              <CardDescription>Suivi marge par HS code.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left">HS</th>
                      <th className="px-3 py-2 text-right">CA</th>
                      <th className="px-3 py-2 text-right">Coûts</th>
                      <th className="px-3 py-2 text-right">Marge</th>
                      <th className="px-3 py-2 text-right">Marge %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productAgg.slice(0, 200).map((row) => (
                      <tr key={row.code} className="border-t">
                        <td className="px-3 py-2">
                          <div className="font-medium">HS {row.code}</div>
                          {row.label ? <div className="text-xs text-slate-500">{row.label}</div> : null}
                        </td>
                        <td className="px-3 py-2 text-right">{formatMoney(row.revenue, displayCurrency)}</td>
                        <td className="px-3 py-2 text-right">{formatMoney(row.costs, displayCurrency)}</td>
                        <td className="px-3 py-2 text-right text-emerald-700">{formatMoney(row.margin, displayCurrency)}</td>
                        <td className="px-3 py-2 text-right">{formatPercent(row.revenue ? row.margin / row.revenue : null)}</td>
                      </tr>
                    ))}
                    {!productAgg.length ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-500">
                          Aucune donnée. Importe un CSV ou ajuste les filtres.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Détail par destination + produit</CardTitle>
            <CardDescription>Pour prioriser les actions marge produit/destination.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Destination</th>
                    <th className="px-3 py-2 text-left">HS</th>
                    <th className="px-3 py-2 text-right">CA</th>
                    <th className="px-3 py-2 text-right">Coûts</th>
                    <th className="px-3 py-2 text-right">Marge</th>
                    <th className="px-3 py-2 text-right">Marge %</th>
                  </tr>
                </thead>
                <tbody>
                  {byDestinationProduct.slice(0, 400).map((row) => (
                    <tr key={`${row.code}-${row.hs}`} className="border-t">
                      <td className="px-3 py-2">
                        <div className="font-medium">{row.name}</div>
                        <div className="text-xs text-slate-500">{row.code}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium">HS {row.hs}</div>
                        {row.productLabel ? <div className="text-xs text-slate-500">{row.productLabel}</div> : null}
                      </td>
                      <td className="px-3 py-2 text-right">{formatMoney(row.revenue, displayCurrency)}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(row.costs, displayCurrency)}</td>
                      <td className="px-3 py-2 text-right text-emerald-700">{formatMoney(row.margin, displayCurrency)}</td>
                      <td className="px-3 py-2 text-right">{formatPercent(row.revenue ? row.margin / row.revenue : null)}</td>
                    </tr>
                  ))}
                  {!byDestinationProduct.length ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-500">
                        Aucune donnée. Importe un CSV ou ajuste les filtres.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {byDestinationProduct.length > 400 ? (
              <div className="mt-2 text-xs text-muted-foreground">
                Affichage limité à 400 lignes. Utilise les filtres pour réduire la liste.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
