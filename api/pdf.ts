import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { allowCors, readJson } from "./_supabase.js";

function toText(v: any) {
  return String(v ?? "").trim();
}

export default allowCors(async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end("Method not allowed");
    return;
  }

  try {
    const payload = await readJson<any>(req);

    const title = toText(payload?.title) || "Rapport de contrôle export";
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
    page.drawText("Synthèse estimation (indicative)", { x, y, size: 12, font: bold });
    y -= 18;

    if (landed) {
      page.drawText(`Droits : ${Number(landed.duty || 0).toFixed(0)} ${landed.currency || currency}`, { x, y, size: 11, font });
      y -= 16;
      page.drawText(`Taxes : ${Number(landed.taxes || 0).toFixed(0)} ${landed.currency || currency}`, { x, y, size: 11, font });
      y -= 16;
      page.drawText(`Total : ${Number(landed.total || 0).toFixed(0)} ${landed.currency || currency}`, { x, y, size: 12, font: bold });
      y -= 18;
    } else {
      page.drawText("Aucune donnée de coût fournie.", { x, y, size: 11, font });
      y -= 16;
    }

    page.drawText("Note : ce rapport est informatif. Validation humaine recommandée.", {
      x,
      y: 60,
      size: 9,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });

    const bytes = await pdf.save();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="mpl-rapport-export.pdf"`);
    res.statusCode = 200;
    res.end(Buffer.from(bytes));
  } catch (e: any) {
    res.statusCode = 500;
    res.end(e?.message || "pdf failed");
  }
});
