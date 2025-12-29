import type { VercelRequest, VercelResponse } from "@vercel/node";
import { normalizeSheet, type RawOperationRow } from "../src/lib/parsers/operationsSheet";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type GraphRangeResponse = {
  values?: (string | number | boolean | null)[][];
};

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────
const GRAPH_TOKEN = process.env.GRAPH_TOKEN;
// ex: "orlimanfr.sharepoint.com:/sites/ADV274:"  (format Graph "site path")
const GRAPH_SITE_PATH = process.env.GRAPH_SITE_PATH;
// ex: "/Documents/Exports/ton-fichier.xlsx"
const GRAPH_FILE_PATH = process.env.GRAPH_FILE_PATH;
const GRAPH_SHEET_NAME = process.env.GRAPH_SHEET_NAME || "Feuil1";

// Optionnel: restreindre les origines autorisées
const ALLOWED_ORIGINS = new Set<string>([
  "https://export-navigator-orli.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
]);

function setCors(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin;
  const allowOrigin =
    origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://export-navigator-orli.vercel.app";

  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "content-type, authorization, x-client-info, apikey"
  );
  res.setHeader("Access-Control-Max-Age", "86400");
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function asString(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function headersToObjects(rows: (string | number | boolean | null)[][]): RawOperationRow[] {
  if (!rows || rows.length === 0) return [];

  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((h) => asString(h));

  return dataRows
    .filter((r) => r && r.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== ""))
    .map((row) => {
      const obj: Record<string, string | number | null> = {};
      headers.forEach((key, idx) => {
        if (!key) return;
        const cell = row[idx];
        obj[key] = (cell === undefined ? null : (cell as any)) ?? null;
      });
      return obj as RawOperationRow;
    });
}

function requireConfig() {
  if (!GRAPH_TOKEN) {
    throw new Error("Missing GRAPH_TOKEN (Microsoft Graph bearer token).");
  }
  if (!GRAPH_SITE_PATH) {
    throw new Error("Missing GRAPH_SITE_PATH (e.g. orlimanfr.sharepoint.com:/sites/ADV274:).");
  }
  if (!GRAPH_FILE_PATH) {
    throw new Error("Missing GRAPH_FILE_PATH (e.g. /Documents/Exports/file.xlsx).");
  }
}

// ─────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // (optionnel) restreindre à GET uniquement
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    requireConfig();

    // IMPORTANT :
    // Le nom de feuille doit être encodé mais dans l’URL Graph on l’insère déjà dans (...) entouré de quotes.
    const sheet = encodeURIComponent(GRAPH_SHEET_NAME);

    // usedRange(valuesOnly=true) renvoie le tableau complet de la plage utilisée
    const url =
      `https://graph.microsoft.com/v1.0/sites/${GRAPH_SITE_PATH}` +
      `/drive/root:${GRAPH_FILE_PATH}:/workbook/worksheets('${sheet}')` +
      `/usedRange(valuesOnly=true)?$top=5000`;

    const r = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${GRAPH_TOKEN}`,
        Accept: "application/json",
      },
    });

    if (!r.ok) {
      const detail = await r.text();
      return res.status(r.status).json({
        error: "Graph error",
        status: r.status,
        detail,
        url, // pratique pour debug
      });
    }

    const data = (await r.json()) as GraphRangeResponse;
    const rawRows = headersToObjects(data.values ?? []);
    const normalized = normalizeSheet(rawRows);

    return res.status(200).json({
      ok: true,
      sheet: GRAPH_SHEET_NAME,
      sourceRows: rawRows.length,
      normalizedRows: normalized.length,
      data: normalized,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "Unexpected error",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
