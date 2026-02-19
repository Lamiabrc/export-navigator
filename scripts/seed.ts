import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

type JsonValue = Record<string, unknown>;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(path), "utf8")) as T;
}

function readCsv(path: string): string[][] {
  const raw = readFileSync(resolve(path), "utf8").trim();
  return raw.split(/\r?\n/).map((line) => line.split(","));
}

async function ensureSource(name: string) {
  const { data, error } = await supabase
    .from("source_registry")
    .upsert({ name, kind: "manual", enabled: true }, { onConflict: "name" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function logRun(sourceId: string, status: "success" | "failed" | "partial", stats: JsonValue, errorText?: string) {
  await supabase.from("ingestion_runs").insert({
    source_id: sourceId,
    status,
    stats,
    finished_at: new Date().toISOString(),
    error: errorText ?? null,
  });
}

async function upsertBatch(table: string, rows: JsonValue[], conflict?: string) {
  if (!rows.length) return;
  const query = supabase.from(table).upsert(rows, conflict ? { onConflict: conflict } : undefined);
  const { error } = await query;
  if (error) throw error;
}

async function main() {
  const sourceId = await ensureSource("Seed Import Script");

  try {
    const countries = readJson<JsonValue[]>("data/seed/countries.json");
    await upsertBatch("countries", countries, "iso2");

    const countryAliases = readJson<JsonValue[]>("data/seed/country_aliases.json");
    await upsertBatch("country_aliases", countryAliases, "iso2,alias");

    const products = readJson<Array<{ canonical_name: string; category?: string }>>("data/seed/products_seed.json");
    await upsertBatch(
      "products",
      products.map((p) => ({ canonical_name: p.canonical_name, category: p.category ?? null })),
      "canonical_name"
    );

    const { data: insertedProducts, error: productsErr } = await supabase.from("products").select("id,canonical_name");
    if (productsErr) throw productsErr;
    const productMap = new Map((insertedProducts ?? []).map((p) => [p.canonical_name, p.id]));

    const productSynonyms = readJson<Array<{ product_index: number; term: string; lang: string; weight: number }>>(
      "data/seed/product_synonyms_seed.json"
    );
    const synonymRows = productSynonyms
      .map((syn) => {
        const canonical = products[syn.product_index % products.length]?.canonical_name;
        const productId = canonical ? productMap.get(canonical) : null;
        if (!productId) return null;
        return {
          product_id: productId,
          term: syn.term,
          lang: syn.lang ?? "fr",
          weight: syn.weight ?? 1,
        };
      })
      .filter(Boolean) as JsonValue[];
    await upsertBatch("product_synonyms", synonymRows);

    const hsCodesRows = readCsv("data/seed/hs_codes_sample.csv");
    const [hsHeader, ...hsData] = hsCodesRows;
    const hsCodes = hsData.map((r) => ({
      hs6: r[hsHeader.indexOf("hs6")] ?? "",
      label_fr: r[hsHeader.indexOf("label_fr")] ?? "",
      label_en: r[hsHeader.indexOf("label_en")] ?? null,
      chapter: r[hsHeader.indexOf("chapter")] ?? null,
    }));
    await upsertBatch("hs_codes", hsCodes, "hs6");

    const hsSynRows = readCsv("data/seed/hs_synonyms_sample.csv");
    const [hsSynHeader, ...hsSynData] = hsSynRows;
    const hsSynonyms = hsSynData.map((r) => ({
      hs6: r[hsSynHeader.indexOf("hs6")] ?? "",
      term: r[hsSynHeader.indexOf("term")] ?? "",
      weight: Number(r[hsSynHeader.indexOf("weight")] ?? "1"),
    }));
    await upsertBatch("hs_synonyms", hsSynonyms);

    const examplesRows = readCsv("data/seed/product_hs_examples.csv");
    const [exHeader, ...exData] = examplesRows;
    const examples = exData.map((r) => ({
      product_term: r[exHeader.indexOf("product_term")] ?? "",
      hs6: r[exHeader.indexOf("hs6")] ?? "",
      note: r[exHeader.indexOf("note")] ?? null,
      confidence: Number(r[exHeader.indexOf("confidence")] ?? "70"),
    }));
    await upsertBatch("product_hs_examples", examples);

    const templates = readJson<JsonValue[]>("data/seed/templates_seed.json");
    await upsertBatch("templates", templates, "key");

    await logRun(sourceId, "success", {
      countries: countries.length,
      country_aliases: countryAliases.length,
      products: products.length,
      product_synonyms: synonymRows.length,
      hs_codes: hsCodes.length,
      hs_synonyms: hsSynonyms.length,
      product_hs_examples: examples.length,
      templates: templates.length,
    });

    console.log("Seed completed successfully");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logRun(sourceId, "failed", {}, message);
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
