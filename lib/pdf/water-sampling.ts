import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { BRAND_PURPLE, BRAND_GREEN, generateWhiteLogoBase64, drawHeaderBar, drawFooterPageNumbers } from "./brand";

export type WaterSampling = {
  data: string;
  poco: string;
  nomenclatura?: string;
  identificacao_codigo?: string;
  hora_inicio?: string;
  na_inicial?: string | number;
  na_final?: string | number;
  fase_livre?: boolean;
  espessura_fl?: string | number;
  leituras?: { horario?: string; na?: string; ph?: string; orp?: string; od?: string; condutividade?: string }[];
};

function formatDateBr(dateString: string) {
  if (!dateString) return "-";
  const [year, month, day] = dateString.split("-");
  return `${day}/${month}/${year}`;
}

export async function buildWaterSamplingPdf(input: { amostra: WaterSampling; projectName: string }): Promise<jsPDF> {
  const { amostra, projectName } = input;

  let whiteLogoBase64: string | null = null;
  try { whiteLogoBase64 = await generateWhiteLogoBase64("/logo.png"); } catch {}

  const doc = new jsPDF("p", "mm", "a4");
  const marginX = 15;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - marginX * 2;
  let currentY = 0;

  const lightGray: [number, number, number] = [245, 245, 248];

  drawHeaderBar(doc, { pageWidth, barHeight: 35, accentGreen: false, logoBase64: whiteLogoBase64, logoX: marginX, logoWidth: 35, logoHeight: 10 });

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("FICHA DE AMOSTRAGEM FÍSICO-QUÍMICA", pageWidth - marginX, 16, { align: "right" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`PROJETO: ${projectName}`, pageWidth - marginX, 23, { align: "right" });
  doc.text(`DATA: ${formatDateBr(amostra.data)}`, pageWidth - marginX, 28, { align: "right" });

  currentY = 45;

  // DADOS DO POÇO
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BRAND_PURPLE);
  doc.text("DADOS GERAIS E IDENTIFICAÇÃO", marginX, currentY);
  doc.setDrawColor(...BRAND_GREEN);
  doc.setLineWidth(0.8);
  doc.line(marginX, currentY + 2, marginX + 15, currentY + 2);
  currentY += 8;

  const boxWidth = contentWidth / 3 - 3;
  const drawBox = (x: number, y: number, label: string, value: string) => {
    doc.setFillColor(...lightGray);
    doc.roundedRect(x, y, boxWidth, 15, 1, 1, "F");
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.setFont("helvetica", "bold");
    doc.text(label.toUpperCase(), x + 3, y + 5);
    doc.setFontSize(9);
    doc.setTextColor(40);
    doc.setFont("helvetica", "bold");
    doc.text(value || "-", x + 3, y + 11);
  };

  drawBox(marginX, currentY, "Identificação do Poço", amostra.poco);
  drawBox(marginX + boxWidth + 4.5, currentY, "Nomenclatura", amostra.nomenclatura || "");
  drawBox(marginX + (boxWidth * 2) + 9, currentY, "Código da Amostra", amostra.identificacao_codigo || "");

  currentY += 19;

  drawBox(marginX, currentY, "Horário de Início", amostra.hora_inicio || "");
  drawBox(marginX + boxWidth + 4.5, currentY, "Nível D'água Inicial", `${amostra.na_inicial ?? "-"} m`);
  drawBox(marginX + (boxWidth * 2) + 9, currentY, "Nível D'água Final", `${amostra.na_final ?? "-"} m`);

  currentY += 19;

  // FASE LIVRE
  doc.setFillColor(amostra.fase_livre ? 255 : 245, amostra.fase_livre ? 235 : 245, amostra.fase_livre ? 235 : 248);
  doc.roundedRect(marginX, currentY, contentWidth, 15, 1, 1, "F");
  doc.setFontSize(8);
  doc.setTextColor(amostra.fase_livre ? 150 : 120, amostra.fase_livre ? 50 : 120, amostra.fase_livre ? 50 : 120);
  doc.text("DETECÇÃO DE FASE LIVRE (FL)", marginX + 3, currentY + 5);

  doc.setFontSize(10);
  doc.setTextColor(amostra.fase_livre ? 200 : 80, amostra.fase_livre ? 0 : 80, amostra.fase_livre ? 0 : 80);
  if (amostra.fase_livre) {
    doc.text(`SIM - Espessura: ${amostra.espessura_fl || "Não informada"} m`, marginX + 3, currentY + 11);
  } else {
    doc.text("NÃO DETECTADA", marginX + 3, currentY + 11);
  }

  currentY += 25;

  // TABELA LEITURAS
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BRAND_PURPLE);
  doc.text("PARÂMETROS DE PURGA (LEITURAS)", marginX, currentY);
  doc.setDrawColor(...BRAND_GREEN);
  doc.setLineWidth(0.8);
  doc.line(marginX, currentY + 2, marginX + 15, currentY + 2);
  currentY += 6;

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    head: [["Horário", "NA (m)", "pH", "ORP (mV)", "OD (mg/L)", "Cond. (µS/cm)"]],
    body: amostra.leituras?.map((l) => [
      l.horario || "-",
      l.na || "-",
      l.ph || "-",
      l.orp || "-",
      l.od || "-",
      l.condutividade || "-"
    ]) || [],
    theme: "striped",
    headStyles: { fillColor: BRAND_PURPLE, textColor: 255, fontStyle: "bold", fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 4, textColor: 50, halign: "center" },
    alternateRowStyles: { fillColor: [250, 250, 252] }
  });

  drawFooterPageNumbers(doc, { pageWidth });

  return doc;
}
