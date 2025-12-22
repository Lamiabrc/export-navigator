type VercelRequest = {
  body?: unknown;
  query?: Record<string, unknown>;
  method?: string;
};

type VercelResponse = {
  status: (code: number) => { json: (body: unknown) => void };
};

import { normalizeSheet, type RawOperationRow } from '../src/lib/parsers/operationsSheet';

type GraphRangeResponse = {
  values?: (string | number | null)[][];
};

const GRAPH_TOKEN = process.env.GRAPH_TOKEN;
const GRAPH_SITE = process.env.GRAPH_SITE_PATH; // ex: "orlimanfr.sharepoint.com:/sites/ADV274:"
const GRAPH_FILE = process.env.GRAPH_FILE_PATH; // ex: "/Documents/Exports/ton-fichier.xlsx"
const GRAPH_SHEET = process.env.GRAPH_SHEET_NAME || 'Feuil1';

const headersToObjects = (rows: (string | number | null)[][]): RawOperationRow[] => {
  if (!rows.length) return [];
  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((h) => (h === null || h === undefined ? '' : String(h).trim()));
  return dataRows.map((row) => {
    const obj: Record<string, string | number | null> = {};
    headers.forEach((key, idx) => {
      if (!key) return;
      obj[key] = row[idx] ?? null;
    });
    return obj as RawOperationRow;
  });
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!GRAPH_TOKEN || !GRAPH_SITE || !GRAPH_FILE) {
    return res.status(500).json({
      error: 'Missing Graph configuration (GRAPH_TOKEN, GRAPH_SITE_PATH, GRAPH_FILE_PATH)',
    });
  }

  const url = `https://graph.microsoft.com/v1.0/sites/${GRAPH_SITE}/drive/root:${GRAPH_FILE}:/workbook/worksheets('${encodeURIComponent(
    GRAPH_SHEET,
  )}')/usedRange(valuesOnly=true)?$top=5000`;

  try {
    const r = await fetch(url, {
      headers: {
        Authorization: `Bearer ${GRAPH_TOKEN}`,
        Accept: 'application/json',
      },
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ error: 'Graph error', detail: text });
    }

    const data = (await r.json()) as GraphRangeResponse;
    const table = headersToObjects(data.values ?? []);
    const normalized = normalizeSheet(table);

    return res.status(200).json({
      sourceRows: table.length,
      normalizedRows: normalized.length,
      data: normalized,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Unexpected error', detail: `${err}` });
  }
}
