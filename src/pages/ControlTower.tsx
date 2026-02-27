import * as React from "react";
import {
  ArrowUpRight,
  Database,
  FileSpreadsheet,
  Globe2,
  LineChart,
  Plus,
  RefreshCw,
  Route,
  TrendingUp,
  UploadCloud,
} from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { PanoramicControlTowerMap } from "@/components/controlTower/PanoramicControlTowerMap";
import { RssFooter } from "@/components/RssFooter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  COUNTRIES,
  CURRENCIES,
  DISTRIBUTION_CHANNELS,
  INCOTERMS,
  PRODUCTS,
  getCountryLabel,
} from "@/lib/constants";
import { COMMODITIES_MARKET_LINKS, FX_RSS_ECB, TRANSPORT_MARKET_LINKS } from "@/lib/rss/feeds";
import { useI18n } from "@/contexts/LanguageContext";
import { toFriendlyErrorMessage } from "@/lib/textSanitizer";

type TabularData = {
  headers: string[];
  rows: string[][];
};

type ColumnMapping = {
  country: string;
  product: string;
  qty: string;
  amount: string;
  currency: string;
  incoterm: string;
  channel: string;
  transportCost: string;
};

type ControlTowerRow = {
  id: string;
  country: string;
  productCode: string;
  qty: number;
  amount: number;
  currency: string;
  incoterm: string;
  channel: string;
  transportCost: number;
};

type ManualRowInput = {
  country: string;
  productCode: string;
  qty: string;
  amount: string;
  currency: string;
  incoterm: string;
  channel: string;
  transportCost: string;
};

type DatasetType = "sales" | "margins" | "products" | "clients" | "routes";

type DatasetSummary = {
  type: DatasetType;
  fileName: string;
  rows: number;
  columns: number;
  importedAt: string;
  quality: number;
  foundFields: string[];
  missingFields: string[];
};

type MarketEvent = {
  id: string;
  title: string;
  link: string;
  source?: string;
  publishedAt?: string;
  category?: string;
  importance: number;
};

type MarketWatchLink = {
  id: string;
  title: string;
  link: string;
  reason: string;
  group: "transport" | "commodities" | "fx";
  priority: "high" | "medium";
};

type RouteAlert = {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  action: string;
};

const uid = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;

const EMPTY_MAPPING: ColumnMapping = {
  country: "",
  product: "",
  qty: "",
  amount: "",
  currency: "",
  incoterm: "",
  channel: "",
  transportCost: "",
};

const EMPTY_MANUAL_ROW: ManualRowInput = {
  country: "",
  productCode: "",
  qty: "",
  amount: "",
  currency: "EUR",
  incoterm: "EXW",
  channel: "direct",
  transportCost: "",
};

const DATASET_ORDER: DatasetType[] = ["sales", "margins", "products", "clients", "routes"];

const DATASET_CONFIG: Record<
  DatasetType,
  {
    labelFr: string;
    labelEn: string;
    expectedFields: string[];
  }
> = {
  sales: {
    labelFr: "Ventes / operations",
    labelEn: "Sales / operations",
    expectedFields: ["country", "product", "qty", "amount", "currency", "incoterm"],
  },
  margins: {
    labelFr: "Marge / couts",
    labelEn: "Margins / costs",
    expectedFields: ["product", "country", "amount", "cost", "margin", "currency"],
  },
  products: {
    labelFr: "Referentiel produits",
    labelEn: "Product master data",
    expectedFields: ["product", "hs", "origin", "description"],
  },
  clients: {
    labelFr: "Referentiel clients",
    labelEn: "Client master data",
    expectedFields: ["customer", "country", "vat", "segment"],
  },
  routes: {
    labelFr: "Transport / routes",
    labelEn: "Transport / routes",
    expectedFields: ["origin", "destination", "mode", "incoterm", "freight", "transit"],
  },
};

const FIELD_ALIASES: Record<string, string[]> = {
  country: ["country", "pays", "destination", "dest", "shipto", "ship_to", "buyer_country", "country_iso2"],
  product: ["product", "produit", "sku", "article", "item", "product_code", "code_produit"],
  qty: ["qty", "quantity", "quantite", "qte", "volume"],
  amount: ["amount", "montant", "ca", "value", "total", "revenue", "chiffre_affaires"],
  currency: ["currency", "devise", "cur", "iso4217"],
  incoterm: ["incoterm", "incoterms", "inco"],
  cost: ["cost", "cout", "costs", "purchase_cost", "cout_total", "achat"],
  margin: ["margin", "marge", "gross_margin", "marge_brute"],
  hs: ["hs", "hs6", "hs_code", "code_hs", "tariff_code", "nomenclature"],
  origin: ["origin", "origine", "country_origin", "manufacturing_country"],
  description: ["description", "designation", "libelle", "label"],
  customer: ["customer", "client", "buyer", "acheteur", "account", "customer_name"],
  vat: ["vat", "tva", "vat_number", "tva_intracom", "tax_id"],
  segment: ["segment", "client_segment", "channel_segment"],
  destination: ["destination", "arrival", "final_country", "country_destination", "destination_country"],
  mode: ["mode", "transport_mode", "transport", "ship_mode", "mode_transport"],
  freight: ["freight", "transport_cost", "cout_transport", "freight_cost", "shipping_cost"],
  transit: ["transit", "lead_time", "transit_days", "temps_transport", "eta"],
};

const TOPIC_LABELS_FR: Record<string, string> = {
  sanctions: "Sanctions",
  douane: "Douane",
  taxes: "Taxes",
  documents: "Documents",
  logistics: "Logistique",
  trade: "Commerce international",
  sante: "Sante",
};

function parseNumber(value: string | null | undefined) {
  const raw = String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^0-9,.-]/g, "")
    .replace(/,(?=\d{1,2}$)/, ".")
    .replace(/,/g, "");

  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
}

