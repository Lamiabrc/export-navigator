import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { allowCors, json, readJson, supabaseAdmin } from "../src/server/supabaseAdmin.js";

type LeadPayload = {
  email?: string;
  consent?: boolean;
  simulationId?: string | null;
  metadata?: Record<string, unknown>;
};

type PrefsPayload = {
  email?: string;
  countries?: string[];
  hsCodes?: string[];
};

function mapAlertRow(row: Record<string, unknown>) {
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    message: String(row.message ?? ""),
    severity: String(row.severity ?? "info"),
    country: row.country ?? null,
    hsPrefix: row.hs_prefix ?? row.hsPrefix ?? null,
    detectedAt: row.detected_at ?? row.detectedAt ?? null,
    source: row.source ?? null,
  };
}

function normalizeArray(value?: string[] | null): string[] {
  if (!value) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function toText(v: any) {
  return String(v ?? "").trim();
}

async function handleLead(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const body = await readJson<LeadPayload>(req);
    const email = String(body?.email || "").trim();
    if (!email) {
      return json(res, 400, { ok: false, error: "email_required" });
    }

    const payload = {
      p_email: email,
      p_consent: Boolean(body?.consent),
      p_simulation_id: body?.simulationId ?? null,
      p_metadata: body?.metadata ?? {},
    };

    const supabase = supabaseAdmin();
    const { data, error } = await supabase.rpc("mpl_insert_lead", payload);
    if (error) {
      console.error("[api/lead-magnet] lead rpc error", error);
      return json(res, 500, { ok: false, error: error.message || "lead_rpc_failed" });
    }

    return json(res, 200, { ok: true, leadId: data ?? null });
  } catch (err: any) {
    console.error("[api/lead-magnet] lead error", err?.message || err);
    return json(res, 500, { ok: false, error: err?.message || "lead_failed" });
  }
}

async function handleAlerts(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const email = String((req.query as any)?.email ?? "").trim();
    const supabase = supabaseAdmin();
    let rows: Record<string, unknown>[] = [];

    if (email) {
      const { data, error } = await supabase.rpc("mpl_get_alerts", {
        p_email: email,
        p_limit: 50,
      });

      if (error) {
        console.error("[api/lead-magnet] alerts rpc error", error);
        return json(res, 500, { ok: false, error: error.message || "alerts_rpc_failed" });
      }

      rows = Array.isArray(data) ? data : [];
    } else {
      const { data, error } = await supabase
        .from("mpl_alerts")
        .select("*")
        .order("detected_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("[api/lead-magnet] alerts select error", error);
        return json(res, 500, { ok: false, error: error.message || "alerts_select_failed" });
      }

      rows = Array.isArray(data) ? data : [];
    }

    const alerts = rows.map(mapAlertRow);

    return json(res, 200, {
      updatedAt: new Date().toISOString(),
      alerts,
    });
  } catch (err: any) {
    console.error("[api/lead-magnet] alerts error", err?.message || err);
    return json(res, 500, { ok: false, error: err?.message || "alerts_failed" });
  }
}

async function handlePrefs(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const body = await readJson<PrefsPayload>(req);
    const email = String(body?.email || "").trim();
    if (!email) {
      return json(res, 400, { ok: false, error: "email_required" });
    }

    const payload = {
      p_email: email,
      p_countries: normalizeArray(body?.countries),
      p_hs_codes: normalizeArray(body?.hsCodes),
    };

    const supabase = supabaseAdmin();
    const { error } = await supabase.rpc("mpl_upsert_prefs", payload);
    if (error) {
      console.error("[api/lead-magnet] prefs rpc error", error);
      return json(res, 500, { ok: false, error: error.message || "prefs_rpc_failed" });
    }

    return json(res, 200, { ok: true });
  } catch (err: any) {
    console.error("[api/lead-magnet] prefs error", err?.message || err);
    return json(res, 500, { ok: false, error: err?.message || "prefs_failed" });
  }
}

async function handleHsSearch(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  const q = String((req.query as any)?.q || "").trim();
  if (q.length < 2) return json(res, 200, { ok: true, items: [] });

  const { data, error } = await supabaseAdmin().rpc("mpl_search_hs", { q, lim: 12 });
  if (error) return json(res, 500, { ok: false, error: error.message });

  return json(res, 200, {
    ok: true,
    items: (data || []).map((x: any) => ({ code: x.code, label: x.label })),
  });
}

