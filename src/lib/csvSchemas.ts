import { z } from "zod";

export type CsvFileType =
  | "products"
  | "competitors"
  | "price_points"
  | "markets"
  | "fx_rates"
  | "shipments"
  | "invoices"
  | "lpp_reference";

type Row = Record<string, unknown>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date ISO attendue (YYYY-MM-DD)");
const currency = z.string().min(3).max(3);

const productSchema = z.object({
  id: z.string().min(1),
  sku: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  lpp_code: z.string().optional(),
  cost: z.coerce.number().positive().optional(),
  currency: currency.optional(),
});

const competitorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  brand_code: z.enum(["THUASNE", "DONJOY_ENOVIS", "GIBAUD", "AUTRE"]).optional(),
  notes: z.string().optional(),
});

const pricePointSchema = z.object({
  id: z.string().min(1),
  product_id: z.string().min(1),
  brand: z.enum(["ORLIMAN", "THUASNE", "DONJOY_ENOVIS", "GIBAUD"]),
  market: z.string().min(1),
  channel: z.string().min(1),
  currency,
  price: z.coerce.number().positive(),
  price_type: z.enum(["HT", "TTC"]),
  date: isoDate,
  source_label: z.string().min(1),
  confidence: z.coerce.number().min(0).max(100),
});

const marketSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  zone: z.enum(["UE", "DROM", "HORS_UE"]),
  country_code: z.string().min(2).max(2),
  currency: currency.optional(),
});

const fxRateSchema = z.object({
  base_currency: currency,
  quote_currency: currency,
  rate: z.coerce.number().positive(),
  date: isoDate,
});

const shipmentSchema = z.object({
  id: z.string().min(1),
  flow_code: z.string().min(1),
  incoterm: z.string().min(2).max(5),
  destination: z.string().min(1),
  departure_date: isoDate,
  delivery_date: isoDate,
  carrier: z.string().optional(),
  awb: z.string().optional(),
  bl: z.string().optional(),
  customs_status: z.string().optional(),
});

const invoiceSchema = z.object({
  id: z.string().optional(),
  invoice_number: z.string().min(1),
  client_name: z.string().min(1),
  invoice_date: isoDate,
  currency,
  amount_ht: z.coerce.number().positive(),
  amount_ttc: z.coerce.number().positive().optional(),
  tva_amount: z.coerce.number().nonnegative().optional(),
  incoterm: z.string().optional(),
  destination: z.string().optional(),
  flow_code: z.string().optional(),
  awb: z.string().optional(),
  bl: z.string().optional(),
});

const lppSchema = z.object({
  code: z.string().min(1),
  label: z.string().min(1),
  reimbursement_rate: z.coerce.number().min(0).max(100).optional(),
  notes: z.string().optional(),
});

export const fileSchemas: Record<CsvFileType, z.ZodSchema<Row>> = {
  products: productSchema,
  competitors: competitorSchema,
  price_points: pricePointSchema,
  markets: marketSchema,
  fx_rates: fxRateSchema,
  shipments: shipmentSchema,
  invoices: invoiceSchema,
  lpp_reference: lppSchema,
};

export type ImportReport<T = Row> = {
  fileType: CsvFileType;
  valid: T[];
  invalid: { row: number; errors: string[] }[];
};

export const validateRows = <T = Row>(fileType: CsvFileType, rows: Row[]): ImportReport<T> => {
  const schema = fileSchemas[fileType];
  const valid: T[] = [];
  const invalid: { row: number; errors: string[] }[] = [];

  rows.forEach((row, idx) => {
    const parsed = schema.safeParse(row);
    if (parsed.success) {
      valid.push(parsed.data as T);
    } else {
      invalid.push({
        row: idx + 1,
        errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      });
    }
  });

  return { fileType, valid, invalid };
};

const headers: Record<CsvFileType, string[]> = {
  products: ["id", "sku", "name", "category", "lpp_code", "cost", "currency"],
  competitors: ["id", "name", "brand_code", "notes"],
  markets: ["id", "label", "zone", "country_code", "currency"],
  price_points: [
    "id",
    "product_id",
    "brand",
    "market",
    "channel",
    "currency",
    "price",
    "price_type",
    "date",
    "source_label",
    "confidence",
  ],
  fx_rates: ["base_currency", "quote_currency", "rate", "date"],
  shipments: ["id", "flow_code", "incoterm", "destination", "departure_date", "delivery_date", "carrier", "awb", "bl"],
  invoices: [
    "invoice_number",
    "client_name",
    "invoice_date",
    "currency",
    "amount_ht",
    "amount_ttc",
    "tva_amount",
    "incoterm",
    "destination",
    "flow_code",
    "awb",
    "bl",
  ],
  lpp_reference: ["code", "label", "reimbursement_rate", "notes"],
};

const sampleRows: Partial<Record<CsvFileType, string[]>> = {
  products: ["p1,ORL-CH-001,Chevillere,Chevillere,201A,18,EUR"],
  price_points: ["pp-1,p1,ORLIMAN,FR,Pharmacie,EUR,42,TTC,2024-12-01,Retail panel,90"],
  markets: ["FR,France,UE,FR,EUR", "MQ,Martinique,DROM,GP,EUR"],
};

export const getCsvTemplate = (fileType: CsvFileType): string => {
  const header = headers[fileType].join(",");
  const body = sampleRows[fileType]?.join("\n") ?? "";
  return [header, body].filter(Boolean).join("\n");
};

export const importOrder: CsvFileType[] = [
  "products",
  "competitors",
  "markets",
  "price_points",
  "fx_rates",
  "shipments",
  "invoices",
  "lpp_reference",
];