function normalizeHeader(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function hasSemanticHeader(headers: string[], field: string) {
  const aliases = FIELD_ALIASES[field] || [field];
  const normalizedHeaders = headers.map((header) => normalizeHeader(header));
  return aliases.some((alias) => normalizedHeaders.includes(normalizeHeader(alias)));
}

function summarizeDataset(type: DatasetType, fileName: string, data: TabularData): DatasetSummary {
  const expected = DATASET_CONFIG[type].expectedFields;
  const foundFields = expected.filter((field) => hasSemanticHeader(data.headers, field));
  const missingFields = expected.filter((field) => !foundFields.includes(field));
  const quality = Math.round((foundFields.length / Math.max(expected.length, 1)) * 100);

  return {
    type,
    fileName,
    rows: data.rows.length,
    columns: data.headers.length,
    importedAt: new Date().toISOString(),
    quality,
    foundFields,
    missingFields,
  };
}

function isIso2(value: string) {
  return /^[A-Z]{2}$/.test(String(value || "").toUpperCase());
}

function detectDelimiter(line: string) {
  const candidates = [";", ",", "\t"];
  let best = ";";
  let bestScore = -1;

  for (const separator of candidates) {
    const score = line.split(separator).length;
    if (score > bestScore) {
      bestScore = score;
      best = separator;
    }
  }

  return best;
}

function parseCsv(rawText: string): TabularData {
  const clean = rawText.replace(/^\uFEFF/, "").trim();
  if (!clean) return { headers: [], rows: [] };

  const firstLine = clean.split(/\r?\n/)[0] || "";
  const separator = detectDelimiter(firstLine);

  const lines = clean.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const rows = lines.map((line) => line.split(separator).map((cell) => cell.trim()));

  const headers = rows.shift() || [];
  return { headers, rows };
}

async function readTabularFile(file: File): Promise<TabularData> {
  const lower = file.name.toLowerCase();
  const isExcel = lower.endsWith(".xlsx") || lower.endsWith(".xls") || file.type.includes("excel") || file.type.includes("sheet");

  if (!isExcel) {
    const text = await file.text();
    return parseCsv(text);
  }

  const xlsx = await import("xlsx");
  const arrayBuffer = await file.arrayBuffer();
  const workbook = xlsx.read(arrayBuffer, { type: "array" });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet || !workbook.Sheets[firstSheet]) {
    return { headers: [], rows: [] };
  }

  const csv = xlsx.utils.sheet_to_csv(workbook.Sheets[firstSheet], { FS: ";", RS: "\n" });
  return parseCsv(csv);
}

function normalizeCountry(value: string) {
  const input = String(value || "").trim();
  if (!input) return "";

  const upper = input.toUpperCase();
  if (/^[A-Z]{2}$/.test(upper)) return upper;

  const low = input.toLowerCase();
  const found = COUNTRIES.find((country) => {
    const fr = country.label_fr.toLowerCase();
    const en = country.label_en.toLowerCase();
    return low === fr || low === en;
  });

  return found?.iso2 || upper.slice(0, 2);
}

function resolveProductCode(value: string) {
  const input = String(value || "").trim().toLowerCase();
  if (!input) return "";

  const exact = PRODUCTS.find((product) => product.code === input);
  if (exact) return exact.code;

  const byLabel = PRODUCTS.find((product) => {
    const fr = product.label_fr.toLowerCase();
    const en = product.label_en.toLowerCase();
    return input === fr || input === en || fr.includes(input) || en.includes(input);
  });

  return byLabel?.code || "";
}

function estimateTotalCosts(row: ControlTowerRow) {
  const baseCostRatio = 0.62;
  const variableCost = row.amount * baseCostRatio;
  return variableCost + row.transportCost;
}

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency || "EUR",
      maximumFractionDigits: 0,
    }).format(value || 0);
  } catch {
    return `${Math.round(value || 0)} ${currency || "EUR"}`;
  }
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function inferWatchTopic(tags: string[]) {
  const t = new Set(tags);
  if (t.has("dangerous_goods") || t.has("cold_chain") || t.has("mobility") || t.has("automotive")) return "logistics";
  if (t.has("regulated") || t.has("phytosanitary") || t.has("medical")) return "documents";
  if (t.has("energy") || t.has("construction") || t.has("industry")) return "taxes";
  return "trade";
}

function pickLinksByIds(list: Array<{ id: string; name: string; url: string }>, ids: string[]) {
  return ids
    .map((id) => list.find((item) => item.id === id))
    .filter(Boolean) as Array<{ id: string; name: string; url: string }>;
}

function buildMarketWatchLinks(params: {
  tags: string[];
  hasSeaExposure: boolean;
  hasFxExposure: boolean;
}): MarketWatchLink[] {
  const tags = new Set(params.tags);
  const links: MarketWatchLink[] = [];

  const add = (
    source: Array<{ id: string; name: string; url: string }>,
    ids: string[],
    group: MarketWatchLink["group"],
    reason: string,
    priority: MarketWatchLink["priority"]
  ) => {
    for (const item of pickLinksByIds(source, ids)) {
      links.push({
        id: item.id,
        title: item.name,
        link: item.url,
        reason,
        group,
        priority,
      });
    }
  };

  if (tags.has("agri") || tags.has("food") || tags.has("beverage")) {
    add(
      COMMODITIES_MARKET_LINKS,
      ["euronext-wheat", "euronext-corn", "cme-corn", "cme-wheat"],
      "commodities",
      "Vos produits agricoles/food sont sensibles aux cours matieres premieres.",
      "high"
    );
  }

  if (tags.has("energy") || tags.has("dangerous_goods")) {
    add(
      TRANSPORT_MARKET_LINKS,
      ["ec-weekly-oil-bulletin", "eia-gasdiesel-rss", "shipandbunker-rss"],
      "transport",
      "Les couts energie impactent directement vos prix rendus.",
      "high"
    );
  }

  if (tags.has("industry") || tags.has("construction") || tags.has("electronics")) {
    add(
      COMMODITIES_MARKET_LINKS,
      ["lme-copper", "ice-brent"],
      "commodities",
      "Vos produits industriels suivent les cycles metaux/energie.",
      "medium"
    );
  }

  if (params.hasSeaExposure) {
    add(
      TRANSPORT_MARKET_LINKS,
      ["drewry-trackers", "sse-scfi", "freightos-fbx", "balticexchange-fbx"],
      "transport",
      "Flux maritime detecte : surveillez les indices fret route oceanique.",
      "high"
    );
  }

  if (params.hasFxExposure) {
    add(
      FX_RSS_ECB,
      ["ecb-fx-usd-rss", "ecb-fx-gbp-rss", "ecb-fx-cny-rss"],
      "fx",
      "Vos transactions hors EUR necessitent une veille de change.",
      "medium"
    );
  }

  if (!links.length) {
    add(
      TRANSPORT_MARKET_LINKS,
      ["freightos-updates", "iata-econ-library"],
      "transport",
      "Aucun signal produit fort detecte : base veille transport globale.",
      "medium"
    );
  }

  const dedup = new Map<string, MarketWatchLink>();
  for (const link of links) {
    if (!dedup.has(link.id)) dedup.set(link.id, link);
  }
  return Array.from(dedup.values()).slice(0, 8);
}

