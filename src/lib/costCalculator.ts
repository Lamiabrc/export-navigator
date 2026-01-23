import type { ProductRow } from "@/hooks/useProducts";
import { safeNumber } from "@/hooks/useProducts";

export type PricingMode = "CATALOGUE_2025" | "REFERENCE" | "MANUAL";

export type QuoteLine = {
  code_article: string;
  qty: number;
  pricing_mode?: PricingMode;
  unit_price_ht_manual?: number; // si MANUAL
};

export type QuoteContext = {
  client_id?: string;
  destination_id?: string; // plus tard quand on branche export_destinations
  groupement_id?: string;  // plus tard quand on branche groupements
};

export const getUnitPriceHT = (p?: ProductRow, mode: PricingMode = "CATALOGUE_2025", manual?: number) => {
  if (mode === "MANUAL") return safeNumber(manual);
  if (!p) return 0;
  if (mode === "REFERENCE") return safeNumber(p.tarif_ref_eur);
  return safeNumber(p.tarif_catalogue_2025);
};

export const getTvaPct = (p?: ProductRow) => safeNumber(p?.tva_percent);

export const computeLine = (line: QuoteLine, product?: ProductRow) => {
  const qty = Math.max(0, safeNumber(line.qty));
  const mode = line.pricing_mode ?? "CATALOGUE_2025";
  const unit = getUnitPriceHT(product, mode, line.unit_price_ht_manual);
  const ht = qty * unit;
  const tva = ht * (getTvaPct(product) / 100);
  const ttc = ht + tva;
  return { unit, ht, tva, ttc, tvaPct: getTvaPct(product) };
};

export const computeTotals = (lines: QuoteLine[], byCodeArticle: Map<string, ProductRow>) => {
  return lines.reduce(
    (acc, l) => {
      const p = byCodeArticle.get(String(l.code_article ?? "").trim());
      const r = computeLine(l, p);
      acc.ht += r.ht;
      acc.tva += r.tva;
      acc.ttc += r.ttc;
      return acc;
    },
    { ht: 0, tva: 0, ttc: 0 }
  );
};
