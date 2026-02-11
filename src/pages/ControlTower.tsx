import * as React from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ExternalLink, FileSpreadsheet, RotateCcw, Rss, Upload, Download, Sparkles } from "lucide-react";
import { useCompanyProfile } from "@/hooks/useCompanyProfile";
import { PanoramicControlTowerMap } from "@/components/controlTower/PanoramicControlTowerMap";
import { usePlan } from "@/auth/PlanContext";
import { startOnlineCheckout } from "@/lib/billing";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PDFDocument, StandardFonts } from "pdf-lib";

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

type DecisionKey = "go-no-go" | "payment" | "pricing" | "documents";

type GoNoGoResult = {
  assessment_id?: string | null;
  decision: string;
  risk_score: number;
  risk_breakdown: {
    compliance: number;
    payment: number;
    logistics: number;
    documents: number;
  };
  recommendations: string[];
  checklist: string[];
  messages: {
    client: string;
    internal: string;
  };
  can_export: boolean;
  plan?: string;
};

const COUNTRY_COORDS: Record<string, { name: string; lat: number; lon: number }> = {
  FR: { name: "France", lat: 46.2276, lon: 2.2137 },
  DE: { name: "Allemagne", lat: 51.1657, lon: 10.4515 },
  ES: { name: "Espagne", lat: 40.4637, lon: -3.7492 },
  IT: { name: "Italie", lat: 41.8719, lon: 12.5674 },
  GB: { name: "Royaume-Uni", lat: 55.3781, lon: -3.436 },
  BE: { name: "Belgique", lat: 50.5039, lon: 4.4699 },
  NL: { name: "Pays-Bas", lat: 52.1326, lon: 5.2913 },
  CH: { name: "Suisse", lat: 46.8182, lon: 8.2275 },
  US: { name: "Ã‰tats-Unis", lat: 37.0902, lon: -95.7129 },
  CA: { name: "Canada", lat: 56.1304, lon: -106.3468 },
  MX: { name: "Mexique", lat: 23.6345, lon: -102.5528 },
  BR: { name: "BrÃ©sil", lat: -14.235, lon: -51.9253 },
  CN: { name: "Chine", lat: 35.8617, lon: 104.1954 },
  JP: { name: "Japon", lat: 36.2048, lon: 138.2529 },
  KR: { name: "CorÃ©e du Sud", lat: 35.9078, lon: 127.7669 },
  IN: { name: "Inde", lat: 20.5937, lon: 78.9629 },
  AE: { name: "Ã‰mirats arabes unis", lat: 23.4241, lon: 53.8478 },
  SA: { name: "Arabie saoudite", lat: 23.8859, lon: 45.0792 },
  TR: { name: "Turquie", lat: 38.9637, lon: 35.2433 },
  MA: { name: "Maroc", lat: 31.7917, lon: -7.0926 },
  DZ: { name: "AlgÃ©rie", lat: 28.0339, lon: 1.6596 },
  TN: { name: "Tunisie", lat: 33.8869, lon: 9.5375 },
  ZA: { name: "Afrique du Sud", lat: -30.5595, lon: 22.9375 },
  AU: { name: "Australie", lat: -25.2744, lon: 133.7751 },
};

const COUNTRY_PROFILE: Record<string, { currency: string; region: string; note: string }> = {
  FR: { currency: "EUR", region: "UE", note: "Marche domestique + UE." },
  DE: { currency: "EUR", region: "UE", note: "Industrie & biens d'equipement." },
  ES: { currency: "EUR", region: "UE", note: "Agro, retail, construction." },
  IT: { currency: "EUR", region: "UE", note: "Mode, mecanique, agro." },
  BE: { currency: "EUR", region: "UE", note: "Hub logistique Benelux." },
  NL: { currency: "EUR", region: "UE", note: "Portuaire, distribution UE." },
  GB: { currency: "GBP", region: "Europe", note: "Post-Brexit, regles d'origine." },
  CH: { currency: "CHF", region: "Europe", note: "Hors UE, exigences specifiques." },
  US: { currency: "USD", region: "Amerique du Nord", note: "Marche US, conformite stricte." },
  CA: { currency: "CAD", region: "Amerique du Nord", note: "Accords & conformite bilingue." },
  CN: { currency: "CNY", region: "Asie", note: "Controles export & normes." },
  JP: { currency: "JPY", region: "Asie", note: "Qualite & conformite elevees." },
  IN: { currency: "INR", region: "Asie", note: "Formalites & taxes variables." },
  AE: { currency: "AED", region: "MENA", note: "Hub regional, exigences docs." },
  SA: { currency: "SAR", region: "MENA", note: "Formalites & certificats." },
  TR: { currency: "TRY", region: "MENA", note: "Regles locales + douane." },
  MA: { currency: "MAD", region: "MENA", note: "Accords preferentiels possibles." },
  DZ: { currency: "DZD", region: "MENA", note: "Controles & licences." },
  TN: { currency: "TND", region: "MENA", note: "Formalites & taxes locales." },
  BR: { currency: "BRL", region: "Amerique Latine", note: "Procedures complexes." },
  MX: { currency: "MXN", region: "Amerique Latine", note: "Accords & conformite." },
  ZA: { currency: "ZAR", region: "Afrique", note: "Conformite & delais." },
  AU: { currency: "AUD", region: "Oceanie", note: "Normes & conformite." },
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

/** RSS sources (country-specific + global). */
const GLOBAL_RSS_SOURCES: RssSource[] = [
  { name: "Le Moci â€“ ActualitÃ©s", url: "https://www.lemoci.com/feed/" },
  { name: "UE â€“ ActualitÃ©s commerce", url: "https://policy.trade.ec.europa.eu/node/2/rss_en" },
  { name: "OMC â€“ DerniÃ¨res nouvelles", url: "https://www.wto.org/library/rss/latest_news_e.xml" },
];

const COUNTRY_RSS_SOURCES: Record<string, RssSource[]> = {
  FR: [
    { name: "Economie.gouv.fr â€“ ActualitÃ©s", url: "https://www.economie.gouv.fr/rss/toutesactualites" },
    { name: "Service-Public Pro â€“ ActualitÃ©s", url: "https://www.service-public.gouv.fr/abonnements/rss/actu-actu-pro.rss" },
    { name: "France Diplomatie â€“ News", url: "https://www.diplomatie.gouv.fr/en/backend-fd.php3" },
  ],
  DE: [{ name: "BMWK â€“ Pressemitteilungen", url: "https://www.bmwk.de/SiteGlobals/Functions/RSSFeed/RSSFeed-Pressemitteilung.xml" }],
  BE: [{ name: "news.belgium.be â€“ All news", url: "https://news.belgium.be/en/feeds/all" }],
  NL: [{ name: "Government.nl â€“ All news", url: "https://feeds.government.nl/news.rss" }],
  CH: [
    { name: "FINMA â€“ International sanctions", url: "https://www.finma.ch/en/rss/rss-internationale-sanktionen.xml" },
    { name: "FINMA â€“ News", url: "https://www.finma.ch/en/rss/rss-finma-news.xml" },
  ],
  CA: [
    {
      name: "Global Affairs Canada â€“ News releases (Atom)",
      url: "https://api.io.canada.ca/io-server/gc/news/en/v2?atomtitle=Global+Affairs+Canada+news+releases&dept=departmentofforeignaffairstradeanddevelopment&format=atom&orderBy=desc&pick=1000&publishedDate%3E=2015-01-01&sort=publishedDate&type=newsreleases",
    },
  ],
  US: [
    { name: "USTR â€“ Press releases", url: "https://ustr.gov/archive/Meta_Content/RSS/ustr_press_releases_10475.xml" },
    { name: "USTR â€“ Recent news", url: "https://ustr.gov/archive/Meta_Content/RSS/ustr_recent_news_10495.xml" },
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
  if (value === null || !Number.isFinite(value)) return "â€”";
  return `${Math.round(value * 1000) / 10}%`;
}

function countryFlag(iso: string) {
  const code = (iso || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return "??";
  const base = 0x1f1e6;
  const first = code.charCodeAt(0) - 65 + base;
  const second = code.charCodeAt(1) - 65 + base;
  return String.fromCodePoint(first, second);
}

function parseDateFlexible(raw?: string | null) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const direct = Date.parse(s);
  if (!Number.isNaN(direct)) return direct;
  const m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = Number(m[3]);
  if (year < 100) year += 2000;
  if (!day || !month || !year) return null;
  const dt = new Date(year, month - 1, day);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.getTime();
}

function formatDateShort(value: number | null) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return "—";
  }
}

