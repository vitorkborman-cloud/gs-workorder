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
//
// A grade só é pintada em opacidade cheia perto de onde há poço amostrado;
// além do raio de alcance (distância média entre vizinhos × 1.6) a cor
// esmaece até ficar transparente — ver fatorEsmaecimento em
// gradeParaCanvas. Isso evita pintar uma "caixa" opaca sobre área sem
// nenhum dado de apoio, mas ainda não corta a pluma numa forma "orgânica"
// de verdade (isso pediria delimitar pelo fluxo real de água subterrânea).

export type PontoPluma = { x: number; y: number; valor: number };

export type GradeIDW = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  cols: number;
  rows: number;
  valores: Float32Array; // row-major, j=0 é a linha de menor Y (sul)
  distanciasMin: Float32Array; // distância (m) até o poço amostrado mais próximo, mesmo indexamento de `valores`
  raioAlcance: number; // distância (m) até onde a estimativa tem apoio de dado — além disso, a pluma esmaece
};

// Espaçamento típico entre poços vizinhos — usado como régua pra decidir até
// onde a pluma tem apoio de dado real antes de começar a esmaecer (ver
// gradeParaCanvas). Sem isso, o IDW pinta com a mesma opacidade até a borda
// da grade, inclusive sobre área sem nenhum poço por perto — o efeito de
// "caixa dura" que fica com cara de esboço, não de mapa de pluma.
function distanciaMediaVizinhoMaisProximo(pontos: PontoPluma[]): number {
  if (pontos.length < 2) return 1;
  let soma = 0;
  for (const p of pontos) {
    let menor = Infinity;
    for (const q of pontos) {
      if (p === q) continue;
      const d = Math.hypot(p.x - q.x, p.y - q.y);
      if (d < menor) menor = d;
    }
    soma += menor;
  }
  return soma / pontos.length;
}

export function interpolarIDW(
  pontos: PontoPluma[],
  opts: { potencia?: number; resolucaoCols?: number; margem?: number } = {}
): GradeIDW | null {
  if (pontos.length < 2) return null;
  const potencia = opts.potencia ?? 2;
  const resolucaoCols = opts.resolucaoCols ?? 160;
  const margem = opts.margem ?? 0.25;

  let minX = Math.min(...pontos.map((p) => p.x));
  let maxX = Math.max(...pontos.map((p) => p.x));
  let minY = Math.min(...pontos.map((p) => p.y));
  let maxY = Math.max(...pontos.map((p) => p.y));

  const raioAlcance = distanciaMediaVizinhoMaisProximo(pontos) * 1.6;

  // A margem da grade precisa caber o esmaecimento inteiro (até
  // raioAlcance × 2.2, ver gradeParaCanvas) — senão o degradê é cortado
  // pela borda retangular da própria imagem antes de chegar a transparente,
  // e o efeito de "caixa dura" continua aparecendo mesmo com o esmaecimento
  // implementado. Usa o maior entre a margem proporcional e esse raio.
  const larguraBase = Math.max(maxX - minX, 1);
  const alturaBase = Math.max(maxY - minY, 1);
  const padX = Math.max(larguraBase * margem, raioAlcance * 2.3);
  const padY = Math.max(alturaBase * margem, raioAlcance * 2.3);
  minX -= padX;
  maxX += padX;
  minY -= padY;
  maxY += padY;

  const largura = maxX - minX;
  const altura = maxY - minY;
  const cols = resolucaoCols;
  const rows = Math.max(1, Math.round(cols * (altura / largura)));

  const valores = new Float32Array(cols * rows);
  const distanciasMin = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    const y = minY + (altura * (j + 0.5)) / rows;
    for (let i = 0; i < cols; i++) {
      const x = minX + (largura * (i + 0.5)) / cols;
      let somaPesos = 0;
      let somaValores = 0;
      let exato: number | null = null;
      let distMin = Infinity;
      for (const p of pontos) {
        const dx = p.x - x;
        const dy = p.y - y;
        const distSq = dx * dx + dy * dy;
        if (distSq < distMin) distMin = distSq;
        if (distSq < 1e-4) {
          exato = p.valor;
          continue;
        }
        const peso = 1 / Math.pow(distSq, potencia / 2);
        somaPesos += peso;
        somaValores += peso * p.valor;
      }
      const idx = j * cols + i;
      valores[idx] = exato !== null ? exato : somaValores / somaPesos;
      distanciasMin[idx] = Math.sqrt(distMin);
    }
  }

  return { minX, minY, maxX, maxY, cols, rows, valores, distanciasMin, raioAlcance };
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

// Esmaecimento por distância: dentro do raio de alcance a pluma fica na
// opacidade cheia; a partir daí cai linearmente até ficar 100% transparente
// em 2.2x o raio. É o que evita a "caixa dura" — a pluma passa a acompanhar
// o formato real da nuvem de poços em vez de pintar o retângulo inteiro.
function fatorEsmaecimento(distancia: number, raioAlcance: number): number {
  if (distancia <= raioAlcance) return 1;
  const raioTransparente = raioAlcance * 2.2;
  if (distancia >= raioTransparente) return 0;
  return 1 - (distancia - raioAlcance) / (raioTransparente - raioAlcance);
}

// Rasteriza a grade IDW num canvas colorido por faixa, pronto pra virar
// L.imageOverlay no Leaflet. Linha 0 do canvas = topo da imagem = maior Y
// (norte) — a grade guarda j=0 como o sul, por isso a inversão de linha.
export function gradeParaCanvas(grade: GradeIDW, faixas: FaixaPluma[], opacidade = 0.65): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = grade.cols;
  canvas.height = grade.rows;
  const ctx = canvas.getContext("2d")!;
  const imgData = ctx.createImageData(grade.cols, grade.rows);

  for (let j = 0; j < grade.rows; j++) {
    const destJ = grade.rows - 1 - j;
    for (let i = 0; i < grade.cols; i++) {
      const idx = j * grade.cols + i;
      const valor = grade.valores[idx];
      const [r, g, b] = hexParaRgb(corParaValor(valor, faixas));
      const alpha = Math.round(opacidade * fatorEsmaecimento(grade.distanciasMin[idx], grade.raioAlcance) * 255);
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