function buildRouteAlerts(params: {
  rows: ControlTowerRow[];
  negativeLines: number;
  revenue: number;
  transportSpend: number;
}): RouteAlert[] {
  const alerts: RouteAlert[] = [];
  const seaCount = params.rows.filter((row) => ["FOB", "CFR", "CIF"].includes(row.incoterm)).length;
  const ddpCount = params.rows.filter((row) => row.incoterm === "DDP").length;
  const transportRatio = params.revenue > 0 ? params.transportSpend / params.revenue : 0;

  if (ddpCount > 0 && params.transportSpend === 0) {
    alerts.push({
      id: "ddp_without_cost",
      severity: "high",
      title: "Incoterm DDP sans couts declares",
      detail: `${ddpCount} ligne(s) DDP detectee(s), mais aucun cout transport/assurance n'est saisi.`,
      action: "Completer freight + assurance pour fiabiliser marge et valeur douane.",
    });
  }

  if (seaCount > 0 && transportRatio < 0.02) {
    alerts.push({
      id: "sea_cost_underestimated",
      severity: "medium",
      title: "Couts route maritime probablement sous-estimes",
      detail: `${seaCount} ligne(s) maritimes avec ratio cout transport ${Math.round(transportRatio * 100)}%.`,
      action: "Verifier contrats transitaires et surcharges bunker.",
    });
  }

  if (params.negativeLines > 0) {
    alerts.push({
      id: "negative_margin_lines",
      severity: "high",
      title: "Lignes a marge negative detectees",
      detail: `${params.negativeLines} operation(s) ont une marge < 0 avec les couts declares.`,
      action: "Revoir prix de vente, incoterm ou regroupement logistique.",
    });
  }

  if (!alerts.length) {
    alerts.push({
      id: "baseline_ok",
      severity: "low",
      title: "Routes stables sur les donnees chargees",
      detail: "Aucun signal critique immediate sur incoterm/cout/transport.",
      action: "Maintenir la surveillance hebdomadaire des indices fret et FX.",
    });
  }

  return alerts.slice(0, 4);
}

function getColumnIndex(headers: string[], selectedHeader: string) {
  const idx = headers.findIndex((header) => header === selectedHeader);
  return idx >= 0 ? idx : null;
}

function mapRowsToControlTowerRows(data: TabularData, mapping: ColumnMapping): ControlTowerRow[] {
  const countryIdx = getColumnIndex(data.headers, mapping.country);
  const productIdx = getColumnIndex(data.headers, mapping.product);
  const qtyIdx = getColumnIndex(data.headers, mapping.qty);
  const amountIdx = getColumnIndex(data.headers, mapping.amount);
  const currencyIdx = getColumnIndex(data.headers, mapping.currency);
  const incotermIdx = getColumnIndex(data.headers, mapping.incoterm);
  const channelIdx = getColumnIndex(data.headers, mapping.channel);
  const transportIdx = getColumnIndex(data.headers, mapping.transportCost);

  if (countryIdx === null || productIdx === null || qtyIdx === null || amountIdx === null) {
    return [];
  }

  return data.rows
    .map((cells) => {
      const country = normalizeCountry(cells[countryIdx] || "");
      const productCode = resolveProductCode(cells[productIdx] || "");
      const qty = Math.max(0, parseNumber(cells[qtyIdx] || "0"));
      const amount = Math.max(0, parseNumber(cells[amountIdx] || "0"));

      const currency = currencyIdx === null ? "EUR" : String(cells[currencyIdx] || "EUR").toUpperCase();
      const incoterm = incotermIdx === null ? "EXW" : String(cells[incotermIdx] || "EXW").toUpperCase();
      const channel = channelIdx === null ? "direct" : String(cells[channelIdx] || "direct").toLowerCase();
      const transportCost = transportIdx === null ? 0 : Math.max(0, parseNumber(cells[transportIdx] || "0"));

      if (!country || !productCode || amount <= 0) return null;

      return {
        id: uid(),
        country,
        productCode,
        qty: qty || 1,
        amount,
        currency,
        incoterm,
        channel,
        transportCost,
      } satisfies ControlTowerRow;
    })
    .filter(Boolean) as ControlTowerRow[];
}

function getProductLabel(productCode: string, lang: "fr" | "en") {
  const product = PRODUCTS.find((item) => item.code === productCode);
  if (!product) return productCode;
  return lang === "en" ? product.label_en : product.label_fr;
}

