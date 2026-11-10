import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/lib/supabase";
import { BRAND_PURPLE, BRAND_GREEN, generateWhiteLogoBase64, getLogoSize, drawHeaderBar, drawFooterPageNumbers } from "./brand";
import { buildRdoCoverBytes, formatPeriodoAbreviado } from "./cover";
import { mergePdfSources } from "./merge";
import { DOC_CONTROL, formatDocControl } from "./doc-control";
import { buildRdoPdf, type RdoReport } from "./rdo";
import {
  buscarAnteriores,
  calcularDia,
  agruparPorGrupo,
  formatNumero,
  formatDataBr,
  STATUS_CONCLUIDO,
  type RdoV2,
} from "@/lib/rdo/v2";

/** Escolhe o gerador pelo formato gravado no RDO ('v1' = layout antigo). */
export async function buildRdoPdfAuto(input: {
  rdo: any;
  projectName: string;
  projectId?: string;
}): Promise<Uint8Array> {
  if (input.rdo?.formato === "v2") {
    return buildRdoV2Pdf({
      rdo: input.rdo,
      projectName: input.projectName,
      projectId: input.projectId ?? input.rdo.project_id,
      rdoId: input.rdo.id,
    });
  }
  return buildRdoPdf({ rdo: input.rdo as RdoReport, projectName: input.projectName });
}

