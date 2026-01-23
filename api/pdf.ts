import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

function safeJson(req: VercelRequest) {
  if (!req.body) return null;
  return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const payload = safeJson(req) || {};
  const title = String(payload.title || "Rapport export");

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  const drawText = (text: string, x: number, y: number, size = 12, color = rgb(0.1, 0.15, 0.25)) => {
    page.drawText(text, { x, y, size, font, color });
  };

  drawText("MPL Conseil Export", 40, 800, 16, rgb(0.07, 0.18, 0.37));
  drawText(title, 40, 770, 14);

  const lines: string[] = [];
  if (payload.destination) lines.push(`Destination: ${payload.destination}`);
  if (payload.incoterm) lines.push(`Incoterm: ${payload.incoterm}`);
  if (payload.value && payload.currency) lines.push(`Valeur: ${payload.value} ${payload.currency}`);
  if (payload.score) lines.push(`Score conformite: ${payload.score}/100`);

  let y = 730;
  for (const line of lines) {
    drawText(line, 40, y, 11);
    y -= 18;
  }

  if (payload.result?.landedCost) {
    y -= 10;
    drawText("Estimation landed cost", 40, y, 12, rgb(0.1, 0.1, 0.4));
    y -= 18;
    drawText(`Duty estime: ${payload.result.landedCost.duty?.toFixed?.(0) ?? payload.result.landedCost.duty}`, 40, y, 11);
    y -= 16;
    drawText(`Taxes estimees: ${payload.result.landedCost.taxes?.toFixed?.(0) ?? payload.result.landedCost.taxes}`, 40, y, 11);
    y -= 16;
    drawText(`Total: ${payload.result.landedCost.total?.toFixed?.(0) ?? payload.result.landedCost.total} ${payload.result.landedCost.currency}`, 40, y, 11);
  }

  if (Array.isArray(payload.lines)) {
    y -= 24;
    drawText("Lignes facture", 40, y, 12, rgb(0.1, 0.1, 0.4));
    y -= 18;
    payload.lines.slice(0, 10).forEach((l: any) => {
      const row = `${l.description || ""} | qty ${l.qty || 0} | ${l.price || 0} | HS ${l.hs || ""}`;
      drawText(row, 40, y, 10);
      y -= 14;
    });
  }

  const pdfBytes = await pdf.save();

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=mpl-rapport-export.pdf");
  return res.status(200).send(Buffer.from(pdfBytes));
}
