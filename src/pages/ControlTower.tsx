import * as React from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileSpreadsheet, MapPin, RotateCcw, Upload } from "lucide-react";
import worldMap from "@/assets/world-map.svg";
import { useCompanyProfile } from "@/hooks/useCompanyProfile";
import { TERRITORY_PCT } from "@/domain/geo/territoryPct";

const CSV_TEMPLATE = [
  "invoice_number;invoice_date;destination_country;hs_code;product_label;quantity;unit_price;currency;unit_cost;transport_cost;packaging_cost;dossier_fee;other_costs",
  "INV-2025-0001;2025-01-15;FR;90211010;Orthese genou;120;89;EUR;35;180;40;25;10",
  "INV-2025-0002;2025-01-18;DE;90211010;Orthese genou;80;92;EUR;35;120;25;15;8",
].join("\n");

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
  US: { name: "Etats-Unis", lat: 37.0902, lon: -95.7129 },
  CA: { name: "Canada", lat: 56.1304, lon: -106.3468 },
  MX: { name: "Mexique", lat: 23.6345, lon: -102.5528 },
  BR: { name: "Bresil", lat: -14.235, lon: -51.9253 },
  CN: { name: "Chine", lat: 35.8617, lon: 104.1954 },
  JP: { name: "Japon", lat: 36.2048, lon: 138.2529 },
  KR: { name: "Coree du Sud", lat: 35.9078, lon: 127.7669 },
  IN: { name: "Inde", lat: 20.5937, lon: 78.9629 },
  AE: { name: "Emirats arabes unis", lat: 23.4241, lon: 53.8478 },
  SA: { name: "Arabie saoudite", lat: 23.8859, lon: 45.0792 },
  TR: { name: "Turquie", lat: 38.9637, lon: 35.2433 },
  MA: { name: "Maroc", lat: 31.7917, lon: -7.0926 },
  DZ: { name: "Algerie", lat: 28.0339, lon: 1.6596 },
  TN: { name: "Tunisie", lat: 33.8869, lon: 9.5375 },
  ZA: { name: "Afrique du Sud", lat: -30.5595, lon: 22.9375 },
  AU: { name: "Australie", lat: -25.2744, lon: 133.7751 },
};

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
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(value);
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

function projectLatLon(lat: number, lon: number) {
  const x = ((lon + 180) / 360) * (MAP_WIDTH - MAP_INSET.left - MAP_INSET.right) + MAP_INSET.left;
  const y = ((90 - lat) / 180) * (MAP_HEIGHT - MAP_INSET.top - MAP_INSET.bottom) + MAP_INSET.top;
  return { x, y };
}