export async function buildRdoV2Pdf(input: {
  rdo: RdoV2;
  projectName: string;
  projectId: string;
  rdoId?: string;
}): Promise<Uint8Array> {
  const { rdo, projectName, projectId, rdoId } = input;

  let whiteLogo: string | null = null;
  try { whiteLogo = await generateWhiteLogoBase64("/logo.png"); } catch {}

  const anteriores = await buscarAnteriores(projectId, rdo.data, rdoId);

  const doc = new jsPDF("p", "mm", "a4");
  const marginX = 15;
  const pageWidth = doc.internal.pageSize.getWidth();
  const cW = pageWidth - marginX * 2;
  let y = 0;

  const [lW, lH] = whiteLogo ? await getLogoSize(whiteLogo, 10) : [33, 10];

  const BAR_H = 38;
  const headered = new Set<number>();
  const header = () => {
    headered.add(doc.getCurrentPageInfo().pageNumber);
    drawHeaderBar(doc, { pageWidth, barHeight: BAR_H, logoBase64: whiteLogo, logoX: marginX, logoWidth: lW, logoHeight: lH });

    doc.setFillColor(...BRAND_GREEN);
    doc.rect(0, 0, 2.2, BAR_H, "F");

    const rightX = pageWidth - marginX;

    doc.setFont("helvetica", "bold"); doc.setFontSize(8);
    doc.setTextColor(180, 210, 120);
    doc.text("RELATÓRIO DIÁRIO DE OBRA", rightX, 11, { align: "right" });

    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold");
    let titleSize = 15;
    doc.setFontSize(titleSize);
    const maxTitleW = pageWidth - marginX * 2 - lW - 6;
    while (titleSize > 10 && doc.getTextWidth(projectName) > maxTitleW) {
      titleSize -= 0.5;
      doc.setFontSize(titleSize);
    }
    doc.text(projectName, rightX, 21, { align: "right" });

    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    doc.setTextColor(230, 230, 235);
    const dateLabel = `Data: ${formatDataBr(rdo.data)}`;
    doc.text(dateLabel, rightX, 30, { align: "right" });
    const dateW = doc.getTextWidth(dateLabel);

    const badgeLabel = formatDocControl(DOC_CONTROL.rdoSimplificado).replace("   |   ", "  ·  ");
    doc.setFont("helvetica", "bold"); doc.setFontSize(7);
    const badgeW = doc.getTextWidth(badgeLabel) + 6;
    const badgeH = 5.2;
    const badgeX = rightX - dateW - 6 - badgeW;
    const badgeY = 30 - badgeH + 1.6;
    doc.setDrawColor(180, 210, 120); doc.setLineWidth(0.35);
    doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 1.3, 1.3, "S");
    doc.setTextColor(180, 210, 120);
    doc.text(badgeLabel, badgeX + badgeW / 2, badgeY + badgeH / 2 + 1, { align: "center" });

    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
  };

  const CONTENT_START_Y = BAR_H + 14;
  const chk = (n: number) => {
    if (y + n > 275) { doc.addPage(); header(); y = CONTENT_START_Y; }
  };

  const sec = (title: string) => {
    chk(24);
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...BRAND_PURPLE);
    doc.text(title.toUpperCase(), marginX, y);
    doc.setDrawColor(...BRAND_GREEN); doc.setLineWidth(0.8);
    doc.line(marginX, y + 2, marginX + 15, y + 2);
    y += 8;
  };

  const tbl: any = {
    margin: { left: marginX, right: marginX, top: CONTENT_START_Y },
    styles: { fontSize: 8, cellPadding: 2.6 },
    headStyles: { fillColor: BRAND_PURPLE, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [252, 252, 252] },
    // Páginas criadas pela quebra automática da tabela também levam o cabeçalho.
    didDrawPage: (d: any) => { if (!headered.has(d.pageNumber)) header(); },
  };

  const afterTable = (gap = 10) => { y = (doc as any).lastAutoTable.finalY + gap; };

  header(); y = CONTENT_START_Y;

  // ── Resumo ───────────────────────────────────────────────────────────────
  const equipe = (rdo.equipe || []).filter(Boolean);
  const resumo = [
    { label: "PREENCHIDO POR", val: rdo.preenchido_por || "—" },
    { label: "EQUIPE EM CAMPO", val: equipe.length ? equipe.join(", ") : "—" },
  ];
  const colW = cW / 2 - 2;
  doc.setFont("helvetica", "bold"); doc.setFontSize(9);
  const linhas = resumo.map((c) => doc.splitTextToSize(c.val, colW - 8).slice(0, 3) as string[]);
  const boxH = 12 + Math.max(...linhas.map((l) => l.length)) * 4.4;
  resumo.forEach((c, i) => {
    const x = marginX + i * (colW + 4);
    doc.setFillColor(248, 248, 250); doc.roundedRect(x, y, colW, boxH, 1, 1, "F");
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(100);
    doc.text(c.label, x + 4, y + 6);
    doc.setFontSize(9); doc.setTextColor(...BRAND_PURPLE); doc.setFont("helvetica", "bold");
    doc.text(linhas[i], x + 4, y + 12);
  });
  y += boxH + 10;

  // ── Atividades fixas ─────────────────────────────────────────────────────
  const fixas = rdo.atividades_fixas || [];
  if (fixas.length > 0) {
    sec("Atividades Fixas");
    autoTable(doc, {
      ...tbl, startY: y,
      head: [["Atividade", "Realizado", "Observação"]],
      body: fixas.map((a) => [a.nome, a.realizado ? "Sim" : "Não", a.obs || "-"]),
      columnStyles: { 1: { halign: "center", cellWidth: 24 } },
      didParseCell: (d: any) => {
        if (d.section === "body" && d.column.index === 1) {
          d.cell.styles.fontStyle = "bold";
          d.cell.styles.textColor = String(d.cell.raw) === "Sim" ? [0, 140, 0] : [190, 40, 40];
        }
      },
    });
    afterTable();
  }

  // ── Leituras ─────────────────────────────────────────────────────────────
  const leituras = rdo.leituras || [];
  if (leituras.length > 0) {
    sec("Leituras de Instrumentos");
    const body: any[] = [];
    for (const g of agruparPorGrupo(leituras)) {
      body.push([{ content: g.grupo, colSpan: 5, styles: { fillColor: [235, 240, 225], fontStyle: "bold", textColor: BRAND_PURPLE } }]);
      for (const l of g.itens) {
        const ant = anteriores[l.instrumento_id];
        const dia = calcularDia(l.tipo, l.valor, ant?.valor);
        const leitura = l.valor === null ? (l.nao_coletado ? "Não coletado" : "—") : `${formatNumero(l.valor)} ${l.unidade}`.trim();
        const anterior = ant ? `${formatNumero(ant.valor)} ${l.unidade}`.trim() : "—";
        let diaTxt = "—";
        if (dia) {
          diaTxt = `${dia.rotulo}: ${formatNumero(dia.valor)} ${l.unidade}`.trim();
          if (dia.alerta) diaTxt += " (!)";
        }
        body.push([l.nome, leitura, anterior, ant ? formatDataBr(ant.data) : "—", diaTxt]);
      }
    }
    autoTable(doc, {
      ...tbl, startY: y,
      head: [["Instrumento", "Leitura", "Anterior", "Data ant.", "Do dia"]],
      body,
      columnStyles: { 1: { halign: "right", fontStyle: "bold" }, 2: { halign: "right" }, 3: { halign: "center", cellWidth: 22 } },
      didParseCell: (d: any) => {
        if (d.section === "body" && d.column.index === 1 && String(d.cell.raw) === "Não coletado") {
          d.cell.styles.textColor = [150, 150, 150];
          d.cell.styles.fontStyle = "italic";
        }
      },
    });
    afterTable();
  }

  // ── Atividades do dia ────────────────────────────────────────────────────
  const atividades = (rdo.atividades || []).filter((a) => a.atividade?.trim());
  if (atividades.length > 0) {
    sec("Atividades do Dia");
    autoTable(doc, {
      ...tbl, startY: y,
      head: [["Atividade", "Responsável", "Status", "Observações"]],
      body: atividades.map((a) => [
        a.atividade,
        (a.responsaveis || []).join(", ") || "-",
        a.status || "-",
        a.obs || "-",
      ]),
      columnStyles: { 2: { cellWidth: 28 } },
      didParseCell: (d: any) => {
        if (d.section === "body" && d.column.index === 2) {
          d.cell.styles.fontStyle = "bold";
          d.cell.styles.textColor = String(d.cell.raw) === STATUS_CONCLUIDO ? [0, 140, 0] : [200, 120, 0];
        }
      },
    });
    afterTable();
  }

  // ── Ocorrências ──────────────────────────────────────────────────────────
  sec("Ocorrências");
  autoTable(doc, {
    ...tbl, startY: y,
    head: [["Houve ocorrência?", "Descrição"]],
    body: [[rdo.ocorrencias?.houve ? "Sim" : "Não", rdo.ocorrencias?.descricao?.trim() || "-"]],
    columnStyles: { 0: { cellWidth: 36, fontStyle: "bold" } },
    didParseCell: (d: any) => {
      if (d.section === "body" && d.column.index === 0 && String(d.cell.raw) === "Sim") d.cell.styles.textColor = [190, 40, 40];
    },
  });
  afterTable(12);

  // ── Observações ──────────────────────────────────────────────────────────
  if (rdo.comentarios?.trim()) {
    sec("Observações");
    const lines = doc.splitTextToSize(rdo.comentarios, cW - 10);
    const bH = lines.length * 5 + 10; chk(bH);
    doc.setFillColor(250, 250, 250); doc.setDrawColor(230, 230, 230);
    doc.rect(marginX, y, cW, bH, "FD");
    doc.setTextColor(60, 60, 60); doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text(lines, marginX + 5, y + 7);
    y += bH + 12;
  }

  // ── Fotos ────────────────────────────────────────────────────────────────
  const fotos = rdo.fotos || [];
  if (fotos.length > 0) {
    sec("Registro Fotográfico");
    const bW = (cW / 2) - 5; const bH = 55;
    for (let i = 0; i < fotos.length; i++) {
      const foto = fotos[i];
      const isPar = i % 2 === 0;
      const xPos = isPar ? marginX : marginX + bW + 10;
      if (isPar) chk(bH + 20);
      if (foto.storagePath) {
        try {
          const { data: ud } = supabase.storage.from("rdo-photos").getPublicUrl(foto.storagePath);
          const blob = await (await fetch(ud.publicUrl)).blob();
          const b64 = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onloadend = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(blob); });
          const p = doc.getImageProperties(b64);
          let iW = bW, iH = (p.height * bW) / p.width;
          if (iH > bH) { iH = bH; iW = (p.width * bH) / p.height; }
          doc.setFillColor(248, 248, 248); doc.rect(xPos, y, bW, bH, "F");
          doc.addImage(b64, "JPEG", xPos + (bW - iW) / 2, y + (bH - iH) / 2, iW, iH);
          doc.setDrawColor(220); doc.rect(xPos, y, bW, bH, "S");
        } catch { doc.setFillColor(240, 240, 240); doc.rect(xPos, y, bW, bH, "F"); }
      }
      doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(120);
      doc.text(doc.splitTextToSize(foto.legenda || "Sem legenda", bW), xPos, y + bH + 4);
      if (!isPar || i === fotos.length - 1) y += bH + 15;
    }
  }

  drawFooterPageNumbers(doc, { pageWidth });

  const coverBytes = await buildRdoCoverBytes({ projectName, periodo: formatPeriodoAbreviado(rdo.data) });
  return mergePdfSources([coverBytes, doc]);
}
