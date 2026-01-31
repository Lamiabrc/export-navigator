import type { VercelRequest, VercelResponse } from "@vercel/node";
import { allowCors, json } from "./_supabase";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  allowCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const title = String(body?.title || "Rapport de contrôle export");
    const email = String(body?.email || "");
    const destination = String(body?.destination || "");
    const incoterm = String(body?.incoterm || "");
    const currency = String(body?.currency || "EUR");
    const value = body?.value != null ? String(body.value) : "";

    const landed = body?.result?.landedCost || null;

    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]); // A4
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const { height } = page.getSize();
    let y = height - 70;
    const x = 50;

    page.drawText("MPL Export Conseil", { x, y, size: 18, font: bold, color: rgb(0.1, 0.2, 0.45) });
    y -= 24;
    page.drawText(title, { x, y, size: 12, font: bold, color: rgb(0.2, 0.2, 0.2) });
    y -= 18;

    page.drawText(`Généré le : ${new Date().toLocaleString("fr-FR")}`, { x, y, size: 10, font, color: rgb(0.35, 0.35, 0.35) });
    y -= 20;

    const lines = [
      email ? `Email : ${email}` : null,
      destination ? `Destination : ${destination}` : null,
      incoterm ? `Incoterm : ${incoterm}` : null,
      value ? `Valeur : ${value} ${currency}` : null,
    ].filter(Boolean) as string[];

    lines.forEach((t) => {
      page.drawText(t, { x, y, size: 11, font, color: rgb(0.15, 0.15, 0.15) });
      y -= 16;
    });

    y -= 10;
    page.drawText("Estimation (indicative)", { x, y, size: 12, font: bold, color: rgb(0.15, 0.15, 0.15) });
    y -= 18;

    if (landed) {
      page.drawText(`Droits : ${Number(landed.duty || 0).toFixed(0)} ${landed.currency || currency}`, { x, y, size: 11, font });
      y -= 16;
      page.drawText(`Taxes : ${Number(landed.taxes || 0).toFixed(0)} ${landed.currency || currency}`, { x, y, size: 11, font });
      y -= 16;
      page.drawText(`Total : ${Number(landed.total || 0).toFixed(0)} ${landed.currency || currency}`, { x, y, size: 11, font: bold });
      y -= 16;
    } else {
      page.drawText("Aucune estimation chiffrée fournie.", { x, y, size: 11, font });
      y -= 16;
    }

    y -= 12;
    page.drawText("Important", { x, y, size: 12, font: bold, color: rgb(0.65, 0.1, 0.1) });
    y -= 16;
    page.drawText(
      "Estimation indicative. Une validation humaine est recommandée (HS exact, origine, incoterms, sanctions, licences).",
      { x, y, size: 10, font, color: rgb(0.35, 0.35, 0.35) }
    );

    const bytes = await pdf.save();

    res.status(200);
    res.setHeader("content-type", "application/pdf");
    res.setHeader("content-disposition", `attachment; filename="mpl-rapport-export.pdf"`);
    res.setHeader("cache-control", "no-store");
    res.end(Buffer.from(bytes));
  } catch (e: any) {
    return json(res, 500, { ok: false, error: e?.message || "Erreur génération PDF" });
  }
}
