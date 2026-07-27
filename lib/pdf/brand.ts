import type { jsPDF } from "jspdf";

// Cores de marca GreenSoil, antes duplicadas em cada gerador de PDF.
export const BRAND_PURPLE: [number, number, number] = [57, 30, 42];
export const BRAND_GREEN: [number, number, number] = [128, 176, 45];

export async function generateWhiteLogoBase64(src: string = "/logo.png"): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Erro no canvas")); return; }
      ctx.drawImage(img, 0, 0);
      ctx.filter = "brightness(0) invert(1)";
      ctx.drawImage(canvas, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

// Calcula a largura do logo mantendo a proporção original para uma altura alvo (mm).
export function getLogoSize(base64: string, targetHeight: number): Promise<[number, number]> {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res([(img.width / img.height) * targetHeight, targetHeight]);
    img.onerror = () => res([targetHeight * 3.3, targetHeight]);
    img.src = base64;
  });
}

/**
 * Desenha a barra de cabeçalho roxa (+ faixa verde opcional) e o logo branco.
 * Não escreve título/subtítulo — cada documento mantém seu próprio texto de cabeçalho,
 * já que o layout textual varia levemente entre RDO/perfil de solo/físico-químico hoje.
 */
export function drawHeaderBar(doc: jsPDF, opts: {
  pageWidth: number;
  barHeight?: number;
  accentGreen?: boolean;
  logoBase64?: string | null;
  logoX: number;
  logoWidth?: number;
  logoHeight?: number;
}) {
  const barHeight = opts.barHeight ?? 34;
  const logoHeight = opts.logoHeight ?? 10;
  const logoWidth = opts.logoWidth ?? logoHeight * 3.3;

  doc.setFillColor(...BRAND_PURPLE);
  doc.rect(0, 0, opts.pageWidth, barHeight, "F");

  if (opts.accentGreen !== false) {
    doc.setFillColor(...BRAND_GREEN);
    doc.rect(0, barHeight, opts.pageWidth, 2, "F");
  }

  if (opts.logoBase64) {
    try {
      doc.addImage(opts.logoBase64, "PNG", opts.logoX, (barHeight - logoHeight) / 2, logoWidth, logoHeight);
    } catch {
      // logo é decorativo — segue sem quebrar a geração do documento
    }
  }

  doc.setTextColor(0, 0, 0);
}

/**
 * Numeração de rodapé padrão ("Documento gerado eletronicamente - Página X de Y").
 * `fromPage` permite pular a numeração da capa (usado hoje só pelo Work Order legado).
 */
export function drawFooterPageNumbers(doc: jsPDF, opts: {
  pageWidth: number;
  y?: number;
  fromPage?: number;
  label?: string;
  align?: "center" | "right";
  marginX?: number;
}) {
  const totalPages = (doc as any).internal.getNumberOfPages();
  const y = opts.y ?? 290;
  const fromPage = opts.fromPage ?? 1;
  const align = opts.align ?? "center";
  const label = opts.label ?? "Documento gerado eletronicamente";

  for (let i = fromPage; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(align === "right" ? 8 : 7);
    doc.setTextColor(align === "right" ? 150 : 180);
    const text = align === "right" ? `Página ${i} de ${totalPages}` : `${label} - Página ${i} de ${totalPages}`;
    const x = align === "right" ? opts.pageWidth - (opts.marginX ?? 20) : opts.pageWidth / 2;
    doc.text(text, x, y, { align });
  }
}
