import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker?url";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfjsWorker;

export async function extractPdfTextFromFile(file: File) {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await (pdfjsLib as any).getDocument({ data }).promise;
  const parts: string[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const strings = (content.items as any[]).map((i) => i.str).filter(Boolean);
    parts.push(strings.join(" "));
  }

  return parts.join("\n\n").trim();
}
