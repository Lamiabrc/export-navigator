import type { Competitor, PricePoint, Product } from "@/types/pricing";

const required = (row: Record<string, string>, fields: string[]) =>
  fields.filter((f) => !row[f] || String(row[f]).trim() === "");

const isIsoDate = (val: string) => /^\d{4}-\d{2}-\d{2}$/.test(val);

export const parseCSV = async (file: File): Promise<Record<string, string>[]> => {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (cols[idx] ?? "").trim();
    });
    rows.push(row);
  }
  return rows;
};

type ValidationResult<T> = {
  valid: T[];
  invalid: { row: number; errors: string[] }[];
};

export const validateCompetitors = (rows: Record<string, string>[]): ValidationResult<Competitor> => {
  const valid: Competitor[] = [];
  const invalid: { row: number; errors: string[] }[] = [];
  const allowedBrands = ["ORLIMAN", "THUASNE", "DONJOY_ENOVIS", "GIBAUD", "AUTRE"];
  rows.forEach((row, idx) => {
    const missing = required(row, ["id", "name", "brand_code"]);
    const errors: string[] = missing.map((m) => `${m} manquant`);
    if (row.brand_code && !allowedBrands.includes(row.brand_code)) {
      errors.push("brand_code invalide");
    }
    if (errors.length) {
      invalid.push({ row: idx + 2, errors });
    } else {
      valid.push({
        id: row.id,
        name: row.name,
        brand_code: row.brand_code as Competitor["brand_code"],
        notes: row.notes,
      });
    }
  });
  return { valid, invalid };
};

export const validateProducts = (rows: Record<string, string>[]): ValidationResult<Product> => {
  const valid: Product[] = [];
  const invalid: { row: number; errors: string[] }[] = [];
  rows.forEach((row, idx) => {
    const missing = required(row, ["product_id", "sku", "product_name", "category"]);
    const errors: string[] = missing.map((m) => `${m} manquant`);
    const height = row.height_cm ? Number(row.height_cm) : undefined;
    if (row.height_cm && Number.isNaN(height)) errors.push("height_cm non numerique");
    if (errors.length) {
      invalid.push({ row: idx + 2, errors });
    } else {
      valid.push({
        product_id: row.product_id,
        sku: row.sku,
        product_name: row.product_name,
        category: row.category,
        height_cm: height,
        unit: row.unit,
        notes: row.notes,
        id: row.product_id,
        name: row.product_name,
      });
    }
  });
  return { valid, invalid };
};

export const validatePricePoints = (
  rows: Record<string, string>[],
  products?: Product[]
): ValidationResult<PricePoint> => {
  const valid: PricePoint[] = [];
  const invalid: { row: number; errors: string[] }[] = [];
  const allowedBrands: PricePoint["brand"][] = ["ORLIMAN", "THUASNE", "DONJOY_ENOVIS", "GIBAUD"];

  rows.forEach((row, idx) => {
    const missing = required(row, [
      "price_id",
      "product_id",
      "brand",
      "market",
      "channel",
      "currency",
      "price",
      "price_type",
      "date",
      "confidence",
      "source_label",
    ]);
    const errors: string[] = missing.map((m) => `${m} manquant`);

    const price = Number(row.price);
    if (Number.isNaN(price) || price <= 0) errors.push("price doit être numerique > 0");

    const conf = Number(row.confidence);
    if (Number.isNaN(conf) || conf < 0 || conf > 100) errors.push("confidence doit etre 0..100");

    if (!isIsoDate(row.date)) errors.push("date non ISO (YYYY-MM-DD)");

    if (!allowedBrands.includes(row.brand as PricePoint["brand"])) errors.push("brand invalide");

    if (row.price_type !== "HT" && row.price_type !== "TTC") errors.push("price_type doit etre HT ou TTC");

    if (products && !products.find((p) => p.product_id === row.product_id)) {
      errors.push("product_id inconnu (pas dans products)");
    }

    if (errors.length) {
      invalid.push({ row: idx + 2, errors });
    } else {
      valid.push({
        price_id: row.price_id,
        product_id: row.product_id,
        brand: row.brand as PricePoint["brand"],
        market: row.market,
        channel: row.channel,
        currency: row.currency,
        price,
        price_type: row.price_type as PricePoint["price_type"],
        date: row.date,
        confidence: conf,
        source_label: row.source_label,
        lppr_reimbursement_ttc: row.lppr_reimbursement_ttc ? Number(row.lppr_reimbursement_ttc) : undefined,
        vat_rate: row.vat_rate ? Number(row.vat_rate) : undefined,
        id: row.price_id,
        productId: row.product_id,
      });
    }
  });

  return { valid, invalid };
};
