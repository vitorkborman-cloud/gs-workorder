import proj4 from "proj4";

// Interpolação de pluma de contaminação a partir de concentrações pontuais
// nos poços — base de literatura em docs/CONTROLE_DOCUMENTOS.md (ver
// artigos filtrados de geoestatística/interpolação espacial).
//
// Método escolhido: IDW (inverse-distance weighting), não krigagem
// completa. A krigagem geralmente pede ~30+ pontos pra ajustar um
// variograma confiável; com ~10-24 poços por contaminante/rodada (o real
// deste projeto) não há amostra suficiente pra isso ser mais que um ajuste
// artificial. IDW é determinístico, não precisa de variograma, e aparece
// como método padrão em vários dos artigos de comparação da base filtrada
// (ex. "Screening and optimization of interpolation methods for mapping
// soil-borne polychlorinated biphenyls"; "Improved three-dimensional
// mapping of soil chromium pollution... IDW-based interpolation").
//
// Limitação conhecida (registrada, não escondida): IDW é isotrópico — não
// sabe que uma pluma real se alonga na direção do fluxo de água
// subterrânea (ver artigos de "flow guided/flow coordinate kriging" na
// mesma base). Não modelamos direção de fluxo aqui; a pluma desenhada é uma
// aproximação por distância, não uma simulação hidrogeológica.

export type PontoPluma = { x: number; y: number; valor: number };

export type GradeIDW = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  cols: number;
  rows: number;
  valores: Float32Array; // row-major, j=0 é a linha de menor Y (sul)
};

export function interpolarIDW(
  pontos: PontoPluma[],
  opts: { potencia?: number; resolucaoCols?: number; margem?: number } = {}
): GradeIDW | null {
  if (pontos.length < 2) return null;
  const potencia = opts.potencia ?? 2;
  const resolucaoCols = opts.resolucaoCols ?? 140;
  const margem = opts.margem ?? 0.25;

  let minX = Math.min(...pontos.map((p) => p.x));
  let maxX = Math.max(...pontos.map((p) => p.x));
  let minY = Math.min(...pontos.map((p) => p.y));
  let maxY = Math.max(...pontos.map((p) => p.y));

  const larguraBase = Math.max(maxX - minX, 1);
  const alturaBase = Math.max(maxY - minY, 1);
  const padX = larguraBase * margem;
  const padY = alturaBase * margem;
  minX -= padX;
  maxX += padX;
  minY -= padY;
  maxY += padY;

  const largura = maxX - minX;
  const altura = maxY - minY;
  const cols = resolucaoCols;
  const rows = Math.max(1, Math.round(cols * (altura / largura)));

  const valores = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    const y = minY + (altura * (j + 0.5)) / rows;
    for (let i = 0; i < cols; i++) {
      const x = minX + (largura * (i + 0.5)) / cols;
      let somaPesos = 0;
      let somaValores = 0;
      let exato: number | null = null;
      for (const p of pontos) {
        const dx = p.x - x;
        const dy = p.y - y;
        const distSq = dx * dx + dy * dy;
        if (distSq < 1e-4) {
          exato = p.valor;
          break;
        }
        const peso = 1 / Math.pow(distSq, potencia / 2);
        somaPesos += peso;
        somaValores += peso * p.valor;
      }
      valores[j * cols + i] = exato !== null ? exato : somaValores / somaPesos;
    }
  }

  return { minX, minY, maxX, maxY, cols, rows, valores };
}

// ── Classificação por faixa (cor = severidade, não identidade — paleta de
// status fixa, nunca reaproveitada pra outra coisa; ver dataviz skill) ────

export type FaixaPluma = { label: string; cor: string; min: number; max: number | null };

const STATUS_BOM = "#0ca30c";
const STATUS_ATENCAO = "#fab219";
const STATUS_GRAVE = "#ec835a";
const STATUS_CRITICO = "#d03b3b";
// Rampa sequencial de um hue só (azul), usada só quando não há CMA pra
// classificar por excedência — mesma família da paleta categórica validada
// já usada no Mapa Geral (ver lib/pdf/mapa-geral.ts).
const SEQ_AZUL = ["#cde2fb", "#86b6ef", "#3987e5", "#1c5cab"];

function formatNum(n: number): string {
  if (n >= 100) return n.toFixed(0);
  if (n >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

export function construirFaixas(cma: number | null, valorMax: number): FaixaPluma[] {
  if (cma && cma > 0) {
    return [
      { label: `Até ${formatNum(cma)} — dentro da CMA`, cor: STATUS_BOM, min: 0, max: cma },
      { label: `${formatNum(cma)}–${formatNum(cma * 2)} — 1-2x CMA`, cor: STATUS_ATENCAO, min: cma, max: cma * 2 },
      { label: `${formatNum(cma * 2)}–${formatNum(cma * 5)} — 2-5x CMA`, cor: STATUS_GRAVE, min: cma * 2, max: cma * 5 },
      { label: `Acima de ${formatNum(cma * 5)} — >5x CMA`, cor: STATUS_CRITICO, min: cma * 5, max: null },
    ];
  }
  const passo = valorMax / SEQ_AZUL.length || 1;
  return SEQ_AZUL.map((cor, i) => ({
    label: i === SEQ_AZUL.length - 1 ? `Acima de ${formatNum(passo * i)}` : `${formatNum(passo * i)}–${formatNum(passo * (i + 1))}`,
    cor,
    min: passo * i,
    max: i === SEQ_AZUL.length - 1 ? null : passo * (i + 1),
  }));
}

export function corParaValor(valor: number, faixas: FaixaPluma[]): string {
  for (const f of faixas) {
    if (valor >= f.min && (f.max === null || valor < f.max)) return f.cor;
  }
  return faixas[faixas.length - 1]?.cor ?? "#888";
}

function hexParaRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Rasteriza a grade IDW num canvas colorido por faixa, pronto pra virar
// L.imageOverlay no Leaflet. Linha 0 do canvas = topo da imagem = maior Y
// (norte) — a grade guarda j=0 como o sul, por isso a inversão de linha.
export function gradeParaCanvas(grade: GradeIDW, faixas: FaixaPluma[], opacidade = 0.6): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = grade.cols;
  canvas.height = grade.rows;
  const ctx = canvas.getContext("2d")!;
  const imgData = ctx.createImageData(grade.cols, grade.rows);
  const alpha = Math.round(opacidade * 255);

  for (let j = 0; j < grade.rows; j++) {
    const destJ = grade.rows - 1 - j;
    for (let i = 0; i < grade.cols; i++) {
      const valor = grade.valores[j * grade.cols + i];
      const [r, g, b] = hexParaRgb(corParaValor(valor, faixas));
      const pixelIdx = (destJ * grade.cols + i) * 4;
      imgData.data[pixelIdx] = r;
      imgData.data[pixelIdx + 1] = g;
      imgData.data[pixelIdx + 2] = b;
      imgData.data[pixelIdx + 3] = alpha;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

export function utmParaLatLon(x: number, y: number, utmZona: string): [number, number] {
  const zoneNum = parseInt(utmZona, 10);
  const isSouth = /s/i.test(utmZona);
  const [lon, lat] = proj4(
    `+proj=utm +zone=${zoneNum} ${isSouth ? "+south" : ""} +datum=WGS84 +units=m +no_defs`,
    "+proj=longlat +datum=WGS84 +no_defs",
    [x, y]
  );
  return [lat, lon];
}
