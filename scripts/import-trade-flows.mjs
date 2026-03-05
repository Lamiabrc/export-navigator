import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_REPORTER = "FR";
const DEFAULT_FLOW = "export";
const DEFAULT_SOURCE = "csv_import_manual";
const DEFAULT_BATCH_SIZE = 500;

function usage() {
  console.log(`
Usage:
  node scripts/import-trade-flows.mjs --file <path> [options]

Options:
  --file <path>          CSV/XLSX file to import (required)
  --sheet <name>         Sheet name for XLSX input
  --reporter <iso2>      Default reporter ISO2 (default: FR)
  --flow <export|import> Default flow type (default: export)
  --source <text>        Source label stored in DB (default: csv_import_manual)
  --batch-size <n>       Batch size (default: 500)
  --year <YYYY>          Force year when source data has no year/date
  --dry-run              Parse and validate only, no DB write
  --help                 Print this help
`);
}

function parseArgs(argv) {
  const out = {
    file: "",
    sheet: "",
    reporter: DEFAULT_REPORTER,
    flow: DEFAULT_FLOW,
    source: DEFAULT_SOURCE,
    batchSize: DEFAULT_BATCH_SIZE,
    year: "",
    dryRun: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];

    if (key === "dry-run") {
      out.dryRun = true;
      continue;
    }
    if (key === "help") {
      out.help = true;
      continue;
    }
    if (typeof next === "undefined" || next.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }

    if (key === "file") out.file = String(next);
    else if (key === "sheet") out.sheet = String(next);
    else if (key === "reporter") out.reporter = String(next);
    else if (key === "flow") out.flow = String(next);
    else if (key === "source") out.source = String(next);
    else if (key === "batch-size") out.batchSize = Math.max(1, Math.trunc(Number(next) || DEFAULT_BATCH_SIZE));
    else if (key === "year") out.year = String(next);
    else throw new Error(`Unknown option --${key}`);

    i += 1;
  }

  return out;
}

function normalizeHeader(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).trim().replace(/\s/g, "").replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function toIso2(value) {
  const iso2 = String(value || "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(iso2) ? iso2 : null;
}

function toFlow(value, fallback) {
  const text = String(value || fallback || "").trim().toLowerCase();
  return text === "import" ? "import" : "export";
}

function toHsCode(value) {
  const digits = String(value || "").replace(/[^0-9]/g, "");
  if (!digits) return "TOTAL";
  if (digits.length >= 6) return digits.slice(0, 6);
  if (digits.length >= 4) return digits.slice(0, 4);
  return digits.slice(0, 2);
}

function toYear(rawYear, rawDate, fallbackYear) {
  const parsedYear = Math.trunc(Number(rawYear));
  if (Number.isFinite(parsedYear) && parsedYear >= 1990 && parsedYear <= 2100) return parsedYear;

  const asDate = rawDate ? new Date(String(rawDate)) : null;
  if (asDate && Number.isFinite(asDate.getTime())) return asDate.getUTCFullYear();

  const fallback = Math.trunc(Number(fallbackYear));
  if (Number.isFinite(fallback) && fallback >= 1990 && fallback <= 2100) return fallback;
  return new Date().getUTCFullYear();
}

function buildKey(row) {
  return `${row.reporter_iso2}|${row.partner_iso2}|${row.flow}|${row.year}|${row.hs_code}`;
}

function isMissingRpcFunction(err) {
  const code = String(err?.code || "");
  const message = String(err?.message || "");
  return code === "PGRST202" || /rpc_upsert_trade_flows|could not find the function/i.test(message);
}

function isMissingColumn(err) {
  const code = String(err?.code || "");
  const message = String(err?.message || "");
  return code === "42703" || /column .* does not exist|schema cache/i.test(message);
}

function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
  return out;
}

function readRows(filePath, sheetName) {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const targetSheet = sheetName || workbook.SheetNames[0];
  if (!targetSheet || !workbook.Sheets[targetSheet]) {
    throw new Error(`Sheet "${targetSheet}" not found in ${filePath}`);
  }
  return XLSX.utils.sheet_to_json(workbook.Sheets[targetSheet], { defval: null, raw: false });
}

function pick(rowMap, keys) {
  for (const key of keys) {
    if (key in rowMap) return rowMap[key];
  }
  return null;
}

function parseInputRows(rawRows, options) {
  const parsed = [];
  const rejected = [];
  const dedup = new Map();

  for (let idx = 0; idx < rawRows.length; idx += 1) {
    const row = rawRows[idx];
    const normalizedRow = {};
    for (const [key, value] of Object.entries(row)) {
      normalizedRow[normalizeHeader(key)] = value;
    }

    const partner = toIso2(
      pick(normalizedRow, [
        "partner_iso2",
        "partner_country",
        "destination_iso2",
        "destination_country",
        "destination",
        "to_country",
        "country_iso2",
        "country",
        "iso2",
      ])
    );
    const reporter = toIso2(
      pick(normalizedRow, ["reporter_iso2", "reporter_country", "origin_iso2", "origin", "from_country"]) || options.reporter
    );

    const value =
      toNumber(
        pick(normalizedRow, [
          "value_eur",
          "value_usd",
          "trade_value",
          "export_value",
          "value",
          "amount",
          "valeur",
        ])
      ) || 0;

    if (!partner) {
      rejected.push({ row: idx + 2, reason: "partner ISO2 missing/invalid" });
      continue;
    }
    if (!reporter) {
      rejected.push({ row: idx + 2, reason: "reporter ISO2 missing/invalid" });
      continue;
    }
    if (!(value > 0)) {
      rejected.push({ row: idx + 2, reason: "value <= 0 or invalid" });
      continue;
    }

    const flow = toFlow(pick(normalizedRow, ["flow", "flow_type", "direction", "type"]), options.flow);
    const hsCode = toHsCode(pick(normalizedRow, ["hs_code", "hs6", "hs", "product_hs", "customs_code"]));
    const year = toYear(
      pick(normalizedRow, ["year", "annee"]),
      pick(normalizedRow, ["flow_date", "date", "period_date", "period"]),
      options.year
    );
    const source = String(pick(normalizedRow, ["source"]) || options.source || DEFAULT_SOURCE).trim();
    const volumeKg = toNumber(pick(normalizedRow, ["volume_kg", "volume", "kg", "quantity_kg"]));

    const normalized = {
      reporter_iso2: reporter,
      partner_iso2: partner,
      flow,
      year,
      hs_code: hsCode,
      value_usd: Number(value.toFixed(2)),
      volume_kg: volumeKg === null ? null : Number(volumeKg.toFixed(3)),
      source,
      flow_date: `${year}-01-01`,
      reporter_country: reporter,
      partner_country: partner,
      flow_type: flow,
      value_eur: Number(value.toFixed(2)),
    };

    dedup.set(buildKey(normalized), normalized);
  }

  for (const value of dedup.values()) parsed.push(value);
  return { parsed, rejected };
}

