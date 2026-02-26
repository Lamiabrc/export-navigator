import * as React from "react";
import { FileSpreadsheet, Plus, RefreshCw, UploadCloud } from "lucide-react";

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
  const [tabularData, setTabularData] = React.useState<TabularData>({ headers: [], rows: [] });
  const [mapping, setMapping] = React.useState<ColumnMapping>(EMPTY_MAPPING);
  const [importMode, setImportMode] = React.useState<"merge" | "replace">("merge");
  const [rows, setRows] = React.useState<ControlTowerRow[]>([]);
  const [manualRow, setManualRow] = React.useState<ManualRowInput>(EMPTY_MANUAL_ROW);
  const [selectedCountry, setSelectedCountry] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [errorText, setErrorText] = React.useState("");

  const hasMappedRequiredFields = Boolean(mapping.country && mapping.product && mapping.qty && mapping.amount);

  const rowsForDashboard = React.useMemo(() => {
    if (!selectedCountry) return rows;
    return rows.filter((row) => row.country === selectedCountry);
  }, [rows, selectedCountry]);

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
    if (selectedCountry && countryStats[selectedCountry]) {
      return countryStats[selectedCountry];
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

  React.useEffect(() => {
    if (!selectedCountry) return;
    const stillPresent = rows.some((row) => row.country === selectedCountry);
    if (!stillPresent) {
      setSelectedCountry(null);
    }
  }, [rows, selectedCountry]);

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

    if (!list.length) {
      list.push(
        isEn
          ? "Import CSV/XLSX data first to generate optimization recommendations."
          : "Importez d'abord des donnees CSV/XLSX pour obtenir des recommandations d'optimisation."
      );
    }

    return list.slice(0, 4);
  }, [channelPerformance, isEn, profitabilityByCountry]);

  const handleFile = async (file: File) => {
    setLoading(true);
    setErrorText("");

    try {
      const parsed = await readTabularFile(file);
      if (!parsed.headers.length || !parsed.rows.length) {
        throw new Error(isEn ? "Empty file" : "Fichier vide");
      }

      setTabularData(parsed);
      setFileName(file.name);
      setMapping(EMPTY_MAPPING);
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
  };

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
              ? "Upload CSV/XLSX, map columns with dropdowns, then monitor profitability and channel performance."
              : "Importez un CSV/XLSX, mappez les colonnes avec des dropdowns, puis suivez rentabilite et performance des canaux."}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{isEn ? "1) Upload dataset" : "1) Importer le dataset"}</CardTitle>
            <CardDescription>
              {isEn
                ? "Supported formats: CSV, XLSX, XLS."
                : "Formats supportes: CSV, XLSX, XLS."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-dashed p-5">
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
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{tabularData.headers.length} {isEn ? "columns" : "colonnes"}</Badge>
              <Badge variant="outline">{tabularData.rows.length} {isEn ? "rows" : "lignes"}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{isEn ? "2) Column mapping (required)" : "2) Mapping colonnes (obligatoire)"}</CardTitle>
            <CardDescription>
              {isEn
                ? "Each business field must be mapped through a dropdown."
                : "Chaque champ metier doit etre mappe via un menu deroulant."}
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
            <CardTitle>{isEn ? "3) Manual row" : "3) Ajout manuel"}</CardTitle>
            <CardDescription>
              {isEn
                ? "Add missing sales operations with controlled dropdowns."
                : "Ajoutez les operations manquantes avec menus deroulants controles."}
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

        <Card>
          <CardHeader>
            <CardTitle>{isEn ? "Map & RSS watch" : "Carte & veille RSS"}</CardTitle>
            <CardDescription>
              {isEn
                ? "Select a country on the map to filter dashboard metrics. RSS feed remains available below."
                : "Selectionnez un pays sur la carte pour filtrer les indicateurs du dashboard. Les flux RSS restent disponibles ci-dessous."}
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
            <RssFooter />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{isEn ? "Dashboard" : "Tableau de bord"}</CardTitle>
            <CardDescription>
              {selectedCountry
                ? isEn
                  ? `Filtered on ${getCountryLabel(selectedCountry, "en")}.`
                  : `Filtre actif sur ${getCountryLabel(selectedCountry, "fr")}.`
                : isEn
                ? "Top products by country, profitable destinations and channel performance."
                : "Top produits par pays, destinations rentables et performance canaux."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">{isEn ? "Rows" : "Lignes"}</div>
                <div className="text-2xl font-semibold">{rowsForDashboard.length}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">{isEn ? "Countries" : "Pays"}</div>
                <div className="text-2xl font-semibold">{new Set(rowsForDashboard.map((row) => row.country)).size}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">{isEn ? "Channels" : "Canaux"}</div>
                <div className="text-2xl font-semibold">{new Set(rowsForDashboard.map((row) => row.channel)).size}</div>
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
              <p className="text-sm font-semibold">{isEn ? "Optimization suggestions" : "Pistes d'optimisation"}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {suggestions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
