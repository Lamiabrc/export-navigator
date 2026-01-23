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
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const drawText = (
    text: string,
    x: number,
    y: number,
    size = 12,
    color = rgb(0.1, 0.15, 0.25),
    bold = false,
  ) => {
    page.drawText(text, { x, y, size, font: bold ? fontBold : font, color });
  };

  page.drawRectangle({ x: 0, y: 815, width: 595, height: 27, color: rgb(0.1, 0.2, 0.45) });
  page.drawRectangle({ x: 0, y: 812, width: 595, height: 3, color: rgb(0.85, 0.12, 0.12) });
  drawText("MPL Conseil Export", 40, 822, 12, rgb(1, 1, 1), true);
  drawText(title, 40, 785, 16, rgb(0.07, 0.18, 0.37), true);
  drawText(`Genere le ${new Date().toLocaleDateString("fr-FR")}`, 40, 768, 10, rgb(0.4, 0.45, 0.55));

  const lines: string[] = [];
  if (payload.destination) lines.push(`Destination: ${payload.destination}`);
  if (payload.incoterm) lines.push(`Incoterm: ${payload.incoterm}`);
  if (payload.value && payload.currency) lines.push(`Valeur: ${payload.value} ${payload.currency}`);
  if (payload.score) lines.push(`Score conformite: ${payload.score}/100`);

  let y = 740;
  page.drawRectangle({ x: 40, y: y - 6, width: 515, height: 70, borderWidth: 1, borderColor: rgb(0.85, 0.88, 0.92) });
  drawText("Contexte", 48, y + 50, 11, rgb(0.1, 0.2, 0.4), true);
  y += 32;
  for (const line of lines) {
    drawText(line, 48, y, 11);
    y -= 16;
  }

  if (payload.result?.landedCost) {
    y -= 24;
    drawText("Estimation landed cost", 40, y, 12, rgb(0.1, 0.1, 0.4), true);
    y -= 20;
    drawText(
      `Duty estime: ${payload.result.landedCost.duty?.toFixed?.(0) ?? payload.result.landedCost.duty}`,
      40,
      y,
      11,
    );
    y -= 16;
    drawText(
      `Taxes estimees: ${payload.result.landedCost.taxes?.toFixed?.(0) ?? payload.result.landedCost.taxes}`,
      40,
      y,
      11,
    );
    y -= 16;
    drawText(
      `Total: ${payload.result.landedCost.total?.toFixed?.(0) ?? payload.result.landedCost.total} ${payload.result.landedCost.currency}`,
      40,
      y,
      11,
      rgb(0.1, 0.2, 0.35),
      true,
    );
  }

  if (Array.isArray(payload.lines)) {
    y -= 24;
    drawText("Lignes facture", 40, y, 12, rgb(0.1, 0.1, 0.4), true);
    y -= 18;
    payload.lines.slice(0, 10).forEach((l: any) => {
      const row = `${l.description || ""} | qty ${l.qty || 0} | ${l.price || 0} | HS ${l.hs || ""}`;
      drawText(row, 40, y, 10);
      y -= 14;
    });
  }

  y -= 24;
  drawText("Disclaimer", 40, y, 11, rgb(0.4, 0.45, 0.55), true);
  y -= 14;
  drawText("Estimation indicative. A valider avec les sources officielles et votre declarant.", 40, y, 9, rgb(0.45, 0.5, 0.6));

  const pdfBytes = await pdf.save();

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=mpl-rapport-export.pdf");
  return res.status(200).send(Buffer.from(pdfBytes));
}