async function handlePdf(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end("Method not allowed");
    return;
  }

  try {
    const payload = await readJson<any>(req);

    const title = toText(payload?.title) || "Rapport de controle export";
    const email = toText(payload?.email);
    const destination = toText(payload?.destination);
    const incoterm = toText(payload?.incoterm);
    const value = payload?.value;
    const currency = toText(payload?.currency) || "EUR";
    const landed = payload?.result?.landedCost;

    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const { height } = page.getSize();
    let y = height - 60;
    const x = 50;

    page.drawText("MPL Export Conseil", { x, y, size: 12, font: bold, color: rgb(0.1, 0.2, 0.4) });
    y -= 18;
    page.drawText(title, { x, y, size: 16, font: bold, color: rgb(0.05, 0.1, 0.2) });

    y -= 22;
    page.drawText(`Date : ${new Date().toLocaleString("fr-FR")}`, { x, y, size: 10, font, color: rgb(0.3, 0.3, 0.3) });

    y -= 22;
    const lines = [
      email ? `Email : ${email}` : null,
      destination ? `Destination : ${destination}` : null,
      incoterm ? `Incoterm : ${incoterm}` : null,
      value != null ? `Valeur : ${value} ${currency}` : null,
    ].filter(Boolean) as string[];

    for (const l of lines) {
      page.drawText(l, { x, y, size: 11, font });
      y -= 16;
    }

    y -= 10;
    page.drawText("Synthese estimation (indicative)", { x, y, size: 12, font: bold });
    y -= 18;

    if (landed) {
      page.drawText(`Droits : ${Number(landed.duty || 0).toFixed(0)} ${landed.currency || currency}`, { x, y, size: 11, font });
      y -= 16;
      page.drawText(`Taxes : ${Number(landed.taxes || 0).toFixed(0)} ${landed.currency || currency}`, { x, y, size: 11, font });
      y -= 16;
      page.drawText(`Total : ${Number(landed.total || 0).toFixed(0)} ${landed.currency || currency}`, { x, y, size: 12, font: bold });
      y -= 18;
    } else {
      page.drawText("Aucune donnee de cout fournie.", { x, y, size: 11, font });
      y -= 16;
    }

    page.drawText("Note : ce rapport est informatif. Validation humaine recommandee.", {
      x,
      y: 60,
      size: 9,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });

    const bytes = await pdf.save();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=\"mpl-rapport-export.pdf\"");
    res.statusCode = 200;
    res.end(Buffer.from(bytes));
  } catch (e: any) {
    res.statusCode = 500;
    res.end(e?.message || "pdf failed");
  }
}

async function handleExportBrief(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

  try {
    const body = await readJson(req);

    const hsInput = body?.hsInput ? String(body.hsInput).trim() : null;
    const productText = body?.productText ? String(body.productText).trim() : null;
    const destinationIso2 = body?.destinationIso2 ? String(body.destinationIso2).trim().toUpperCase() : null;

    const value = Number(body?.value || 0);
    const currency = String(body?.currency || "EUR");
    const incoterm = String(body?.incoterm || "DAP");
    const mode = String(body?.mode || "sea");

    if (!destinationIso2) return json(res, 400, { ok: false, error: "destinationIso2 requis" });
    if (!hsInput && !productText) return json(res, 400, { ok: false, error: "hsInput ou productText requis" });

    const baseDutyRate = hsInput ? 0.04 : 0.06;
    const duty = clamp(value * baseDutyRate, 0, 1e12);
    const taxes = clamp((value + duty) * 0.2, 0, 1e12);
    const total = value + duty + taxes;

    const documents = [
      "Facture commerciale",
      "Packing list",
      "Document transport (AWB / B/L / CMR)",
      "Justificatif d'origine (selon accord/regles)",
      "Declaration export (selon cas)",
    ];

    const risks = [
      {
        title: "Sanctions & restrictions",
        level: "high" as const,
        message: "Verifier sanctions, biens a double usage, restrictions sectorielles selon destination.",
      },
      {
        title: "Documents & origine",
        level: "medium" as const,
        message: "L'eligibilite preferentielle depend du produit + origine + preuve documentaire.",
      },
      {
        title: "Incoterm & responsabilites",
        level: "low" as const,
        message: `Incoterm ${incoterm} : securiser la repartition des couts/risques (assurance, transport, formalites).`,
      },
    ];

    const complianceScore = clamp((hsInput ? 70 : 55) + (value > 0 ? 10 : 0), 0, 100);

    const brief = {
      estimate: { duty, taxes, total, currency },
      documents,
      risks,
      complianceScore,
      updatedAt: new Date().toISOString(),
      confidence: hsInput ? ("medium" as const) : ("low" as const),
      sources: ["MPL rules (indicatif)"],
    };

    const { data: simId, error } = await supabaseAdmin().rpc("save_simulation", {
      p_email: null,
      p_payload: body ?? {},
      p_result: brief,
      p_score: complianceScore,
      p_destination_iso2: destinationIso2,
      p_hs_input: hsInput,
    });

    if (error) return json(res, 500, { ok: false, error: error.message });

    return json(res, 200, { ok: true, data: { ...brief, simulationId: simId ?? null } });
  } catch (e: any) {
    return json(res, 500, { ok: false, error: e?.message || "brief failed" });
  }
}

export default allowCors(async function handler(req: VercelRequest, res: VercelResponse) {
  const mode = String((req.query as any)?.mode || "").trim();

  switch (mode) {
    case "lead":
      return handleLead(req, res);
    case "alerts":
      return handleAlerts(req, res);
    case "prefs":
      return handlePrefs(req, res);
    case "hs_search":
      return handleHsSearch(req, res);
    case "pdf":
      return handlePdf(req, res);
    case "export-brief":
      return handleExportBrief(req, res);
    default:
      return json(res, 400, { ok: false, error: "mode_required" });
  }
});
