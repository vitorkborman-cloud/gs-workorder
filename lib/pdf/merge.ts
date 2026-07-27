import type { jsPDF } from "jspdf";
import { PDFDocument } from "pdf-lib";

// Mescla vários documentos jsPDF (RDO + anexos de perfil de solo/físico-químico)
// num único PDF final. Primeira utilização real de pdf-lib no projeto — até
// aqui era uma dependência instalada mas nunca usada.
export async function mergeJsPdfDocs(docs: jsPDF[]): Promise<Uint8Array> {
  const merged = await PDFDocument.create();

  for (const doc of docs) {
    const bytes = doc.output("arraybuffer") as ArrayBuffer;
    const src = await PDFDocument.load(bytes);
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
  }

  return merged.save();
}
