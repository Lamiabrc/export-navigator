import { BreakdownFilters, CostLine, ExportBreakdown, OmRateRow, SalesLine, VatRateRow } from "./types";
import { coerceNumber, matchesDateRange, normalizeText, summarizeWarning } from "./validators";

type ComputeParams = {
  salesLines: SalesLine[];
  costLines: CostLine[];
  vatRates?: VatRateRow[];
  omRates?: OmRateRow[];
  filters?: BreakdownFilters;
};

function filterSales(lines: SalesLine[], filters?: BreakdownFilters) {
  if (!filters) return lines;
  return lines.filter((line) => {
    if (!matchesDateRange(line.date, filters.startDate, filters.endDate)) return false;
    if (filters.zone && normalizeText(line.market_zone).toLowerCase() !== filters.zone.toLowerCase()) return false;
    if (filters.destination) {
      const dest = normalizeText(line.destination || line.market_zone).toLowerCase();
      if (!dest.includes(filters.destination.toLowerCase())) return false;
    }
    if (filters.incoterm && normalizeText(line.incoterm).toLowerCase() !== filters.incoterm.toLowerCase()) return false;
    if (filters.clientId && normalizeText(line.client_id).toLowerCase() !== filters.clientId.toLowerCase()) return false;
    if (filters.productId && normalizeText(line.product_id).toLowerCase() !== filters.productId.toLowerCase()) return false;
    return true;
  });
}

function filterCosts(lines: CostLine[], filters?: BreakdownFilters) {
  if (!filters) return lines;
  return lines.filter((line) => {
    if (!matchesDateRange(line.date, filters.startDate, filters.endDate)) return false;
    if (filters.zone && normalizeText(line.market_zone).toLowerCase() !== filters.zone.toLowerCase()) return false;
    if (filters.destination) {
      const dest = normalizeText(line.destination || line.market_zone).toLowerCase();
      if (!dest.includes(filters.destination.toLowerCase())) return false;
    }
    if (filters.incoterm && normalizeText(line.incoterm).toLowerCase() !== filters.incoterm.toLowerCase()) return false;
    if (filters.clientId && normalizeText(line.client_id).toLowerCase() !== filters.clientId.toLowerCase()) return false;
    if (filters.productId && normalizeText(line.product_id).toLowerCase() !== filters.productId.toLowerCase()) return false;
    return true;
  });
}

function pickRate<T extends { territory_code: any; start_date?: any; end_date?: any; rate_percent?: any; om_rate?: any; omr_rate?: any }>(
  rows: T[],
  filters?: BreakdownFilters,
) {
  if (!rows.length) return undefined;
  const territory = normalizeText(filters?.destination || filters?.zone);
  if (!territory) return rows[0];

  const now = Date.now();
  return (
    rows.find((row) => {
      const matchesTerritory = normalizeText(row.territory_code).toLowerCase().includes(territory.toLowerCase());
      if (!matchesTerritory) return false;

      const startOk = !row.start_date || Date.parse(String(row.start_date)) <= now;
      const endOk = !row.end_date || Date.parse(String(row.end_date)) >= now;
      return startOk && endOk;
    }) || rows[0]
  );
}

function upsertMetric(container: Record<string, any>, key: string) {
  if (!container[key]) {
    container[key] = { caHt: 0, qty: 0, costs: 0, vat: 0, om: 0, margin: 0 };
  }
  return container[key];
}

