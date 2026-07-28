import type { jsPDF } from "jspdf";
import { PDFDocument } from "pdf-lib";

type PdfSource = jsPDF | Uint8Array | ArrayBuffer;

function isJsPdf(src: PdfSource): src is jsPDF {
  return typeof (src as jsPDF).output === "function";
}

// Mescla várias fontes de PDF (capa gerada com pdf-lib, RDO e anexos de
// perfil de solo/físico-químico gerados com jsPDF) num único PDF final.
export async function mergePdfSources(sources: PdfSource[]): Promise<Uint8Array> {
  const merged = await PDFDocument.create();

  for (const source of sources) {
    const bytes = isJsPdf(source) ? (source.output("arraybuffer") as ArrayBuffer) : source;
    const src = await PDFDocument.load(bytes);
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
  }

  return merged.save();
}
