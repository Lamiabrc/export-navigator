import type { VercelRequest, VercelResponse } from "@vercel/node";
import { allowCors, json, readJson, supabaseAdmin } from "../src/server/supabaseAdmin.js";

type Payload = {
  product_name?: string;
  destination?: string;
  hs_hint?: string;
};

function norm(v: string) {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function parsePercent(v: unknown) {
  if (typeof v === "string") {
    const cleaned = v.replace("%", "").replace(",", ".").trim();
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function openaiSuggestHs(product: string, options: string[]) {
  const key = (process.env.OPENAI_API_KEY || "").trim();
  if (!key || !options.length) return null;

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Tu fais une classification produit vers code HS. Réponds uniquement en JSON: {hs_code: string, confidence: number}. Prends exclusivement un HS de la liste fournie.",
        },
        {
          role: "user",
          content: `Produit: ${product}\nHS possibles: ${options.join(", ")}`,
        },
      ],
    }),
  });

  if (!resp.ok) return null;
  const data = (await resp.json()) as any;
  const raw = String(data?.choices?.[0]?.message?.content || "");
  try {
    const parsed = JSON.parse(raw);
    const hs = String(parsed?.hs_code || "").replace(/[^0-9]/g, "");
    if (hs && options.some((o) => o.startsWith(hs) || hs.startsWith(o))) return hs;
  } catch {
    // ignore
  }
  return null;
}

export default allowCors(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "method_not_allowed" });

  try {
    const body = await readJson<Payload>(req);
    const product = String(body?.product_name || "").trim();
    const destination = String(body?.destination || "").trim();
    const hsHint = String(body?.hs_hint || "").replace(/[^0-9]/g, "");

    if (!product && !hsHint) {
      return json(res, 400, { ok: false, error: "product_or_hs_required" });
    }

    const admin = supabaseAdmin();

    const { data: hsRows } = await admin
      .from("export_hs_catalog")
      .select("hs_code,destination,om_rate,omr_rate,notes,source")
      .limit(40);

    const rows = Array.isArray(hsRows) ? hsRows : [];
    const destNorm = norm(destination);

    let selected = rows.find((r: any) => {
      const hs = String(r?.hs_code || "").replace(/[^0-9]/g, "");
      if (!hsHint || !hs) return false;
      return hs.startsWith(hsHint) || hsHint.startsWith(hs);
    });

    if (!selected && product) {
      const n = norm(product);
      selected = rows.find((r: any) => {
        const hay = norm(`${r?.notes || ""} ${r?.hs_code || ""}`);
        const haySeed = hay.slice(0, 24).trim();
        const destOk = !destNorm || norm(String(r?.destination || "")).includes(destNorm);
        return destOk && (hay.includes(n) || (haySeed.length > 2 && n.includes(haySeed)));
      });
    }

    if (!selected && product) {
      const hsOptions = rows
        .map((r: any) => String(r?.hs_code || "").replace(/[^0-9]/g, ""))
        .filter(Boolean)
        .slice(0, 30);
      const aiHs = await openaiSuggestHs(product, hsOptions);
      if (aiHs) {
        selected = rows.find((r: any) => {
          const hs = String(r?.hs_code || "").replace(/[^0-9]/g, "");
          const destOk = !destNorm || norm(String(r?.destination || "")).includes(destNorm);
          return destOk && (hs.startsWith(aiHs) || aiHs.startsWith(hs));
        }) || rows.find((r: any) => String(r?.hs_code || "").replace(/[^0-9]/g, "").startsWith(aiHs));
      }
    }

    const hsCode = String(selected?.hs_code || hsHint || "").replace(/[^0-9]/g, "");

    return json(res, 200, {
      ok: true,
      hs_code: hsCode || null,
      destination: destination || selected?.destination || null,
      om_rate: parsePercent((selected as any)?.om_rate),
      omr_rate: parsePercent((selected as any)?.omr_rate),
      taxes_rate: parsePercent((selected as any)?.om_rate) + parsePercent((selected as any)?.omr_rate),
      source: selected?.source || null,
      note: selected?.notes || null,
      openai_enabled: Boolean((process.env.OPENAI_API_KEY || "").trim()),
    });
  } catch (e: any) {
    return json(res, 500, { ok: false, error: String(e?.message || "taxes_product_failed") });
  }
});