function projectOnMap(code: string, lat: number, lon: number) {
  const key = code === "FR" ? "HUB_FR" : code;
  const pct = (TERRITORY_PCT as Record<string, { x: number; y: number }>)[key];
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
  const [hsQuery, setHsQuery] = React.useState("");
  const [preferredHs, setPreferredHs] = React.useState<string[]>([]);
  const [focusPreferred, setFocusPreferred] = React.useState(false);

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
        warnings.push(`Ligne ${lineNumber} : quantite invalide.`);
        return;
      }

      const unitPrice = parseNumber(getValue(cells, idx.unitPrice));
      const totalPrice = parseNumber(getValue(cells, idx.totalPrice));
      const totalSales = totalPrice ?? (unitPrice !== null ? unitPrice * quantity : null);

      if (totalSales === null || !Number.isFinite(totalSales)) {
        warnings.push(`Ligne ${lineNumber} : prix de vente manquant.`);
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
  const displayCurrency = currencyList[0] || "EUR";

  const filteredRows = React.useMemo(() => {
    let base = rowsAll;

    if (destinationFilter !== "ALL") {
      base = base.filter((r) => r.destination === destinationFilter);
    }

    if (focusPreferred && preferredHs.length) {
      const set = new Set(preferredHs);
      base = base.filter((r) => set.has(r.hs));
    }

    const q = hsQuery.trim().toLowerCase();
    if (q) {
      base = base.filter((r) =>
        `${r.hs} ${(r.productLabel || "")}`.toLowerCase().includes(q)
      );
    }

    return base;
  }, [rowsAll, destinationFilter, focusPreferred, preferredHs, hsQuery]);

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
  }, [rowsAll]);

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
      const pct = (TERRITORY_PCT as Record<string, { x: number; y: number }>)[
        entry.code === "FR" ? "HUB_FR" : entry.code
      ];
      if (!meta && !pct) {
        missing += 1;
        return;
      }
      const point = pct
        ? { x: (pct.x / 100) * MAP_WIDTH, y: (pct.y / 100) * MAP_HEIGHT }
        : projectOnMap(entry.code, meta.lat, meta.lon);
      nodes.push({ code: entry.code, name: entry.name, x: point.x, y: point.y, revenue: entry.revenue });
    });

    const hubMeta = COUNTRY_COORDS.FR;
    if (!nodes.some((n) => n.code === "FR") && hubMeta) {
      const hubPoint = projectOnMap("FR", hubMeta.lat, hubMeta.lon);
      nodes.push({ code: "FR", name: territoryLabel("FR"), x: hubPoint.x, y: hubPoint.y, revenue: 0 });
    }

    return { nodes, missing };
  }, [destinationAggAll]);

  const hubNode = mapNodes.nodes.find((n) => n.code === "FR") || mapNodes.nodes[0];
  const maxRevenue = Math.max(0, ...mapNodes.nodes.map((n) => n.revenue || 0));

  const setDefaultsField = (key: keyof typeof defaults) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    setDefaults((prev) => ({
      ...prev,
      [key]: key === "currency" ? raw.toUpperCase() : parseNumber(raw) ?? 0,
    }));
  };

  return (
    <AppLayout contentClassName="md:p-6">
      <div className="space-y-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-blue-600">Tour de controle</p>
            <h1 className="text-3xl font-bold text-slate-900">Pilotage ventes & marges</h1>
            <p className="text-sm text-slate-600">
              Tableau de bord connecte pour {companyName} : suivi par HS code et destination.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              className="gap-2"
              onClick={() => downloadTextFile("template-ventes-incoterms.csv", CSV_TEMPLATE)}
            >
              <Download className="h-4 w-4" />
              Template CSV
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                setCsvState(null);
                setCsvName(null);
                setCsvError(null);
              }}
            >
              <RotateCcw className="h-4 w-4" />
              Vider les donnees
            </Button>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4 text-blue-600" />
                Flux par destination
              </CardTitle>
              <CardDescription>Survoler un point pour voir les volumes. Cliquer filtre la page.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative h-[420px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-900">
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

                  {hubNode
                    ? mapNodes.nodes
                        .filter((n) => n.code !== hubNode.code && n.revenue > 0)
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
                        })
                    : null}

                  {mapNodes.nodes.map((node) => {
                    const radius = clamp(6 + (node.revenue / Math.max(1, maxRevenue)) * 10, 6, 14);
                    const isSelected = destinationFilter === node.code;

                    return (
                      <g key={node.code}>
                        <circle cx={node.x} cy={node.y} r={radius + 6} fill="#0f172a" opacity={0.35} />
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r={radius}
                          fill={isSelected ? "#38bdf8" : "#22d3ee"}
                          opacity={node.revenue > 0 ? 0.9 : 0.35}
                          className="cursor-pointer"
                          onMouseEnter={(evt) => {
                            setHovered({
                              code: node.code,
                              name: node.name,
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
                          onClick={() => setDestinationFilter(node.code)}
                          onDoubleClick={() => setDestinationFilter("ALL")}
                        />
                        {node.code === "FR" ? (
                          <text x={node.x + 12} y={node.y + 4} className="text-xs font-semibold fill-cyan-100">
                            Hub FR
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

          <div className="space-y-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Synthese</CardTitle>
                <CardDescription>Ventes et marges (filtre actif)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Chiffre d'affaires</span>
                  <span className="text-lg font-semibold text-slate-900">
                    {formatMoney(totals.revenue, displayCurrency)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Couts totals</span>
                  <span className="text-lg font-semibold text-slate-900">
                    {formatMoney(totals.costs, displayCurrency)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Marge</span>
                  <span className="text-lg font-semibold text-emerald-600">
                    {formatMoney(totals.margin, displayCurrency)}
                  </span>
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
                <CardDescription>Affiche un sous-ensemble.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select value={destinationFilter} onValueChange={(v) => setDestinationFilter(v)}>
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

                <Input
                  value={hsQuery}
                  onChange={(e) => setHsQuery(e.target.value)}
                  placeholder="Filtrer par HS ou libelle"
                />

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
                  <div className="text-xs text-muted-foreground">
                    Aucun HS prefere detecte (profil non configure).
                  </div>
                )}
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
                HS code obligatoire. Prix de vente + quantite sont requis. Les frais peuvent etre remplis ou
                completes par les valeurs manuelles ci-dessous.
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
                  <span>{csvName}</span>
                  <Badge variant="outline">{rowsAll.length} lignes valides</Badge>
                </div>
              ) : null}

              {csvError ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {csvError}
                </div>
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
                  {computed.warnings.length > 5 ? (
                    <div>+{computed.warnings.length - 5} autres alertes</div>
                  ) : null}
                </div>
              ) : null}

              {currencyList.length > 1 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Plusieurs devises detectees ({currencyList.join(", ")}). Les totaux sont affiches en {displayCurrency}.
                </div>
              ) : null}

              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Separateurs acceptes : <b>;</b> ou <b>,</b>. Les valeurs decimales peuvent utiliser la virgule.
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
                Utilise ces montants si le CSV ne fournit pas les frais (transport, packaging, dossier, autres).
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Devise par defaut</div>
                <Input value={defaults.currency} onChange={setDefaultsField("currency")} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Cout unitaire produit</div>
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
                Les valeurs sont appliquees par ligne si la colonne correspondante est vide.
              </div>
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-blue-600" />
              Template CSV requis
            </CardTitle>
            <CardDescription>
              HS code obligatoire. Ajoute les prix de vente et les informations de facture standards.
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
              <CardDescription>CA, couts et marges par pays.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Destination</th>
                      <th className="px-3 py-2 text-right">CA</th>
                      <th className="px-3 py-2 text-right">Couts</th>
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
                        <td className="px-3 py-2 text-right text-emerald-700">
                          {formatMoney(row.margin, displayCurrency)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatPercent(row.revenue ? row.margin / row.revenue : null)}
                        </td>
                      </tr>
                    ))}
                    {!destinationAgg.length ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-500">
                          Aucune donnee. Importe un CSV ou ajuste les filtres.
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
                      <th className="px-3 py-2 text-right">Couts</th>
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
                        <td className="px-3 py-2 text-right text-emerald-700">
                          {formatMoney(row.margin, displayCurrency)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatPercent(row.revenue ? row.margin / row.revenue : null)}
                        </td>
                      </tr>
                    ))}
                    {!productAgg.length ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-500">
                          Aucune donnee. Importe un CSV ou ajuste les filtres.
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
            <CardTitle>Detail par destination + produit</CardTitle>
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
                    <th className="px-3 py-2 text-right">Couts</th>
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
                      <td className="px-3 py-2 text-right text-emerald-700">
                        {formatMoney(row.margin, displayCurrency)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatPercent(row.revenue ? row.margin / row.revenue : null)}
                      </td>
                    </tr>
                  ))}
                  {!byDestinationProduct.length ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-500">
                        Aucune donnee. Importe un CSV ou ajuste les filtres.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {byDestinationProduct.length > 400 ? (
              <div className="mt-2 text-xs text-muted-foreground">
                Affichage limite a 400 lignes. Utilise les filtres pour reduire la liste.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