async function importViaRpc(supabase, rows, batchSize) {
  let upserted = 0;
  for (const batch of chunk(rows, batchSize)) {
    const { data, error } = await supabase.rpc("rpc_upsert_trade_flows", { p_rows: batch });
    if (error) throw error;
    const count = Number(data?.upserted);
    upserted += Number.isFinite(count) ? count : batch.length;
  }
  return upserted;
}

async function importDirect(supabase, rows, batchSize) {
  const modernProbe = await supabase
    .from("trade_flows")
    .select("reporter_iso2,partner_iso2,flow,year,hs_code")
    .limit(1);

  const isModernSchema = !modernProbe.error;
  if (modernProbe.error && !isMissingColumn(modernProbe.error)) throw modernProbe.error;

  let inserted = 0;
  if (isModernSchema) {
    for (const batch of chunk(rows, batchSize)) {
      const modernRows = batch.map((row) => ({
        flow_date: row.flow_date,
        hs_code: row.hs_code,
        reporter_country: row.reporter_country,
        partner_country: row.partner_country,
        flow_type: row.flow_type,
        value_eur: row.value_eur,
        volume_kg: row.volume_kg,
        source: row.source,
        reporter_iso2: row.reporter_iso2,
        partner_iso2: row.partner_iso2,
        flow: row.flow,
        year: row.year,
        value_usd: row.value_usd,
      }));

      const { error } = await supabase
        .from("trade_flows")
        .upsert(modernRows, { onConflict: "reporter_iso2,partner_iso2,flow,year,hs_code" });
      if (error) throw error;
      inserted += modernRows.length;
    }
    return inserted;
  }

  for (const batch of chunk(rows, batchSize)) {
    const legacyRows = batch.map((row) => ({
      flow_date: row.flow_date,
      hs_code: row.hs_code,
      reporter_country: row.reporter_country,
      partner_country: row.partner_country,
      flow_type: row.flow_type,
      value_eur: row.value_eur,
      volume_kg: row.volume_kg,
      source: row.source,
    }));

    const { error } = await supabase.from("trade_flows").insert(legacyRows);
    if (error) throw error;
    inserted += legacyRows.length;
  }
  return inserted;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }
  if (!args.file) {
    usage();
    throw new Error("Missing --file");
  }

  const filePath = path.resolve(args.file);
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
  const supabaseServiceRole = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_KEY || ""
  ).trim();
  if (!supabaseUrl || !supabaseServiceRole) {
    throw new Error(
      "Missing Supabase env vars. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE / SUPABASE_SERVICE_KEY)."
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRole, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const rawRows = readRows(filePath, args.sheet);
  if (!rawRows.length) throw new Error("Input file has no rows.");

  const { parsed, rejected } = parseInputRows(rawRows, args);

  console.log(`[import-trade-flows] file=${filePath}`);
  console.log(`[import-trade-flows] rows_read=${rawRows.length} rows_ready=${parsed.length} rows_rejected=${rejected.length}`);
  if (rejected.length) {
    const preview = rejected.slice(0, 12).map((item) => `line ${item.row}: ${item.reason}`).join("\n");
    console.log(`[import-trade-flows] rejected_preview:\n${preview}`);
  }
  if (!parsed.length) throw new Error("No valid rows to import after validation.");

  if (args.dryRun) {
    console.log("[import-trade-flows] dry-run enabled. No DB write executed.");
    console.log("[import-trade-flows] sample:", parsed.slice(0, 3));
    return;
  }

  let imported = 0;
  try {
    imported = await importViaRpc(supabase, parsed, args.batchSize);
    console.log(`[import-trade-flows] mode=rpc_upsert_trade_flows imported=${imported}`);
  } catch (err) {
    if (!isMissingRpcFunction(err)) throw err;
    imported = await importDirect(supabase, parsed, args.batchSize);
    console.log(`[import-trade-flows] mode=direct imported=${imported}`);
  }

  const topCountries = new Map();
  for (const row of parsed) {
    topCountries.set(row.partner_iso2, (topCountries.get(row.partner_iso2) || 0) + row.value_usd);
  }
  const top = Array.from(topCountries.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([iso2, value]) => `${iso2}:${Math.round(value)}`);

  console.log(`[import-trade-flows] done imported=${imported} top_partners=${top.join(", ")}`);
}

main().catch((err) => {
  console.error("[import-trade-flows] failed:", err?.message || String(err));
  process.exit(1);
});