export function computeExportBreakdown(params: ComputeParams): ExportBreakdown {
  const { salesLines, costLines, vatRates = [], omRates = [], filters } = params;
  const warnings: string[] = [];

  const filteredSales = filterSales(salesLines || [], filters);
  const filteredCosts = filterCosts(costLines || [], filters);

  const totals = filteredSales.reduce(
    (acc, line) => {
      const qty = coerceNumber(line.qty);
      const net = coerceNumber(line.net_sales_ht);
      const unit = coerceNumber(line.unit_price_ht);
      const inferredNet = net || qty * unit;

      acc.qty += qty;
      acc.caHt += inferredNet;
      return acc;
    },
    { caHt: 0, qty: 0 },
  );

  const totalCosts = filteredCosts.reduce((acc, line) => acc + coerceNumber(line.amount), 0);

  const vatRateRow = pickRate(vatRates, filters);
  const vatEstimate = vatRateRow ? (totals.caHt * coerceNumber((vatRateRow as any).rate_percent)) / 100 : 0;
  if (!vatRateRow) warnings.push(summarizeWarning("TVA estimée à 0%", "aucun taux trouvé dans vat_rates"));

  const omRateRow = pickRate(omRates, filters);
  const omBase = totals.caHt;
  const omEstimate = omRateRow
    ? (omBase * coerceNumber((omRateRow as any).om_rate)) / 100 + (omBase * coerceNumber((omRateRow as any).omr_rate)) / 100
    : 0;
  if (!omRateRow) warnings.push(summarizeWarning("OM estimé à 0%", "aucune règle om_rates appliquée"));

  const margin = totals.caHt - totalCosts - vatEstimate - omEstimate;
  const marginRate = totals.caHt > 0 ? (margin / totals.caHt) * 100 : 0;
  const avgPrice = totals.qty > 0 ? totals.caHt / totals.qty : 0;

  const byZone: Record<string, any> = {};
  const byDestination: Record<string, any> = {};
  const byIncoterm: Record<string, any> = {};

  filteredSales.forEach((line) => {
    const zoneKey = normalizeText(line.market_zone) || "NA";
    const destKey = normalizeText(line.destination) || zoneKey || "NA";
    const incotermKey = normalizeText(line.incoterm) || "NA";

    const qty = coerceNumber(line.qty);
    const net = coerceNumber(line.net_sales_ht) || qty * coerceNumber(line.unit_price_ht);

    const zoneMetric = upsertMetric(byZone, zoneKey);
    zoneMetric.caHt += net;
    zoneMetric.qty += qty;

    const destMetric = upsertMetric(byDestination, destKey);
    destMetric.caHt += net;
    destMetric.qty += qty;

    const incMetric = upsertMetric(byIncoterm, incotermKey);
    incMetric.caHt += net;
    incMetric.qty += qty;
  });

  filteredCosts.forEach((line) => {
    const zoneKey = normalizeText(line.market_zone) || "NA";
    const destKey = normalizeText(line.destination) || zoneKey || "NA";
    const incotermKey = normalizeText(line.incoterm) || "NA";
    const amount = coerceNumber(line.amount);

    upsertMetric(byZone, zoneKey).costs += amount;
    upsertMetric(byDestination, destKey).costs += amount;
    upsertMetric(byIncoterm, incotermKey).costs += amount;
  });

  Object.keys(byZone).forEach((key) => {
    const ref = byZone[key];
    ref.vat = (ref.caHt * coerceNumber(vatRateRow?.rate_percent)) / 100;
    ref.om =
      (ref.caHt * coerceNumber((omRateRow as any)?.om_rate)) / 100 +
      (ref.caHt * coerceNumber((omRateRow as any)?.omr_rate)) / 100;
    ref.margin = ref.caHt - ref.costs - ref.vat - ref.om;
  });

  Object.keys(byDestination).forEach((key) => {
    const ref = byDestination[key];
    ref.vat = (ref.caHt * coerceNumber(vatRateRow?.rate_percent)) / 100;
    ref.om =
      (ref.caHt * coerceNumber((omRateRow as any)?.om_rate)) / 100 +
      (ref.caHt * coerceNumber((omRateRow as any)?.omr_rate)) / 100;
    ref.margin = ref.caHt - ref.costs - ref.vat - ref.om;
  });

  Object.keys(byIncoterm).forEach((key) => {
    const ref = byIncoterm[key];
    ref.vat = (ref.caHt * coerceNumber(vatRateRow?.rate_percent)) / 100;
    ref.om =
      (ref.caHt * coerceNumber((omRateRow as any)?.om_rate)) / 100 +
      (ref.caHt * coerceNumber((omRateRow as any)?.omr_rate)) / 100;
    ref.margin = ref.caHt - ref.costs - ref.vat - ref.om;
  });

  return {
    totals: {
      caHt: totals.caHt,
      qty: totals.qty,
      costs: totalCosts,
      vat: vatEstimate,
      om: omEstimate,
      margin,
      avgPrice,
      marginRate,
    },
    byZone,
    byDestination,
    byIncoterm,
    warnings,
  };
}
