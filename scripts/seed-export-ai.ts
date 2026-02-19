import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

type Row = Record<string, string>;

const url = process.env.SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRole) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(url, serviceRole, { auth: { persistSession: false } });

function parseCsv(file: string): Row[] {
  const content = readFileSync(resolve(file), "utf-8").trim();
  const [header, ...rows] = content.split(/\r?\n/);
  const keys = header.split(",");
  return rows.map((line) => {
    const values = line.split(",");
    return keys.reduce<Row>((acc, key, idx) => {
      acc[key] = values[idx] ?? "";
      return acc;
    }, {});
  });
}

async function upsert(table: string, rows: Row[], conflict: string) {
  if (!rows.length) return;
  const { error } = await supabase.from(table).upsert(rows, { onConflict: conflict });
  if (error) throw error;
  console.log(`${table}: ${rows.length} rows`);
}

async function main() {
  await upsert("hs_codes", parseCsv("src/data/seed/hs_codes_sample.csv"), "hs6");
  const synonyms = parseCsv("src/data/seed/hs_synonyms_sample.csv");
  if (synonyms.length) {
    const { error: synErr } = await supabase.from("hs_synonyms").insert(synonyms);
    if (synErr && !String(synErr.message).toLowerCase().includes("duplicate")) throw synErr;
    console.log(`hs_synonyms: ${synonyms.length} rows`);
  }
  await upsert("countries", parseCsv("src/data/seed/countries.csv"), "iso2");

  const templates = JSON.parse(readFileSync(resolve("src/data/seed/templates_seed.json"), "utf-8"));
  const { error } = await supabase.from("templates").upsert(templates, { onConflict: "key" });
  if (error) throw error;
  console.log(`templates: ${templates.length} rows`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