export default function ControlTower() {
  const { lang } = useI18n();
  const isEn = lang === "en";

  const [fileName, setFileName] = React.useState("");
  const [datasetType, setDatasetType] = React.useState<DatasetType>("sales");
  const [importInfo, setImportInfo] = React.useState("");
  const [tabularData, setTabularData] = React.useState<TabularData>({ headers: [], rows: [] });
  const [datasetSummaries, setDatasetSummaries] = React.useState<Record<DatasetType, DatasetSummary | null>>({
    sales: null,
    margins: null,
    products: null,
    clients: null,
    routes: null,
  });
  const [mapping, setMapping] = React.useState<ColumnMapping>(EMPTY_MAPPING);
  const [importMode, setImportMode] = React.useState<"merge" | "replace">("merge");
  const [rows, setRows] = React.useState<ControlTowerRow[]>([]);
  const [manualRow, setManualRow] = React.useState<ManualRowInput>(EMPTY_MANUAL_ROW);
  const [selectedCountry, setSelectedCountry] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [errorText, setErrorText] = React.useState("");
  const [marketEvents, setMarketEvents] = React.useState<MarketEvent[]>([]);
  const [marketEventsLoading, setMarketEventsLoading] = React.useState(false);
  const [marketEventsError, setMarketEventsError] = React.useState("");

  const hasMappedRequiredFields = Boolean(mapping.country && mapping.product && mapping.qty && mapping.amount);

  const rowsForDashboard = React.useMemo(() => {
    if (!selectedCountry) return rows;
    return rows.filter((row) => row.country === selectedCountry);
  }, [rows, selectedCountry]);

  const operationsMetrics = React.useMemo(() => {
    const revenue = rowsForDashboard.reduce((sum, row) => sum + row.amount, 0);
    const transportSpend = rowsForDashboard.reduce((sum, row) => sum + row.transportCost, 0);
    const costs = rowsForDashboard.reduce((sum, row) => sum + estimateTotalCosts(row), 0);
    const margin = revenue - costs;
    const negativeLines = rowsForDashboard.filter((row) => row.amount - estimateTotalCosts(row) < 0).length;
    const avgMarginRate = revenue > 0 ? (margin / revenue) * 100 : 0;
    const fxExposure = rowsForDashboard.some((row) => row.currency !== "EUR");
    const seaExposure = rowsForDashboard.some((row) => ["FOB", "CFR", "CIF"].includes(row.incoterm));
    return {
      revenue,
      transportSpend,
      costs,
      margin,
      negativeLines,
      avgMarginRate,
      fxExposure,
      seaExposure,
    };
  }, [rowsForDashboard]);

  const countryStats = React.useMemo(() => {
    const map: Record<string, { label?: string; alerts: number; updates: number; total: number }> = {};

    rows.forEach((row) => {
      const country = String(row.country || "").toUpperCase();
      if (!isIso2(country)) return;

      const margin = row.amount - estimateTotalCosts(row);
      const current = map[country] || {
        label: getCountryLabel(country, lang),
        alerts: 0,
        updates: 0,
        total: 0,
      };

      if (margin < 0) {
        current.alerts += 1;
      } else {
        current.updates += 1;
      }
      current.total += 1;
      map[country] = current;
    });

    return map;
  }, [lang, rows]);

  const selectedCountryStats = React.useMemo(() => {
    if (selectedCountry) {
      return countryStats[selectedCountry] || { alerts: 0, updates: 0, total: 0 };
    }

    return Object.values(countryStats).reduce(
      (acc, item) => {
        acc.alerts += item.alerts || 0;
        acc.updates += item.updates || 0;
        acc.total += item.total || 0;
        return acc;
      },
      { alerts: 0, updates: 0, total: 0 }
    );
  }, [countryStats, selectedCountry]);

  const profitabilityByCountry = React.useMemo(() => {
    const map = new Map<
      string,
      { country: string; revenue: number; cost: number; margin: number; lines: number }
    >();

    rowsForDashboard.forEach((row) => {
      const current = map.get(row.country) || { country: row.country, revenue: 0, cost: 0, margin: 0, lines: 0 };
      const costs = estimateTotalCosts(row);
      const margin = row.amount - costs;
      current.revenue += row.amount;
      current.cost += costs;
      current.margin += margin;
      current.lines += 1;
      map.set(row.country, current);
    });

    return Array.from(map.values()).sort((a, b) => b.margin - a.margin);
  }, [rowsForDashboard]);

  const topProductsByCountry = React.useMemo(() => {
    const map = new Map<string, { country: string; productCode: string; qty: number; amount: number }>();

    rowsForDashboard.forEach((row) => {
      const key = `${row.country}:${row.productCode}`;
      const current = map.get(key) || {
        country: row.country,
        productCode: row.productCode,
        qty: 0,
        amount: 0,
      };
      current.qty += row.qty;
      current.amount += row.amount;
      map.set(key, current);
    });

    return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 10);
  }, [rowsForDashboard]);

  const channelPerformance = React.useMemo(() => {
    const map = new Map<string, { channel: string; amount: number; margin: number }>();

    rowsForDashboard.forEach((row) => {
      const current = map.get(row.channel) || { channel: row.channel, amount: 0, margin: 0 };
      const margin = row.amount - estimateTotalCosts(row);
      current.amount += row.amount;
      current.margin += margin;
      map.set(row.channel, current);
    });

    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  }, [rowsForDashboard]);

  const topTags = React.useMemo(() => {
    const counts = new Map<string, number>();

    rowsForDashboard.forEach((row) => {
      const product = PRODUCTS.find((item) => item.code === row.productCode);
      for (const tag of product?.tags || []) {
        counts.set(tag, (counts.get(tag) || 0) + row.qty);
      }
    });

    return Array.from(counts.entries())
      .map(([tag, qty]) => ({ tag, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 4);
  }, [rowsForDashboard]);

  const feedTopic = React.useMemo(() => inferWatchTopic(topTags.map((item) => item.tag)), [topTags]);
  const feedTopicLabel = TOPIC_LABELS_FR[feedTopic] || feedTopic;

  const marketWatchLinks = React.useMemo(
    () =>
      buildMarketWatchLinks({
        tags: topTags.map((item) => item.tag),
        hasSeaExposure: operationsMetrics.seaExposure,
        hasFxExposure: operationsMetrics.fxExposure,
      }),
    [operationsMetrics.fxExposure, operationsMetrics.seaExposure, topTags]
  );

  const routeAlerts = React.useMemo(
    () =>
      buildRouteAlerts({
        rows: rowsForDashboard,
        negativeLines: operationsMetrics.negativeLines,
        revenue: operationsMetrics.revenue,
        transportSpend: operationsMetrics.transportSpend,
      }),
    [operationsMetrics.negativeLines, operationsMetrics.revenue, operationsMetrics.transportSpend, rowsForDashboard]
  );

  const integratedCount = React.useMemo(
    () => DATASET_ORDER.filter((type) => Boolean(datasetSummaries[type])).length,
    [datasetSummaries]
  );
  const dataCoverage = Math.round((integratedCount / DATASET_ORDER.length) * 100);

  const suggestions = React.useMemo(() => {
    const list: string[] = [];

    const bestCountry = profitabilityByCountry[0];
    if (bestCountry) {
      list.push(
        isEn
          ? `Scale in ${getCountryLabel(bestCountry.country, "en")}: currently highest margin destination.`
          : `Accroitre l'activite sur ${getCountryLabel(bestCountry.country, "fr")}: destination la plus rentable.`
      );
    }

    const weakCountry = profitabilityByCountry.find((entry) => entry.margin < 0);
    if (weakCountry) {
      list.push(
        isEn
          ? `Review pricing/incoterm on ${getCountryLabel(weakCountry.country, "en")} (negative margin).`
          : `Revoir prix/incoterm sur ${getCountryLabel(weakCountry.country, "fr")} (marge negative).`
      );
    }

    const topChannel = channelPerformance[0];
    if (topChannel) {
      list.push(
        isEn
          ? `Reinforce channel ${topChannel.channel} and replicate its playbook in similar countries.`
          : `Renforcer le canal ${topChannel.channel} et reproduire son playbook sur des pays proches.`
      );
    }

    if (operationsMetrics.fxExposure) {
      list.push(
        isEn
          ? "Activate weekly FX review: non-EUR sales detected."
          : "Activer un suivi de change hebdomadaire : ventes hors EUR detectees."
      );
    }

    if (!list.length) {
      list.push(
        isEn
          ? "Import CSV/XLSX data first to generate optimization recommendations."
          : "Importez d'abord des donnees CSV/XLSX pour obtenir des recommandations d'optimisation."
      );
    }

    return list.slice(0, 4);
  }, [channelPerformance, isEn, operationsMetrics.fxExposure, profitabilityByCountry]);

  React.useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const loadMarketEvents = async () => {
      setMarketEventsLoading(true);
      setMarketEventsError("");

      try {
        const params = new URLSearchParams({
          limit: "8",
          territory: selectedCountry || "WORLD",
          official: "0",
          topic: feedTopic,
        });

        const res = await fetch(`/api/rss?${params.toString()}`, { signal: controller.signal });
        const json = await res.json().catch(() => ({}));
        if (!active) return;

        const items = Array.isArray(json?.items) ? json.items : [];
        const normalized = items
          .map((item: any, idx: number) => {
            const link = String(item?.link || item?.url || "").trim();
            if (!/^https?:\/\//i.test(link)) return null;
            return {
              id: `${link}-${idx}`,
              title: String(item?.title || "Signal marche"),
              link,
              source: item?.source || item?.feed || undefined,
              publishedAt: item?.publishedAt || item?.published_at || item?.pubDate || undefined,
              category: item?.category || undefined,
              importance: Number(item?.importance) || 0,
            } as MarketEvent;
          })
          .filter(Boolean) as MarketEvent[];

        normalized.sort((a, b) => {
          if (b.importance !== a.importance) return b.importance - a.importance;
          const da = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
          const db = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
          return db - da;
        });

        setMarketEvents(normalized.slice(0, 8));
      } catch (error) {
        if (!active) return;
        const e = error as { name?: string };
        if (e?.name !== "AbortError") {
          setMarketEventsError(
            isEn
              ? "Market events are temporarily unavailable."
              : "Les evenements marches sont temporairement indisponibles."
          );
          setMarketEvents([]);
        }
      } finally {
        if (active) setMarketEventsLoading(false);
      }
    };

    void loadMarketEvents();
    return () => {
      active = false;
      controller.abort();
    };
  }, [feedTopic, isEn, selectedCountry]);

  const handleFile = async (file: File) => {
    setLoading(true);
    setErrorText("");
    setImportInfo("");

    try {
      const parsed = await readTabularFile(file);
      if (!parsed.headers.length || !parsed.rows.length) {
        throw new Error(isEn ? "Empty file" : "Fichier vide");
      }

      const summary = summarizeDataset(datasetType, file.name, parsed);
      setDatasetSummaries((prev) => ({ ...prev, [datasetType]: summary }));
      setTabularData(parsed);
      setFileName(file.name);
      setMapping(EMPTY_MAPPING);
      setImportInfo(
        isEn
          ? `${DATASET_CONFIG[datasetType].labelEn} imported (${summary.rows} rows).`
          : `${DATASET_CONFIG[datasetType].labelFr} importe (${summary.rows} lignes).`
      );
    } catch (error) {
      setErrorText(toFriendlyErrorMessage(error, lang));
    } finally {
      setLoading(false);
    }
  };

  const applyMapping = () => {
    if (!hasMappedRequiredFields) return;

    const mappedRows = mapRowsToControlTowerRows(tabularData, mapping);
    if (!mappedRows.length) {
      setErrorText(
        isEn
          ? "No usable lines after mapping. Please check your column mapping."
          : "Aucune ligne exploitable apres mapping. Verifiez la correspondance des colonnes."
      );
      return;
    }

    setRows((prev) => (importMode === "replace" ? mappedRows : [...prev, ...mappedRows]));
    setErrorText("");
    setImportInfo(
      isEn
        ? `${mappedRows.length} operations loaded into Control Tower.`
        : `${mappedRows.length} operations chargees dans la Control Tower.`
    );
  };

  const addManualRow = () => {
    const qty = Math.max(1, parseNumber(manualRow.qty));
    const amount = Math.max(0, parseNumber(manualRow.amount));
    const transportCost = Math.max(0, parseNumber(manualRow.transportCost));

    if (!manualRow.country || !manualRow.productCode || amount <= 0) {
      setErrorText(
        isEn
          ? "Manual row requires country, product and amount."
          : "Ligne manuelle: pays, produit et montant obligatoires."
      );
      return;
    }

    const row: ControlTowerRow = {
      id: uid(),
      country: manualRow.country,
      productCode: manualRow.productCode,
      qty,
      amount,
      currency: manualRow.currency || "EUR",
      incoterm: manualRow.incoterm || "EXW",
      channel: manualRow.channel || "direct",
      transportCost,
    };

    setRows((prev) => [...prev, row]);
    setManualRow(EMPTY_MANUAL_ROW);
    setErrorText("");
  };

  const clearRows = () => {
    setRows([]);
    setSelectedCountry(null);
    setFileName("");
    setTabularData({ headers: [], rows: [] });
    setMapping(EMPTY_MAPPING);
    setImportInfo("");
  };

  const scopeLabel = selectedCountry
    ? getCountryLabel(selectedCountry, lang)
    : isEn
    ? "World"
    : "Monde";

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">MPL Export Navigator</p>
          <h1 className="text-2xl font-semibold">
            {isEn ? "Control Tower" : "Control Tower export"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isEn
              ? "Operational cockpit for import/export: integrate sales, margins, products and clients, then pilot by country, product, routes and market signals."
              : "Outil de pilotage import/export : integrez ventes, marges, produits et clients, puis pilotez par pays, produit, routes et signaux marches."}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              {isEn ? "1) Operations data hub" : "1) Hub donnees operations"}
            </CardTitle>
            <CardDescription>
              {isEn
                ? "Load one or more files (sales, margins, products, clients, routes)."
                : "Chargez un ou plusieurs fichiers (ventes, marges, produits, clients, routes)."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-1">
                <Label>{isEn ? "Dataset type" : "Type de fichier"}</Label>
                <Select value={datasetType} onValueChange={(value) => setDatasetType(value as DatasetType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATASET_ORDER.map((type) => (
                      <SelectItem key={`dataset-${type}`} value={type}>
                        {isEn ? DATASET_CONFIG[type].labelEn : DATASET_CONFIG[type].labelFr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-3 rounded-xl border border-dashed p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <UploadCloud className="h-4 w-4" />
                    {fileName || (isEn ? "No file selected" : "Aucun fichier selectionne")}
                  </div>

                  <Input
                    type="file"
                    accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    disabled={loading}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        void handleFile(file);
                      }
                      event.currentTarget.value = "";
                    }}
                  />
                </div>

                {loading ? (
                  <div className="mt-3 text-sm text-muted-foreground">{isEn ? "Loading file..." : "Chargement du fichier..."}</div>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="outline">{tabularData.headers.length} {isEn ? "columns" : "colonnes"}</Badge>
                  <Badge variant="outline">{tabularData.rows.length} {isEn ? "rows" : "lignes"}</Badge>
                  <Badge variant={dataCoverage >= 60 ? "default" : "secondary"}>
                    {isEn ? "Data coverage" : "Couverture donnees"} {dataCoverage}%
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-5">
              {DATASET_ORDER.map((type) => {
                const summary = datasetSummaries[type];
                const ready = Boolean(summary);
                return (
                  <div key={`summary-${type}`} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        {isEn ? DATASET_CONFIG[type].labelEn : DATASET_CONFIG[type].labelFr}
                      </p>
                      <Badge variant={ready ? "default" : "secondary"}>{ready ? "OK" : "-"}</Badge>
                    </div>
                    {summary ? (
                      <div className="mt-2 space-y-1 text-xs">
                        <p className="truncate font-medium">{summary.fileName}</p>
                        <p className="text-muted-foreground">
                          {summary.rows} {isEn ? "rows" : "lignes"} · {summary.columns} {isEn ? "columns" : "colonnes"}
                        </p>
                        <p className="text-muted-foreground">{isEn ? "Quality" : "Qualite"} {summary.quality}/100</p>
                        {summary.missingFields.length ? (
                          <p className="text-amber-700">{isEn ? "Missing:" : "Manquant :"} {summary.missingFields.slice(0, 2).join(", ")}</p>
                        ) : (
                          <p className="text-emerald-700">{isEn ? "Key fields found" : "Champs cles detectes"}</p>
                        )}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">{isEn ? "Not imported yet" : "Pas encore importe"}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LineChart className="h-4 w-4" />
              {isEn ? "Major market + route events" : "Evenements majeurs marches + routes"}
            </CardTitle>
            <CardDescription>
              {isEn
                ? "Signals linked to selected country, products and transport exposure."
                : "Signaux relies au pays selectionne, aux produits charges et a vos expositions transport."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3 rounded-xl border p-4">
                <p className="text-sm font-semibold">{isEn ? "Live events feed" : "Flux evenements en direct"}</p>
                {marketEventsLoading ? (
                  <p className="text-sm text-muted-foreground">{isEn ? "Loading..." : "Chargement..."}</p>
                ) : marketEventsError ? (
                  <p className="text-sm text-rose-700">{marketEventsError}</p>
                ) : marketEvents.length ? (
                  <div className="space-y-3">
                    {marketEvents.map((item) => (
                      <a
                        key={item.id}
                        href={item.link}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-lg border p-3 hover:bg-muted/40"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium">{item.title}</p>
                          <Badge variant={item.importance >= 60 ? "destructive" : "secondary"}>
                            {item.importance || 0}
                          </Badge>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {(item.source || "RSS")} · {formatDateTime(item.publishedAt)}
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {isEn ? "No market events available for now." : "Pas d'evenement marche disponible pour le moment."}
                  </p>
                )}
              </div>

              <div className="space-y-3 rounded-xl border p-4">
                <p className="text-sm font-semibold">{isEn ? "Market links tied to your products/routes" : "Liens marche lies a vos produits/routes"}</p>
                <div className="space-y-2">
                  {marketWatchLinks.map((link) => (
                    <a
                      key={link.id}
                      href={link.link}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-lg border p-3 hover:bg-muted/40"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{link.title}</p>
                        <div className="flex items-center gap-1">
                          <Badge variant={link.priority === "high" ? "destructive" : "secondary"}>
                            {link.group}
                          </Badge>
                          <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{link.reason}</p>
                    </a>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-xl border p-4">
              <p className="mb-3 text-sm font-semibold">{isEn ? "Route risk alerts" : "Alertes risques routes"}</p>
              <div className="space-y-2">
                {routeAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`rounded-lg border p-3 ${
                      alert.severity === "high"
                        ? "border-rose-300 bg-rose-50"
                        : alert.severity === "medium"
                        ? "border-amber-300 bg-amber-50"
                        : "border-emerald-300 bg-emerald-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{alert.title}</p>
                      <Badge variant={alert.severity === "high" ? "destructive" : "secondary"}>
                        {alert.severity.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{alert.detail}</p>
                    <p className="mt-1 text-xs">{alert.action}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{isEn ? "Sales mapping to pilotable operations" : "Mapping ventes vers operations pilotables"}</CardTitle>
            <CardDescription>
              {isEn
                ? "Map country/product/qty/amount to feed operational KPIs and map watch."
                : "Mappez pays/produit/quantite/montant pour alimenter les KPI operationnels et la veille carte."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4">
            {[
              { key: "country", labelFr: "Colonne pays", labelEn: "Country column" },
              { key: "product", labelFr: "Colonne produit", labelEn: "Product column" },
              { key: "qty", labelFr: "Colonne quantite", labelEn: "Quantity column" },
              { key: "amount", labelFr: "Colonne montant", labelEn: "Amount column" },
              { key: "currency", labelFr: "Colonne devise", labelEn: "Currency column" },
              { key: "incoterm", labelFr: "Colonne incoterm", labelEn: "Incoterm column" },
              { key: "channel", labelFr: "Colonne canal", labelEn: "Channel column" },
              { key: "transportCost", labelFr: "Colonne cout transport", labelEn: "Transport cost column" },
            ].map((field) => (
              <div className="space-y-1" key={field.key}>
                <Label>{isEn ? field.labelEn : field.labelFr}</Label>
                <Select
                  value={mapping[field.key as keyof ColumnMapping]}
                  onValueChange={(value) =>
                    setMapping((prev) => ({ ...prev, [field.key]: value }))
                  }
                >
                  <SelectTrigger><SelectValue placeholder="-" /></SelectTrigger>
                  <SelectContent>
                    {tabularData.headers.map((header) => (
                      <SelectItem key={`${field.key}-${header}`} value={header}>{header}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}

            <div className="space-y-1 md:col-span-2">
              <Label>{isEn ? "Import mode" : "Mode d'import"}</Label>
              <Select value={importMode} onValueChange={(value) => setImportMode(value as "merge" | "replace")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="merge">{isEn ? "Merge with existing rows" : "Fusionner avec les lignes existantes"}</SelectItem>
                  <SelectItem value="replace">{isEn ? "Replace existing rows" : "Remplacer les lignes existantes"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2 flex items-end gap-2">
              <Button onClick={applyMapping} disabled={!hasMappedRequiredFields}>
                <FileSpreadsheet className="mr-1 h-4 w-4" />
                {isEn ? "Apply mapping" : "Appliquer le mapping"}
              </Button>
              <Button variant="outline" onClick={clearRows}>
                <RefreshCw className="mr-1 h-4 w-4" />
                {isEn ? "Reset" : "Reinitialiser"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{isEn ? "Manual row" : "Ajout manuel"}</CardTitle>
            <CardDescription>
              {isEn
                ? "Add missing operations manually (country/product/incoterm/cost)."
                : "Ajoutez une operation manuelle (pays/produit/incoterm/cout)."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1">
              <Label>{isEn ? "Country" : "Pays"}</Label>
              <Select value={manualRow.country} onValueChange={(value) => setManualRow((prev) => ({ ...prev, country: value }))}>
                <SelectTrigger><SelectValue placeholder="-" /></SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((country) => (
                    <SelectItem key={`manual-country-${country.iso2}`} value={country.iso2}>
                      {lang === "en" ? country.label_en : country.label_fr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>{isEn ? "Product" : "Produit"}</Label>
              <Select value={manualRow.productCode} onValueChange={(value) => setManualRow((prev) => ({ ...prev, productCode: value }))}>
                <SelectTrigger><SelectValue placeholder="-" /></SelectTrigger>
                <SelectContent>
                  {PRODUCTS.map((product) => (
                    <SelectItem key={`manual-product-${product.code}`} value={product.code}>
                      {lang === "en" ? product.label_en : product.label_fr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>{isEn ? "Quantity" : "Quantite"}</Label>
              <Input
                type="number"
                min={1}
                value={manualRow.qty}
                onChange={(event) => setManualRow((prev) => ({ ...prev, qty: event.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <Label>{isEn ? "Amount" : "Montant"}</Label>
              <Input
                type="number"
                min={0}
                value={manualRow.amount}
                onChange={(event) => setManualRow((prev) => ({ ...prev, amount: event.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <Label>{isEn ? "Currency" : "Devise"}</Label>
              <Select value={manualRow.currency} onValueChange={(value) => setManualRow((prev) => ({ ...prev, currency: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((currency) => (
                    <SelectItem key={`manual-currency-${currency.value}`} value={currency.value}>{currency.value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Incoterm</Label>
              <Select value={manualRow.incoterm} onValueChange={(value) => setManualRow((prev) => ({ ...prev, incoterm: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INCOTERMS.map((incoterm) => (
                    <SelectItem key={`manual-incoterm-${incoterm.value}`} value={incoterm.value}>{incoterm.value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>{isEn ? "Channel" : "Canal"}</Label>
              <Select value={manualRow.channel} onValueChange={(value) => setManualRow((prev) => ({ ...prev, channel: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DISTRIBUTION_CHANNELS.map((channel) => (
                    <SelectItem key={`manual-channel-${channel.value}`} value={channel.value}>{channel.value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>{isEn ? "Transport cost" : "Cout transport"}</Label>
              <Input
                type="number"
                min={0}
                value={manualRow.transportCost}
                onChange={(event) => setManualRow((prev) => ({ ...prev, transportCost: event.target.value }))}
              />
            </div>

            <div className="md:col-span-4">
              <Button onClick={addManualRow}>
                <Plus className="mr-1 h-4 w-4" />
                {isEn ? "Add row" : "Ajouter la ligne"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {errorText ? <p className="text-sm text-rose-700">{errorText}</p> : null}
        {importInfo ? <p className="text-sm text-emerald-700">{importInfo}</p> : null}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe2 className="h-4 w-4" />
              {isEn ? "Map + country RSS watch" : "Carte + veille RSS pays"}
            </CardTitle>
            <CardDescription>
              {isEn
                ? "Map country selection drives the RSS territory automatically."
                : "La selection du pays sur la carte pilote automatiquement le flux RSS correspondant."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <PanoramicControlTowerMap
              selectedCountry={selectedCountry}
              selectedLabel={
                selectedCountry
                  ? getCountryLabel(selectedCountry, lang)
                  : isEn
                  ? "All countries"
                  : "Tous les pays"
              }
              stats={selectedCountryStats}
              countryStats={countryStats}
              onCountrySelect={(iso) => setSelectedCountry((prev) => (prev === iso ? null : iso))}
              onReset={() => setSelectedCountry(null)}
            />
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline">{isEn ? "Scope" : "Perimetre"}: {scopeLabel}</Badge>
              <Badge variant="outline">{isEn ? "Watch topic" : "Focus veille"}: {feedTopicLabel}</Badge>
              {topTags.map((item) => (
                <Badge key={`tag-${item.tag}`} variant="secondary">
                  {item.tag} ({item.qty})
                </Badge>
              ))}
            </div>
            <RssFooter
              territory={selectedCountry || "WORLD"}
              territoryLabel={scopeLabel}
              topic={feedTopic}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{isEn ? "Operational dashboard" : "Tableau de bord operationnel"}</CardTitle>
            <CardDescription>
              {selectedCountry
                ? isEn
                  ? `Filtered on ${getCountryLabel(selectedCountry, "en")}.`
                  : `Filtre actif sur ${getCountryLabel(selectedCountry, "fr")}.`
                : isEn
                ? "Top products by country, profitability and channel performance."
                : "Top produits par pays, rentabilite et performance canaux."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 md:grid-cols-6">
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">{isEn ? "Rows" : "Lignes"}</div>
                <div className="text-2xl font-semibold">{rowsForDashboard.length}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">{isEn ? "Countries" : "Pays"}</div>
                <div className="text-2xl font-semibold">{new Set(rowsForDashboard.map((row) => row.country)).size}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">{isEn ? "Revenue" : "Chiffre d'affaires"}</div>
                <div className="text-xl font-semibold">{formatMoney(operationsMetrics.revenue, "EUR")}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">{isEn ? "Margin" : "Marge"}</div>
                <div className={`text-xl font-semibold ${operationsMetrics.margin >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                  {formatMoney(operationsMetrics.margin, "EUR")}
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">{isEn ? "Transport spend" : "Budget transport"}</div>
                <div className="text-xl font-semibold">{formatMoney(operationsMetrics.transportSpend, "EUR")}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">{isEn ? "Margin rate" : "Taux de marge"}</div>
                <div className={`text-xl font-semibold ${operationsMetrics.avgMarginRate >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                  {operationsMetrics.avgMarginRate.toFixed(1)}%
                </div>
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-semibold">{isEn ? "Top products by country" : "Top produits par pays"}</p>
                <div className="rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-2 py-2 text-left">{isEn ? "Country" : "Pays"}</th>
                        <th className="px-2 py-2 text-left">{isEn ? "Product" : "Produit"}</th>
                        <th className="px-2 py-2 text-right">Qty</th>
                        <th className="px-2 py-2 text-right">{isEn ? "Amount" : "Montant"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topProductsByCountry.map((entry) => (
                        <tr key={`${entry.country}-${entry.productCode}`} className="border-t">
                          <td className="px-2 py-2">{getCountryLabel(entry.country, lang)}</td>
                          <td className="px-2 py-2">{getProductLabel(entry.productCode, lang)}</td>
                          <td className="px-2 py-2 text-right">{entry.qty.toFixed(0)}</td>
                          <td className="px-2 py-2 text-right">{formatMoney(entry.amount, "EUR")}</td>
                        </tr>
                      ))}
                      {!topProductsByCountry.length ? (
                        <tr>
                          <td className="px-2 py-3 text-center text-muted-foreground" colSpan={4}>
                            {isEn ? "No data yet" : "Pas de donnees"}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">{isEn ? "Most profitable countries" : "Pays les plus rentables"}</p>
                <div className="rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-2 py-2 text-left">{isEn ? "Country" : "Pays"}</th>
                        <th className="px-2 py-2 text-right">CA</th>
                        <th className="px-2 py-2 text-right">{isEn ? "Costs" : "Couts"}</th>
                        <th className="px-2 py-2 text-right">{isEn ? "Margin" : "Marge"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profitabilityByCountry.map((entry) => (
                        <tr key={`profit-${entry.country}`} className="border-t">
                          <td className="px-2 py-2">{getCountryLabel(entry.country, lang)}</td>
                          <td className="px-2 py-2 text-right">{formatMoney(entry.revenue, "EUR")}</td>
                          <td className="px-2 py-2 text-right">{formatMoney(entry.cost, "EUR")}</td>
                          <td className={`px-2 py-2 text-right ${entry.margin >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                            {formatMoney(entry.margin, "EUR")}
                          </td>
                        </tr>
                      ))}
                      {!profitabilityByCountry.length ? (
                        <tr>
                          <td className="px-2 py-3 text-center text-muted-foreground" colSpan={4}>
                            {isEn ? "No data yet" : "Pas de donnees"}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold">{isEn ? "Best channels" : "Canaux performants"}</p>
              <div className="rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-2 py-2 text-left">{isEn ? "Channel" : "Canal"}</th>
                      <th className="px-2 py-2 text-right">CA</th>
                      <th className="px-2 py-2 text-right">{isEn ? "Margin" : "Marge"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {channelPerformance.map((entry) => (
                      <tr key={`channel-${entry.channel}`} className="border-t">
                        <td className="px-2 py-2">{entry.channel}</td>
                        <td className="px-2 py-2 text-right">{formatMoney(entry.amount, "EUR")}</td>
                        <td className={`px-2 py-2 text-right ${entry.margin >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                          {formatMoney(entry.margin, "EUR")}
                        </td>
                      </tr>
                    ))}
                    {!channelPerformance.length ? (
                      <tr>
                        <td className="px-2 py-3 text-center text-muted-foreground" colSpan={3}>
                          {isEn ? "No data yet" : "Pas de donnees"}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <TrendingUp className="h-4 w-4" />
                {isEn ? "Optimization suggestions" : "Pistes d'optimisation"}
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {suggestions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Route className="h-4 w-4" />
                {isEn ? "Control Tower focus" : "Focus Control Tower"}
              </p>
              <div className="grid gap-2 text-sm md:grid-cols-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{isEn ? "Data" : "Donnees"}</p>
                  <p className="mt-1">{integratedCount}/{DATASET_ORDER.length} fichiers integres</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{isEn ? "Routes" : "Routes"}</p>
                  <p className="mt-1">{operationsMetrics.seaExposure ? "Sea exposure" : "No sea exposure"}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{isEn ? "FX" : "Change"}</p>
                  <p className="mt-1">{operationsMetrics.fxExposure ? "Non-EUR active" : "EUR only"}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