function territoryLabel(code: string) {
  if (!code) return "â€”";
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
  const countryLabel = territoryLabel(upper);
  const querySources: RssSource[] = countryLabel
    ? [
        {
          name: `Google News â€“ ${countryLabel}`,
          url: `https://news.google.com/rss/search?q=${encodeURIComponent(countryLabel)}&hl=fr&gl=FR&ceid=FR:fr`,
        },
      ]
    : [];
  const specific = COUNTRY_RSS_SOURCES[upper] ?? [];
  // Toujours garder UE/OMC en fond de panier pour que â€œtous les paysâ€ aient une veille minimale
  return [...querySources, ...specific, ...GLOBAL_RSS_SOURCES];
}

function formatDate(ts: number | null) {
  if (!ts) return "â€”";
  try {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(ts));
  } catch {
    return "â€”";
  }
}

export default function ControlTower() {
  const { profile } = useCompanyProfile();
  const { user } = useAuth();
  const { plan } = usePlan();
  const isPro = plan !== "FREE";
  const planLabel = plan === "FREE" ? "Free" : plan.replace(/_/g, " ");
  const companyName = profile?.company_name?.trim() || "Votre entreprise";

  const [csvState, setCsvState] = React.useState<CsvState | null>(null);
  const [csvError, setCsvError] = React.useState<string | null>(null);
  const [csvName, setCsvName] = React.useState<string | null>(null);
  const [objectiveCsv, setObjectiveCsv] = React.useState<CsvState | null>(null);
  const [objectiveName, setObjectiveName] = React.useState<string | null>(null);
  const [objectiveError, setObjectiveError] = React.useState<string | null>(null);
  const [objectiveUploading, setObjectiveUploading] = React.useState(false);
  const [objectivePlan, setObjectivePlan] = React.useState<string[] | null>(null);
  const [planCtaError, setPlanCtaError] = React.useState<string | null>(null);

  const [assistantQuestion, setAssistantQuestion] = React.useState("");
  const [assistantAnswer, setAssistantAnswer] = React.useState<string | null>(null);
  const [assistantActions, setAssistantActions] = React.useState<string[]>([]);
  const [assistantLoading, setAssistantLoading] = React.useState(false);
  const [assistantError, setAssistantError] = React.useState<string | null>(null);

  const [decisionOpen, setDecisionOpen] = React.useState<DecisionKey | null>(null);
  const [decisionLoading, setDecisionLoading] = React.useState(false);
  const [decisionAnswer, setDecisionAnswer] = React.useState<string | null>(null);
  const [decisionActions, setDecisionActions] = React.useState<string[]>([]);
  const [decisionError, setDecisionError] = React.useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [deleteDone, setDeleteDone] = React.useState(false);

  const [goNoGoResult, setGoNoGoResult] = React.useState<GoNoGoResult | null>(null);
  const [goNoGoForm, setGoNoGoForm] = React.useState({
    country: "FR",
    product_desc: "",
    hs_code: "",
    incoterm: "",
    payment_method: "",
    value_amount: "",
    currency: "EUR",
    route: "",
    client: "",
  });

  const [paymentForm, setPaymentForm] = React.useState({
    country: "FR",
    payment_method: "",
    client: "",
  });
  const [pricingForm, setPricingForm] = React.useState({
    country: "FR",
    product_desc: "",
    incoterm: "",
    value_amount: "",
    currency: "EUR",
  });
  const [documentsForm, setDocumentsForm] = React.useState({
    country: "FR",
    product_desc: "",
    incoterm: "",
  });

  const assistantExamples = [
    "Comment trouver des distributeurs en Allemagne ?",
    "Quels incoterms recommander pour un premier export ?",
    "Quels risques sanctions pour exporter vers la Turquie ?",
  ];

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
  const rssPanelRef = React.useRef<HTMLDivElement | null>(null);
  const resultsRef = React.useRef<HTMLDivElement | null>(null);
  const scrollToResults = () => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const [activeNews, setActiveNews] = React.useState<RssItem | null>(null);
  const [pendingCountry, setPendingCountry] = React.useState<string | null>(null);

  React.useEffect(() => {
    const hs = readUserHsPrefs();
    setPreferredHs(hs);
    if (hs.length) setFocusPreferred(true);
  }, []);

  const getAuthToken = React.useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  const authFetch = React.useCallback(
    async (path: string, options: RequestInit) => {
      const token = await getAuthToken();
      if (!token) throw new Error("Authentification requise.");
      const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      };
      return fetch(path, { ...options, headers });
    },
    [getAuthToken],
  );

  const openDecision = React.useCallback(
    (key: DecisionKey) => {
      setDecisionOpen(key);
      setDecisionAnswer(null);
      setDecisionActions([]);
      setDecisionError(null);
      setDecisionLoading(false);
      setGoNoGoResult(null);

      const fallbackCountry = selectedWatchCountry || "FR";
      setGoNoGoForm((prev) => ({ ...prev, country: fallbackCountry }));
      setPaymentForm((prev) => ({ ...prev, country: fallbackCountry }));
      setPricingForm((prev) => ({ ...prev, country: fallbackCountry }));
      setDocumentsForm((prev) => ({ ...prev, country: fallbackCountry }));
    },
    [selectedWatchCountry],
  );

  const callAsk = React.useCallback(
    async (question: string, context?: Record<string, any>) => {
      const resp = await authFetch("/api/ask", {
        method: "POST",
        body: JSON.stringify({ question, context }),
      });
      const data = await resp.json();
      if (!resp.ok || !data?.ok) {
        throw new Error(data?.error || "Erreur IA");
      }
      return data as { answer: string; actions?: string[] };
    },
    [authFetch],
  );

  const handleAssistantAsk = async (override?: string) => {
    const question = String(override ?? assistantQuestion).trim();
    if (!question) return;
    if (override) setAssistantQuestion(question);
    setAssistantLoading(true);
    setAssistantError(null);
    setAssistantAnswer(null);
    setAssistantActions([]);
    try {
      const result = await callAsk(question, {
        company: companyName,
        country: selectedWatchCountry,
      });
      setAssistantAnswer(result.answer);
      setAssistantActions(result.actions || []);
    } catch (err: any) {
      setAssistantError(err?.message || "Erreur lors de la demande.");
    } finally {
      setAssistantLoading(false);
    }
  };

  const handleDecisionAsk = async (question: string, context?: Record<string, any>) => {
    setDecisionLoading(true);
    setDecisionError(null);
    setDecisionAnswer(null);
    setDecisionActions([]);
    try {
      const result = await callAsk(question, context);
      setDecisionAnswer(result.answer);
      setDecisionActions(result.actions || []);
    } catch (err: any) {
      setDecisionError(err?.message || "Erreur lors de la demande.");
    } finally {
      setDecisionLoading(false);
    }
  };

  const handleGoNoGo = async () => {
    setDecisionLoading(true);
    setDecisionError(null);
    setGoNoGoResult(null);
    try {
      const resp = await authFetch("/api/go-no-go", {
        method: "POST",
        body: JSON.stringify({
          ...goNoGoForm,
          value_amount: goNoGoForm.value_amount ? Number(goNoGoForm.value_amount) : null,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data?.ok) {
        if (data?.error === "quota_exceeded") {
          throw new Error("Limite Free atteinte. Passez en Pro pour debloquer.");
        }
        throw new Error(data?.error || "Erreur Go/No-Go");
      }
      setGoNoGoResult(data as GoNoGoResult);
    } catch (err: any) {
      setDecisionError(err?.message || "Erreur Go/No-Go.");
    } finally {
      setDecisionLoading(false);
    }
  };

  const handleObjectiveUpload = async (file: File) => {
    setObjectiveError(null);
    setObjectivePlan(null);
    setObjectiveUploading(true);

    try {
      const text = await file.text();
      const parsed = parseCsvText(text);
      if (!parsed.headers.length) {
        setObjectiveError("CSV vide ou illisible.");
        setObjectiveCsv(null);
        setObjectiveName(null);
        setObjectiveUploading(false);
        return;
      }

      setObjectiveCsv(parsed);
      setObjectiveName(file.name);

      if (!user?.id) {
        setObjectiveUploading(false);
        return;
      }

      const unique = crypto.randomUUID();
      const path = `${user.id}/${unique}/${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("objectives")
        .upload(path, file, { upsert: false, contentType: file.type || "text/csv" });

      if (uploadError) throw uploadError;

      const previewRows = {
        headers: parsed.headers,
        rows: parsed.rows.slice(0, 5),
      };

      const { error: insertError } = await supabase.from("objectives_uploads").insert({
        user_id: user.id,
        file_name: file.name,
        storage_bucket: "objectives",
        storage_path: path,
        mime_type: file.type || "text/csv",
        size_bytes: file.size,
        preview_rows: previewRows,
      });

      if (insertError) throw insertError;
    } catch (err: any) {
      setObjectiveError(err?.message || "Impossible de televerser le CSV.");
    } finally {
      setObjectiveUploading(false);
    }
  };

  const handleGeneratePlan = () => {
    const examples = objectiveCsv?.rows?.slice(0, 1)?.[0]?.join(" | ");
    const plan = [
      "Clarifier les objectifs prioritaires (CA cible, pays, produits, delais).",
      "Prioriser 3 marches a traiter en premier et definir le mix canaux.",
      "Construire une sequence prospection (ICP + 3 relances) et le plan de suivi.",
      "Valider la strategie prix/incoterm + les risques pays avant lancement.",
      examples ? `Verifier la coherence des donnees (ex: ${examples}).` : "Verifier la coherence des donnees CSV.",
    ];
    setObjectivePlan(plan);
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    if (!goNoGoResult) return;
    const rows = [
      ["Decision", goNoGoResult.decision],
      ["Risk Score", String(goNoGoResult.risk_score)],
      ["Compliance", String(goNoGoResult.risk_breakdown.compliance)],
      ["Payment", String(goNoGoResult.risk_breakdown.payment)],
      ["Logistics", String(goNoGoResult.risk_breakdown.logistics)],
      ["Documents", String(goNoGoResult.risk_breakdown.documents)],
      ["Recommendations", goNoGoResult.recommendations.join(" | ")],
      ["Checklist", goNoGoResult.checklist.join(" | ")],
      ["Message client", goNoGoResult.messages.client.replace(/\n/g, " ")],
      ["Message interne", goNoGoResult.messages.internal.replace(/\n/g, " ")],
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/\"/g, '""')}"`).join(";")).join("\n");
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), "go-no-go-export.csv");
  };

  const handleExportPdf = async () => {
    if (!goNoGoResult) return;
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const lines = [
      "Go/No-Go Export",
      `Decision: ${goNoGoResult.decision}`,
      `Score risque: ${goNoGoResult.risk_score}/100`,
      `Sanctions/Conformite: ${goNoGoResult.risk_breakdown.compliance}`,
      `Paiement: ${goNoGoResult.risk_breakdown.payment}`,
      `Logistique: ${goNoGoResult.risk_breakdown.logistics}`,
      `Documents: ${goNoGoResult.risk_breakdown.documents}`,
      "",
      "Recommandations:",
      ...goNoGoResult.recommendations.map((r) => `- ${r}`),
      "",
      "Checklist:",
      ...goNoGoResult.checklist.map((c) => `- ${c}`),
    ];

    let y = 800;
    for (let i = 0; i < lines.length; i += 1) {
      const text = lines[i];
      const size = i === 0 ? 18 : 11;
      page.drawText(text, {
        x: 50,
        y,
        size,
        font: i === 0 ? fontBold : font,
      });
      y -= size + 6;
      if (y < 60) break;
    }

    const bytes = await pdf.save();
    downloadBlob(new Blob([bytes], { type: "application/pdf" }), "go-no-go-export.pdf");
  };

  const handleDeleteData = async () => {
    setDeleteError(null);
    setDeleteDone(false);
    setDeleteLoading(true);
    try {
      const resp = await authFetch("/api/delete-data", { method: "POST", body: JSON.stringify({}) });
      const data = await resp.json();
      if (!resp.ok || !data?.ok) throw new Error(data?.error || "Suppression impossible");
      setDeleteDone(true);
    } catch (err: any) {
      setDeleteError(err?.message || "Erreur suppression.");
    } finally {
      setDeleteLoading(false);
    }
  };

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
        warnings.push(`Ligne ${lineNumber} : quantitÃ© invalide.`);
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
    // Si plusieurs devises: on force un filtre pour Ã©viter de mÃ©langer sans conversion.
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
      // âœ… on agrÃ¨ge seulement sur la devise courante si filtrÃ©e
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
  const selectedAgg = React.useMemo(
    () => destinationAggAll.find((entry) => entry.code === selectedWatchCountry),
    [destinationAggAll, selectedWatchCountry]
  );

  const selectedRows = React.useMemo(
    () => rowsAll.filter((row) => row.destination === selectedWatchCountry),
    [rowsAll, selectedWatchCountry]
  );

  const lastInvoiceAt = React.useMemo(() => {
    let last: number | null = null;
    for (const row of selectedRows) {
      const ts = parseDateFlexible(row.invoiceDate);
      if (!ts) continue;
      if (!last || ts > last) last = ts;
    }
    return last;
  }, [selectedRows]);

  const selectedCurrency = React.useMemo(() => {
    if (currencyFilter !== "ALL") return currencyFilter;
    if (selectedRows.length) return selectedRows[0].currency || defaults.currency;
    return defaults.currency;
  }, [currencyFilter, selectedRows, defaults.currency]);

  const selectedProfile = React.useMemo(() => {
    const upper = selectedWatchCountry.toUpperCase();
    return COUNTRY_PROFILE[upper] ?? { currency: selectedCurrency, region: "International", note: "Donnees locales." };
  }, [selectedWatchCountry, selectedCurrency]);

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

  const countryStats = React.useMemo(() => {
    const stats: Record<string, { label?: string; total?: number; updates?: number; alerts?: number }> = {};
    destinationAggAll.forEach((entry) => {
      if (!entry.code) return;
      stats[entry.code] = {
        label: entry.name,
        total: Math.round(entry.revenue || 0),
        updates: entry.lines,
        alerts: 0,
      };
    });
    return stats;
  }, [destinationAggAll]);

  const handleCountrySelect = React.useCallback(
    (iso: string) => {
      setDestinationFilter(iso);
      setSelectedWatchCountry(iso);
      setPendingCountry(iso);
      if (rssPanelRef.current) {
        rssPanelRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
    [rssPanelRef],
  );

  const handleCountryReset = React.useCallback(() => {
    setDestinationFilter("ALL");
    setSelectedWatchCountry("FR");
    setPendingCountry("FR");
  }, []);

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

      // Prioriser les sources pays si on en a (Google News + sources nationales)
      const globalUrls = new Set(GLOBAL_RSS_SOURCES.map((s) => s.url));
      const countrySourceNames = new Set(
        sources.filter((s) => !globalUrls.has(s.url)).map((s) => s.name)
      );
      const countryItems = merged.filter((it) => countrySourceNames.has(it.sourceName));
      const pool = countryItems.length ? countryItems : merged;

      // âœ… Limiter Google News et mieux rÃ©partir les autres sources
      const sourceMeta = new Map<string, { isGoogle: boolean }>();
      sources.forEach((s) => {
        let host = "";
        try {
          host = new URL(s.url).hostname;
        } catch {
          host = "";
        }
        const isGoogle = host.includes("news.google.com") || s.name.toLowerCase().includes("google news");
        sourceMeta.set(s.name, { isGoogle });
      });

      const maxTotal = 20;
      const maxGoogle = 4;
      const maxOther = 6;
      const rotationSeed = Math.floor(Date.now() / (1000 * 60 * 10)); // change toutes les 10 min
      const rotateList = (list: RssItem[], seed: number) => {
        if (list.length <= 1) return list;
        const offset = seed % list.length;
        return [...list.slice(offset), ...list.slice(0, offset)];
      };

      const grouped = new Map<string, RssItem[]>();
      pool.forEach((it) => {
        const key = it.sourceName || "Source";
        const list = grouped.get(key) || [];
        list.push(it);
        grouped.set(key, list);
      });

      const queues = Array.from(grouped.entries()).map(([name, list]) => {
        const isGoogle = sourceMeta.get(name)?.isGoogle ?? name.toLowerCase().includes("google news");
        const ordered = [...list].sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));
        const rotated = isGoogle ? rotateList(ordered, rotationSeed) : ordered;
        const cap = isGoogle ? maxGoogle : maxOther;
        return { name, isGoogle, items: rotated.slice(0, cap) };
      });

      // non-google d'abord
      queues.sort((a, b) => Number(a.isGoogle) - Number(b.isGoogle));

      const finalItems: RssItem[] = [];
      let guard = 0;
      while (finalItems.length < maxTotal) {
        let progressed = false;
        for (const q of queues) {
          if (!q.items.length) continue;
          finalItems.push(q.items.shift()!);
          progressed = true;
          if (finalItems.length >= maxTotal) break;
        }
        if (!progressed || guard++ > 200) break;
      }

      if (!finalItems.length) {
        setRssError(okCount ? "Aucun item RSS trouvÃ© (sources vides ou format non reconnu)." : "Impossible de rÃ©cupÃ©rer les flux RSS (blocage rÃ©seau/CORS).");
      } else {
        setRssError(null);
      }

      setRssItems(finalItems);
      rssCacheRef.current.set(cacheKey, { items: finalItems, at: now });
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

  React.useEffect(() => {
    if (!pendingCountry) return;
    if (pendingCountry !== selectedWatchCountry) return;
    if (rssItems.length) {
      setActiveNews(rssItems[0]);
    } else {
      setActiveNews(null);
    }
    setPendingCountry(null);
  }, [pendingCountry, selectedWatchCountry, rssItems]);

  const displayCurrency = currencyFilter !== "ALL" ? currencyFilter : (currencyList[0] || defaults.currency || "EUR");

  const selectedCountryLabel = territoryLabel(selectedWatchCountry);

  return (
    <AppLayout contentClassName="md:p-6">
      <div className="space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-blue-600">
              Bienvenue sur votre tour de contrÃ´le import export
            </p>
            <h1 className="text-3xl font-bold text-slate-900">L&apos;assistant</h1>
            <p className="text-sm text-slate-600">Avez-vous une question prÃ©cise ?</p>
            <p className="text-sm text-slate-500">
              Tableau de bord connectÃ© pour {companyName}. Import, export, prospection et suivi commercial.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 lg:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-[11px] uppercase tracking-[0.2em]">
                Plan {planLabel}
              </Badge>
              {!isPro ? (
                <Button
                  className="gap-2"
                  onClick={async () => {
                    setPlanCtaError(null);
                    try {
                      await startOnlineCheckout();
                    } catch (err: any) {
                      setPlanCtaError(err?.message || "Impossible d'ouvrir le checkout.");
                    }
                  }}
                >
                  DÃ©bloquer Pro
                </Button>
              ) : null}
            </div>
            {planCtaError ? <div className="text-xs text-rose-600">{planCtaError}</div> : null}
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Sparkles className="h-4 w-4 text-blue-600" />
                DÃ©cision du jour
              </div>
              <div className="text-xs text-slate-500">Mini-diagnostics express pour agir tout de suite.</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" className="rounded-full" onClick={() => openDecision("go-no-go")}>
                Go/No-Go pays
              </Button>
              <Button variant="secondary" className="rounded-full" onClick={() => openDecision("payment")}>
                SÃ©curiser le paiement
              </Button>
              <Button variant="secondary" className="rounded-full" onClick={() => openDecision("pricing")}>
                Calculer mon prix export
              </Button>
              <Button variant="secondary" className="rounded-full" onClick={() => openDecision("documents")}>
                ContrÃ´ler mes documents
              </Button>
            </div>
          </div>
        </section>

        <Drawer open={Boolean(decisionOpen)} onOpenChange={(open) => (!open ? setDecisionOpen(null) : null)}>
          <DrawerContent className="px-4 pb-6">
            <DrawerHeader>
              <DrawerTitle>
                {decisionOpen === "go-no-go" && "Go/No-Go Export en 60 sec"}
                {decisionOpen === "payment" && "SÃ©curiser le paiement"}
                {decisionOpen === "pricing" && "Calculer mon prix export"}
                {decisionOpen === "documents" && "ContrÃ´ler mes documents"}
              </DrawerTitle>
              <DrawerDescription>
                {decisionOpen === "go-no-go" && "Renseignez les infos clÃ©s pour un diagnostic rapide."}
                {decisionOpen === "payment" && "Mini-formulaire pour limiter le risque de paiement."}
                {decisionOpen === "pricing" && "DonnÃ©es minimum pour cadrer le prix export."}
                {decisionOpen === "documents" && "Liste documentaire personnalisÃ©e en 1 minute."}
              </DrawerDescription>
            </DrawerHeader>

            <div className="mx-auto w-full max-w-3xl space-y-4">
              {decisionOpen === "go-no-go" ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Pays</div>
                      <Input
                        value={goNoGoForm.country}
                        onChange={(e) => setGoNoGoForm((prev) => ({ ...prev, country: e.target.value }))}
                        placeholder="Ex: FR"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Produit (description)</div>
                      <Input
                        value={goNoGoForm.product_desc}
                        onChange={(e) => setGoNoGoForm((prev) => ({ ...prev, product_desc: e.target.value }))}
                        placeholder="Ex: appareils mÃ©dicaux"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">HS code (optionnel)</div>
                      <Input
                        value={goNoGoForm.hs_code}
                        onChange={(e) => setGoNoGoForm((prev) => ({ ...prev, hs_code: e.target.value }))}
                        placeholder="Ex: 9018"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Incoterm</div>
                      <Input
                        value={goNoGoForm.incoterm}
                        onChange={(e) => setGoNoGoForm((prev) => ({ ...prev, incoterm: e.target.value }))}
                        placeholder="Ex: DAP"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Mode paiement</div>
                      <Input
                        value={goNoGoForm.payment_method}
                        onChange={(e) => setGoNoGoForm((prev) => ({ ...prev, payment_method: e.target.value }))}
                        placeholder="Ex: acompte + LC"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Valeur</div>
                      <Input
                        value={goNoGoForm.value_amount}
                        onChange={(e) => setGoNoGoForm((prev) => ({ ...prev, value_amount: e.target.value }))}
                        placeholder="Ex: 50000"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Devise</div>
                      <Input
                        value={goNoGoForm.currency}
                        onChange={(e) => setGoNoGoForm((prev) => ({ ...prev, currency: e.target.value }))}
                        placeholder="EUR"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Route (optionnel)</div>
                      <Input
                        value={goNoGoForm.route}
                        onChange={(e) => setGoNoGoForm((prev) => ({ ...prev, route: e.target.value }))}
                        placeholder="Ex: maritime via Rotterdam"
                      />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <div className="text-xs text-muted-foreground">Client (optionnel)</div>
                      <Input
                        value={goNoGoForm.client}
                        onChange={(e) => setGoNoGoForm((prev) => ({ ...prev, client: e.target.value }))}
                        placeholder="Nom du client"
                      />
                    </div>
                  </div>

                  {decisionError ? <div className="text-sm text-rose-600">{decisionError}</div> : null}

                  <Button onClick={handleGoNoGo} disabled={decisionLoading}>
                    {decisionLoading ? "Calcul..." : "Lancer le Go/No-Go"}
                  </Button>

                  {goNoGoResult ? (
                    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                        <div className="col-span-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Score global</div>
                          <div className="text-2xl font-semibold text-slate-900">{goNoGoResult.risk_score}</div>
                          <div className="text-xs text-slate-500">{goNoGoResult.decision}</div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Sanctions</div>
                          <div className="text-lg font-semibold text-slate-900">
                            {goNoGoResult.risk_breakdown.compliance}
                          </div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Paiement</div>
                          <div className="text-lg font-semibold text-slate-900">
                            {goNoGoResult.risk_breakdown.payment}
                          </div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Logistique</div>
                          <div className="text-lg font-semibold text-slate-900">
                            {goNoGoResult.risk_breakdown.logistics}
                          </div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Documents</div>
                          <div className="text-lg font-semibold text-slate-900">
                            {goNoGoResult.risk_breakdown.documents}
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                          Recommandations immÃ©diates
                        </div>
                        <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-700">
                          {goNoGoResult.recommendations.map((rec) => (
                            <li key={rec}>{rec}</li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                          Checklist export
                        </div>
                        <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-700">
                          {goNoGoResult.checklist.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Message client
                          </div>
                          <Textarea value={goNoGoResult.messages.client} readOnly className="mt-2" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Message interne
                          </div>
                          <Textarea value={goNoGoResult.messages.internal} readOnly className="mt-2" />
                        </div>
                      </div>

                      {goNoGoResult.can_export ? (
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" onClick={handleExportPdf}>
                            <Download className="mr-2 h-4 w-4" />
                            Export PDF
                          </Button>
                          <Button variant="outline" onClick={handleExportCsv}>
                            Export CSV
                          </Button>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                          Export rÃ©servÃ© aux comptes Pro.
                          <Button
                            size="sm"
                            className="ml-2"
                            onClick={async () => {
                              setPlanCtaError(null);
                              try {
                                await startOnlineCheckout();
                              } catch (err: any) {
                                setPlanCtaError(err?.message || "Impossible d'ouvrir le checkout.");
                              }
                            }}
                          >
                            DÃ©bloquer Pro
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {decisionOpen === "payment" ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Pays</div>
                      <Input
                        value={paymentForm.country}
                        onChange={(e) => setPaymentForm((prev) => ({ ...prev, country: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Mode paiement</div>
                      <Input
                        value={paymentForm.payment_method}
                        onChange={(e) => setPaymentForm((prev) => ({ ...prev, payment_method: e.target.value }))}
                        placeholder="Ex: acompte + LC"
                      />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <div className="text-xs text-muted-foreground">Client (optionnel)</div>
                      <Input
                        value={paymentForm.client}
                        onChange={(e) => setPaymentForm((prev) => ({ ...prev, client: e.target.value }))}
                      />
                    </div>
                  </div>
                  <Button
                    onClick={() =>
                      handleDecisionAsk(
                        `Securiser le paiement pour un export vers ${paymentForm.country}. Mode: ${paymentForm.payment_method || "a definir"}. Client: ${paymentForm.client || "non renseigne"}. Donne un plan d'action.`,
                        paymentForm
                      )
                    }
                    disabled={decisionLoading}
                  >
                    {decisionLoading ? "Analyse..." : "Obtenir les recommandations"}
                  </Button>
                </div>
              ) : null}

              {decisionOpen === "pricing" ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Pays</div>
                      <Input
                        value={pricingForm.country}
                        onChange={(e) => setPricingForm((prev) => ({ ...prev, country: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Produit</div>
                      <Input
                        value={pricingForm.product_desc}
                        onChange={(e) => setPricingForm((prev) => ({ ...prev, product_desc: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Incoterm</div>
                      <Input
                        value={pricingForm.incoterm}
                        onChange={(e) => setPricingForm((prev) => ({ ...prev, incoterm: e.target.value }))}
                        placeholder="Ex: DAP"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Valeur</div>
                      <Input
                        value={pricingForm.value_amount}
                        onChange={(e) => setPricingForm((prev) => ({ ...prev, value_amount: e.target.value }))}
                        placeholder="Ex: 25000"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Devise</div>
                      <Input
                        value={pricingForm.currency}
                        onChange={(e) => setPricingForm((prev) => ({ ...prev, currency: e.target.value }))}
                      />
                    </div>
                  </div>
                  <Button
                    onClick={() =>
                      handleDecisionAsk(
                        `Calculer un prix export vers ${pricingForm.country} pour ${pricingForm.product_desc || "un produit"}, incoterm ${pricingForm.incoterm || "a definir"}, valeur ${pricingForm.value_amount || "n/a"} ${pricingForm.currency || ""}.`,
                        pricingForm
                      )
                    }
                    disabled={decisionLoading}
                  >
                    {decisionLoading ? "Analyse..." : "Generer les etapes prix"}
                  </Button>
                </div>
              ) : null}

              {decisionOpen === "documents" ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Pays</div>
                      <Input
                        value={documentsForm.country}
                        onChange={(e) => setDocumentsForm((prev) => ({ ...prev, country: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Produit</div>
                      <Input
                        value={documentsForm.product_desc}
                        onChange={(e) => setDocumentsForm((prev) => ({ ...prev, product_desc: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Incoterm</div>
                      <Input
                        value={documentsForm.incoterm}
                        onChange={(e) => setDocumentsForm((prev) => ({ ...prev, incoterm: e.target.value }))}
                      />
                    </div>
                  </div>
                  <Button
                    onClick={() =>
                      handleDecisionAsk(
                        `Quels documents exporter pour ${documentsForm.product_desc || "un produit"} vers ${documentsForm.country} avec incoterm ${documentsForm.incoterm || "a definir"} ?`,
                        documentsForm
                      )
                    }
                    disabled={decisionLoading}
                  >
                    {decisionLoading ? "Analyse..." : "Obtenir la checklist"}
                  </Button>
                </div>
              ) : null}

              {decisionAnswer ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 whitespace-pre-line">
                  {decisionAnswer}
                </div>
              ) : null}

              {decisionActions.length ? (
                <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                  <div className="font-semibold uppercase tracking-[0.2em] text-[10px] text-blue-700">Actions</div>
                  <ul className="mt-2 list-disc space-y-1 pl-4">
                    {decisionActions.map((action) => (
                      <li key={action}>{action}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {decisionError ? <div className="text-sm text-rose-600">{decisionError}</div> : null}
            </div>
            <DrawerFooter className="mt-2">
              <Button variant="outline" onClick={() => setDecisionOpen(null)}>
                Fermer
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Assistant export</CardTitle>
              <CardDescription>Posez une question prÃ©cise, lâ€™assistant rÃ©pond.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Input
                  value={assistantQuestion}
                  onChange={(e) => setAssistantQuestion(e.target.value)}
                  placeholder="Ex: Comment trouver des distributeurs en Allemagne ?"
                />
                <Button type="button" className="w-full" onClick={handleAssistantAsk} disabled={assistantLoading}>
                  {assistantLoading ? "Analyse..." : "Poser la question"}
                </Button>
                {assistantError ? <div className="text-xs text-rose-600">{assistantError}</div> : null}
              </div>

              <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                {assistantExamples.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => void handleAssistantAsk(example)}
                    className="rounded-full border border-slate-200 px-3 py-1 hover:bg-slate-50"
                  >
                    {example}
                  </button>
                ))}
              </div>

              {assistantAnswer ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 whitespace-pre-line">
                  {assistantAnswer}
                </div>
              ) : null}

              {assistantActions.length ? (
                <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                  <div className="font-semibold uppercase tracking-[0.2em] text-[10px] text-blue-700">Actions</div>
                  <ul className="mt-2 list-disc space-y-1 pl-4">
                    {assistantActions.map((action) => (
                      <li key={action}>{action}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Playbook prospection
                </div>
                <Tabs defaultValue="clients" className="mt-3">
                  <TabsList className="flex flex-wrap justify-start gap-1 bg-slate-100">
                    <TabsTrigger value="clients">Clients</TabsTrigger>
                    <TabsTrigger value="prospection">Prospection</TabsTrigger>
                    <TabsTrigger value="vente">Vente</TabsTrigger>
                  </TabsList>
                  <TabsContent value="clients">
                    <ul className="list-disc space-y-1 pl-4 text-sm text-slate-700">
                      <li>LinkedIn + Sales Navigator: ciblage par secteur, taille, pays.</li>
                      <li>Annuaires export: Kompass, Europages, CCI, Business France.</li>
                      <li>Salons internationaux et fÃ©dÃ©rations professionnelles.</li>
                      <li>Recherche par codes HS pour identifier importateurs et distributeurs.</li>
                      <li>Alertes appels dâ€™offres et plateformes B2B.</li>
                    </ul>
                  </TabsContent>
                  <TabsContent value="prospection">
                    <ul className="list-disc space-y-1 pl-4 text-sm text-slate-700">
                      <li>DÃ©finir lâ€™ICP: secteur, taille, zones, pain points.</li>
                      <li>SÃ©quence 3 relances: J+2, J+7, J+14 avec valeur ajoutÃ©e.</li>
                      <li>Offrir un diagnostic rapide (incoterm, paiement, risques).</li>
                      <li>Structurer la valeur: problÃ¨me + solution + preuve + prochain pas.</li>
                    </ul>
                  </TabsContent>
                  <TabsContent value="vente">
                    <ul className="list-disc space-y-1 pl-4 text-sm text-slate-700">
                      <li>SPIN: Situation, ProblÃ¨me, Implication, Besoin-payoff.</li>
                      <li>SONCAS: sÃ©curitÃ©, orgueil, nouveautÃ©, confort, argent, simplicitÃ©.</li>
                      <li>Traiter les objections: prix, dÃ©lai, risque, conformitÃ©.</li>
                      <li>ClÃ´turer avec un plan dâ€™action et une date prÃ©cise.</li>
                    </ul>
                  </TabsContent>
                </Tabs>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Objectifs & plan</CardTitle>
              <CardDescription>
                Chargez un fichier avec vos objectifs. On Ã©tablira un plan et un suivi pour les atteindre. Tous les
                autres outils contribueront Ã  ces objectifs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleObjectiveUpload(file);
                }}
                className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-md file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-800"
              />

              {objectiveUploading ? <div className="text-xs text-slate-500">Upload en cours...</div> : null}
              {objectiveError ? <div className="text-xs text-rose-600">{objectiveError}</div> : null}

              {objectiveName ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <div className="font-medium">{objectiveName}</div>
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  Aucun objectif chargÃ© pour le moment.
                </div>
              )}

              {objectiveCsv ? (
                <div className="overflow-auto rounded-lg border border-slate-200">
                  <table className="min-w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        {objectiveCsv.headers.map((h) => (
                          <th key={h} className="px-2 py-2 text-left font-medium">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {objectiveCsv.rows.slice(0, 5).map((row, idx) => (
                        <tr key={`${idx}-row`} className="border-t">
                          {row.map((cell, cIdx) => (
                            <td key={`${idx}-${cIdx}`} className="px-2 py-2 text-slate-700">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              <Button type="button" onClick={handleGeneratePlan} disabled={!objectiveCsv}>
                GÃ©nÃ©rer mon plan
              </Button>

              {objectivePlan ? (
                <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-700">Plan v1</div>
                  <ul className="mt-2 list-disc space-y-1 pl-4">
                    {objectivePlan.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>

        {/* Carte + panneaux lateraux */}
        <section className="space-y-4">
          <div className="relative w-full">
            <PanoramicControlTowerMap
              selectedCountry={selectedWatchCountry}
              selectedLabel={selectedCountryLabel}
              countryStats={countryStats}
              onCountrySelect={handleCountrySelect}
              onReset={handleCountryReset}
            />

            <Card className="absolute left-4 top-4 z-10 w-[min(280px,90vw)] bg-white/95 backdrop-blur pointer-events-auto">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Aspect general</CardTitle>
                <CardDescription>Contexte pays et veille</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Pays</div>
                    <div className="text-base font-semibold text-slate-900">{selectedCountryLabel}</div>
                  </div>
                  <div className="text-2xl">{countryFlag(selectedWatchCountry)}</div>
                </div>

                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex items-center justify-between">
                    <span>Code ISO</span>
                    <span className="font-semibold text-slate-900">{selectedWatchCountry}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Zone</span>
                    <span className="font-semibold text-slate-900">{selectedProfile.region}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Devise locale</span>
                    <span className="font-semibold text-slate-900">{selectedProfile.currency}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Sources veille</span>
                    <span className="font-semibold text-slate-900">{rssSources.length}</span>
                  </div>
                </div>

                <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                  {selectedProfile.note}
                </div>

                {activeNews ? (
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Actu a la une</div>
                    <div className="mt-1 line-clamp-2 font-medium">{activeNews.title}</div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">Aucune actu recente pour le moment.</div>
                )}
              </CardContent>
            </Card>

            <Card className="absolute right-4 bottom-4 z-10 w-[min(280px,90vw)] bg-white/95 backdrop-blur pointer-events-auto">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Aspect client</CardTitle>
                <CardDescription>Vos ventes sur ce pays</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {selectedAgg ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Chiffre d&apos;affaires</span>
                      <span className="text-base font-semibold text-slate-900">
                        {formatMoney(selectedAgg.revenue, selectedCurrency)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Couts</span>
                      <span className="text-base font-semibold text-slate-900">
                        {formatMoney(selectedAgg.costs, selectedCurrency)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Marge</span>
                      <span className="text-base font-semibold text-emerald-600">
                        {formatMoney(selectedAgg.margin, selectedCurrency)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Marge %</span>
                      <span className="text-base font-semibold text-slate-900">
                        {formatPercent(selectedAgg.revenue ? selectedAgg.margin / selectedAgg.revenue : null)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Quantites</span>
                      <span className="text-base font-semibold text-slate-900">
                        {selectedAgg.quantity ? selectedAgg.quantity.toLocaleString("fr-FR") : "0"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Lignes</span>
                      <span className="text-base font-semibold text-slate-900">
                        {selectedAgg.lines ? selectedAgg.lines.toLocaleString("fr-FR") : "0"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Derniere facture</span>
                      <span className="text-base font-semibold text-slate-900">{formatDateShort(lastInvoiceAt)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    Vous n&apos;avez pas de vente sur ce secteur.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          {/* âœ… Veille RSS (au clic sur pays) */}
          <Card ref={rssPanelRef}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Rss className="h-4 w-4 text-blue-600" />
                  Veille RSS â€“ {selectedCountryLabel} ({selectedWatchCountry})
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => void loadRssForCountry(selectedWatchCountry, true)}
                >
                  <RotateCcw className="h-4 w-4" />
                  RafraÃ®chir
                </Button>
              </CardTitle>
              <CardDescription>
                Sources pays + UE/OMC (fallback). Si certains flux bloquent (CORS), le proxy est utilisÃ©.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeNews ? (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-600">
                    Actu du pays
                  </div>
                  <div className="mt-1 font-semibold">{activeNews.title}</div>
                  <div className="mt-1 text-xs text-blue-700">
                    {activeNews.sourceName} â€¢ {formatDate(activeNews.publishedAt)}
                  </div>
                  <div className="mt-2">
                    <Button asChild size="sm" variant="outline" className="border-blue-200 text-blue-700">
                      <a href={activeNews.link} target="_blank" rel="noreferrer">
                        Ouvrir l&apos;actu
                      </a>
                    </Button>
                  </div>
                </div>
              ) : null}
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
                  Chargement des flux RSSâ€¦
                </div>
              ) : null}

              {rssError ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {rssError}
                  <div className="mt-2 text-xs text-amber-800">
                    Astuce : si un pays nâ€™a pas encore de source dÃ©diÃ©e, ajoute un flux national dans ta config plus tard.
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
                            <span>â€¢</span>
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
                    <li className="p-4 text-sm text-slate-500">Aucun item Ã  afficher pour le moment.</li>
                  ) : null}
                </ul>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">SynthÃ¨se</CardTitle>
                <CardDescription>Ventes et marges (filtres actifs)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Chiffre d&apos;affaires</span>
                  <span className="text-lg font-semibold text-slate-900">{formatMoney(totals.revenue, displayCurrency)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">CoÃ»ts totaux</span>
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
                <CardDescription>Affiche un sous-ensemble cohÃ©rent (devise incluse).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select
                  value={destinationFilter}
                  onValueChange={(v) => {
                    if (v === "ALL") {
                      handleCountryReset();
                      return;
                    }
                    handleCountrySelect(v);
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

                <Input value={hsQuery} onChange={(e) => setHsQuery(e.target.value)} placeholder="Filtrer par HS ou libellÃ©" />

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
                  <div className="text-xs text-muted-foreground">Aucun HS prÃ©fÃ©rÃ© dÃ©tectÃ© (profil non configurÃ©).</div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Techniques de vente</CardTitle>
              <CardDescription>Reponses rapides pour convertir.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1 pl-4 text-sm text-slate-700">
                <li>Qualifier le besoin avec des questions ouvertes et un diagnostic court.</li>
                <li>Formuler la valeur en 1 phrase: probleme, solution, benefice mesurable.</li>
                <li>Proposer une preuve: cas client, chiffres, delais, resultats.</li>
                <li>Structurer l&apos;offre: options claires, conditions, prochain pas.</li>
                <li>Traiter les objections: prix, delai, risque, conformite.</li>
                <li>Relancer avec un plan d&apos;action et une date precise.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Prospection & recherche clients</CardTitle>
              <CardDescription>Meilleures facons de trouver des clients.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1 pl-4 text-sm text-slate-700">
                <li>LinkedIn + Sales Navigator: ciblage par secteur, taille, pays.</li>
                <li>Annuaires export: Kompass, Europages, CCI, Business France.</li>
                <li>Salons internationaux et federations professionnelles.</li>
                <li>Recherche par codes HS pour identifier importateurs et distributeurs.</li>
                <li>Alertes appels d&apos;offres et plateformes B2B.</li>
                <li>Partenariats locaux: agents commerciaux et reps pays.</li>
              </ul>
            </CardContent>
          </Card>
        </section>

        <section ref={resultsRef} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                Import CSV
              </CardTitle>
              <CardDescription>
                HS code obligatoire. Prix (unit_price ou total_price) + quantitÃ© requis. Les frais peuvent Ãªtre fournis
                ou complÃ©tÃ©s par les valeurs manuelles.
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
                  Plusieurs devises dÃ©tectÃ©es ({currencyList.join(", ")}). Pour Ã©viter de mÃ©langer sans conversion,
                  un filtre devise est appliquÃ©.
                </div>
              ) : null}

              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                SÃ©parateurs acceptÃ©s : <b>;</b> ou <b>,</b>. DÃ©cimales : virgule ou point.
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={scrollToResults}>
                  Voir les resultats
                </Button>
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
                UtilisÃ©es si le CSV ne fournit pas les frais (transport, packaging, dossier, autres).
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Devise par dÃ©faut</div>
                <Input value={defaults.currency} onChange={setDefaultsField("currency")} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">CoÃ»t unitaire produit</div>
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
                Les valeurs sont appliquÃ©es par ligne si la colonne correspondante est vide.
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Ventes par destination</CardTitle>
              <CardDescription>CA, coÃ»ts et marges par pays (devise filtrÃ©e si nÃ©cessaire).</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Destination</th>
                      <th className="px-3 py-2 text-right">CA</th>
                      <th className="px-3 py-2 text-right">CoÃ»ts</th>
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
                          Aucune donnÃ©e. Importe un CSV ou ajuste les filtres.
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
                      <th className="px-3 py-2 text-right">CoÃ»ts</th>
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
                          Aucune donnÃ©e. Importe un CSV ou ajuste les filtres.
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
            <CardTitle>DÃ©tail par destination + produit</CardTitle>
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
                    <th className="px-3 py-2 text-right">CoÃ»ts</th>
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
                        Aucune donnÃ©e. Importe un CSV ou ajuste les filtres.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {byDestinationProduct.length > 400 ? (
              <div className="mt-2 text-xs text-muted-foreground">
                Affichage limitÃ© Ã  400 lignes. Utilise les filtres pour rÃ©duire la liste.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}


