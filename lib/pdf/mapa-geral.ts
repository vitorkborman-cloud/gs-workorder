import { jsPDF } from "jspdf";
import proj4 from "proj4";
import { BRAND_PURPLE, BRAND_GREEN, generateWhiteLogoBase64, getLogoSize, drawHeaderBar, drawFooterPageNumbers } from "./brand";
import { DOC_CONTROL, formatDocControl } from "./doc-control";

// ── Classificação de poços por confiabilidade da coordenada ────────────────
// Histórico: antes do seletor de mapa (satélite), a captura de coordenada era
// feita por GPS do celular e frequentemente deixada em branco ou preenchida
// errado — em alguns casos com latitude/longitude direto nos campos de UTM.
// O Mapa Geral nunca deve plotar um poço nessas condições sem avisar; melhor
// listar como pendência do que arriscar mostrar num lugar errado do mapa.

export type PocoMapa = {
  id: string;
  nomenclatura: string;
  coordX: number;
  coordY: number;
  utmZona: string;
  lat: number;
  lon: number;
};

export type PocoPendente = {
  id: string;
  nomenclatura: string;
  motivo: "sem_coordenada" | "coordenada_suspeita" | "zona_ausente";
};

function nomeDoRow(row: any): string {
  return (row.nomenclatura_poco || row.nome_sondagem || "Sem identificação").trim() || "Sem identificação";
}

export function classificarPocos(rows: any[]): { validos: PocoMapa[]; pendentes: PocoPendente[] } {
  const validos: PocoMapa[] = [];
  const pendentes: PocoPendente[] = [];

  for (const row of rows) {
    const nomenclatura = nomeDoRow(row);
    const x = parseFloat(String(row.coord_x));
    const y = parseFloat(String(row.coord_y));

    if (isNaN(x) || isNaN(y)) {
      pendentes.push({ id: row.id, nomenclatura, motivo: "sem_coordenada" });
      continue;
    }
    // UTM no Brasil sempre fica na casa das centenas de milhares (X) ou
    // milhões (Y) — um valor abaixo de 1000 só pode ser latitude/longitude
    // gravada por engano no campo de UTM.
    if (Math.abs(x) < 1000 || Math.abs(y) < 1000) {
      pendentes.push({ id: row.id, nomenclatura, motivo: "coordenada_suspeita" });
      continue;
    }
    const zonaStr = String(row.utm_zona || "").trim();
    const zoneNum = parseInt(zonaStr, 10);
    if (!zonaStr || isNaN(zoneNum)) {
      pendentes.push({ id: row.id, nomenclatura, motivo: "zona_ausente" });
      continue;
    }

    const isSouth = /s/i.test(zonaStr);
    const [lon, lat] = proj4(
      `+proj=utm +zone=${zoneNum} ${isSouth ? "+south" : ""} +datum=WGS84 +units=m +no_defs`,
      "+proj=longlat +datum=WGS84 +no_defs",
      [x, y]
    );
    validos.push({ id: row.id, nomenclatura, coordX: x, coordY: y, utmZona: zonaStr, lat, lon });
  }

  return { validos, pendentes };
}

