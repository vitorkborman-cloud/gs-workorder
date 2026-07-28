import { PDFDocument, PDFFont, StandardFonts, rgb } from "pdf-lib";

// Capa do RDO = o template desenhado pelo usuário no Canva
// (public/rdo-cover-template.pdf, A4 — 595.5 x 842.2 pt), com dois campos
// escritos por cima via pdf-lib: o nome do projeto (ao lado do ícone de
// prancheta) e o período abreviado (ao lado do ícone de calendário).
// Coordenadas medidas renderizando o próprio template e conferindo
// visualmente onde cada pílula/ícone cai na página.
const TEMPLATE_URL = "/rdo-cover-template.pdf";

const GREEN = rgb(128 / 255, 176 / 255, 45 / 255);

const PROJETO_FIELD = { x: 145, y: 213, maxWidth: 175, startSize: 18, minSize: 10 };
const PERIODO_FIELD = { x: 145, y: 73, size: 20 };

export function formatPeriodoAbreviado(dateStr: string): string {
  if (!dateStr) return "—";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  return `${d}/${m}/${y.slice(-2)}`;
}

function fitFontSize(text: string, font: PDFFont, maxWidth: number, startSize: number, minSize: number): number {
  let size = startSize;
  while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 0.5;
  }
  return size;
}

export async function buildRdoCoverBytes(input: { projectName: string; periodo: string }): Promise<Uint8Array> {
  const resp = await fetch(TEMPLATE_URL);
  const templateBytes = await resp.arrayBuffer();

  const pdfDoc = await PDFDocument.load(templateBytes);
  const page = pdfDoc.getPages()[0];
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const projectText = input.projectName || "—";
  const projSize = fitFontSize(projectText, font, PROJETO_FIELD.maxWidth, PROJETO_FIELD.startSize, PROJETO_FIELD.minSize);
  page.drawText(projectText, { x: PROJETO_FIELD.x, y: PROJETO_FIELD.y, size: projSize, font, color: GREEN });

  page.drawText(input.periodo, { x: PERIODO_FIELD.x, y: PERIODO_FIELD.y, size: PERIODO_FIELD.size, font, color: GREEN });

  return pdfDoc.save();
}
