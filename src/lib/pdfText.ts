import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker?url";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfjsWorker;

export async function extractPdfTextFromFile(file: File): Promise<string> {
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = (pdfjsLib as any).getDocument({ data });
  const pdf = await loadingTask.promise;

  const parts: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const strings = (content.items as any[]).map((it) => it.str).filter(Boolean);
    parts.push(strings.join(" "));
  }
  return parts.join("\n\n").trim();
}