// ── PDF do Mapa Geral ───────────────────────────────────────────────────────
// A imagem do mapa (satélite + pinos + rótulos + escala do próprio Leaflet)
// já vem pronta, capturada da própria tela via html2canvas — aqui só se
// desenha a moldura: cabeçalho de marca, título, seta norte e legenda,
// no mesmo padrão dos outros documentos (RDO, Perfil de Solo).
export async function buildMapaGeralPdf(input: {
  projectName: string;
  mapImageDataUrl: string;
  mapImageAspect: number; // largura / altura da captura
  totalValidos: number;
  totalPendentes: number;
}): Promise<jsPDF> {
  const { projectName, mapImageDataUrl, mapImageAspect, totalValidos, totalPendentes } = input;

  let whiteLogo: string | null = null;
  try { whiteLogo = await generateWhiteLogoBase64("/logo.png"); } catch {}

  const doc = new jsPDF("l", "mm", "a4"); // paisagem — sites costumam ser mais largos que altos
  const marginX = 15;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const [lW, lH] = whiteLogo ? await getLogoSize(whiteLogo, 9) : [30, 9];
  const BAR_H = 30;

  drawHeaderBar(doc, { pageWidth, barHeight: BAR_H, logoBase64: whiteLogo, logoX: marginX, logoWidth: lW, logoHeight: lH });

  const rightX = pageWidth - marginX;
  doc.setFont("helvetica", "bold"); doc.setFontSize(8);
  doc.setTextColor(180, 210, 120);
  doc.text("MAPA GERAL DO SITE", rightX, 10, { align: "right" });

  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(14);
  doc.text(projectName, rightX, 19, { align: "right" });

  const badgeLabel = formatDocControl(DOC_CONTROL.mapaGeral).replace("   |   ", "  ·  ");
  doc.setFont("helvetica", "bold"); doc.setFontSize(7);
  const badgeW = doc.getTextWidth(badgeLabel) + 6;
  doc.setDrawColor(180, 210, 120); doc.setLineWidth(0.35);
  doc.roundedRect(rightX - badgeW, 23, badgeW, 5, 1.2, 1.2, "S");
  doc.setTextColor(180, 210, 120);
  doc.text(badgeLabel, rightX - badgeW / 2, 26.5, { align: "center" });

  doc.setTextColor(0, 0, 0);

  // ── Área do mapa ──────────────────────────────────────────────────────
  const LEGEND_W = 56;
  const contentTop = BAR_H + 8;
  const mapAreaW = pageWidth - marginX * 2 - LEGEND_W - 8;
  const mapAreaH = pageHeight - contentTop - 14;

  let drawW = mapAreaW, drawH = mapAreaW / mapImageAspect;
  if (drawH > mapAreaH) { drawH = mapAreaH; drawW = mapAreaH * mapImageAspect; }
  const mapX = marginX;
  const mapY = contentTop + (mapAreaH - drawH) / 2;

  doc.setDrawColor(...BRAND_PURPLE); doc.setLineWidth(0.6);
  doc.addImage(mapImageDataUrl, "JPEG", mapX, mapY, drawW, drawH);
  doc.rect(mapX, mapY, drawW, drawH, "S");

  // Seta norte — os tiles de satélite (Web Mercator) são sempre norte pra cima.
  const naX = mapX + drawW - 14, naY = mapY + 16;
  doc.setFillColor(255, 255, 255);
  doc.circle(naX, naY, 8, "F");
  doc.setDrawColor(...BRAND_PURPLE); doc.setLineWidth(0.4);
  doc.circle(naX, naY, 8, "S");
  doc.setFillColor(...BRAND_PURPLE);
  doc.triangle(naX, naY - 5.5, naX - 2.3, naY + 2, naX + 2.3, naY + 2, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(7);
  doc.setTextColor(...BRAND_PURPLE);
  doc.text("N", naX, naY + 5.8, { align: "center" });

  // ── Legenda ───────────────────────────────────────────────────────────
  const legX = mapX + drawW + 8;
  let ly = contentTop + 2;

  doc.setFillColor(...BRAND_PURPLE);
  doc.rect(legX, ly, LEGEND_W, 8, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
  doc.text("LEGENDA", legX + LEGEND_W / 2, ly + 5.5, { align: "center" });
  ly += 8;

  doc.setDrawColor(220, 220, 220); doc.setFillColor(250, 250, 250);
  doc.rect(legX, ly, LEGEND_W, 26, "FD");
  doc.setFillColor(...BRAND_PURPLE);
  doc.circle(legX + 7, ly + 9, 2.2, "F");
  doc.setFillColor(255, 255, 255);
  doc.circle(legX + 7, ly + 9, 0.9, "F");
  doc.setTextColor(60, 60, 60); doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  doc.text("Poço / Perfil", legX + 12, ly + 7.5);
  doc.text("Descritivo", legX + 12, ly + 10.8);

  doc.setDrawColor(220, 220, 220); doc.line(legX + 3, ly + 15.5, legX + LEGEND_W - 3, ly + 15.5);

  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(...BRAND_GREEN);
  doc.text(String(totalValidos), legX + 7, ly + 22, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(100, 100, 100);
  doc.text("plotado" + (totalValidos === 1 ? "" : "s"), legX + 16, ly + 22);
  ly += 30;

  if (totalPendentes > 0) {
    doc.setDrawColor(220, 190, 160); doc.setFillColor(253, 246, 238);
    doc.rect(legX, ly, LEGEND_W, 20, "FD");
    doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(168, 92, 46);
    doc.text(String(totalPendentes), legX + 7, ly + 9, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(140, 90, 60);
    const pendLabel = totalPendentes === 1 ? "poço sem" : "poços sem";
    doc.text(pendLabel, legX + 16, ly + 7.5);
    doc.text("coordenada válida", legX + 3, ly + 15.5);
    ly += 24;
  }

  doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); doc.setTextColor(150, 150, 150);
  const escalaTxt = doc.splitTextToSize("Escala gráfica no canto inferior do mapa.", LEGEND_W);
  doc.text(escalaTxt, legX, ly + 4);

  drawFooterPageNumbers(doc, { pageWidth, y: pageHeight - 6, align: "right", marginX });
  doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(150);
  doc.text("GreenSoil do Brasil LTDA · Documento gerado eletronicamente", marginX, pageHeight - 6);

  return doc;
}
