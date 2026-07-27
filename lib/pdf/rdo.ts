import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/lib/supabase";
import { BRAND_PURPLE, BRAND_GREEN, generateWhiteLogoBase64, getLogoSize, drawHeaderBar, drawFooterPageNumbers } from "./brand";

export type RdoReport = {
  data: string;
  clima?: { periodo: string; tempo: string; condicao: string; razao?: string }[];
  envolvidos?: { empresa: string; colaboradores: string | number; funcao: string }[];
  atividades?: { atividade: string; empresa: string; status: string; obs?: string }[];
  sheq?: { incidente?: string; incidenteObs?: string; vazamento?: string; vazamentoObs?: string };
  comentarios?: string;
  fotos?: { storagePath: string; legenda?: string }[];
  assinaturas?: { empresa: string; assinatura?: string }[];
};

export async function buildRdoPdf(input: { rdo: RdoReport; projectName: string }): Promise<jsPDF> {
  const { rdo, projectName } = input;

  let whiteLogo: string | null = null;
  try { whiteLogo = await generateWhiteLogoBase64("/logo.png"); } catch {}

  const doc = new jsPDF("p", "mm", "a4");
  const marginX = 15;
  const pageWidth = doc.internal.pageSize.getWidth();
  const cW = pageWidth - marginX * 2;
  let y = 0;

  const lgray: [number, number, number] = [248, 248, 250];

  const [lW, lH] = whiteLogo ? await getLogoSize(whiteLogo, 10) : [33, 10];

  const header = () => {
    drawHeaderBar(doc, { pageWidth, logoBase64: whiteLogo, logoX: marginX, logoWidth: lW, logoHeight: lH });
    doc.setTextColor(255, 255, 255); doc.setFontSize(13); doc.setFont("helvetica", "bold");
    doc.text("RELATÓRIO DIÁRIO DE OBRA", pageWidth - marginX, 15, { align: "right" });
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text(`Projeto: ${projectName}   |   Data: ${rdo.data}`, pageWidth - marginX, 22, { align: "right" });
    doc.setFontSize(7.5); doc.setTextColor(180, 210, 120);
    doc.text("SHEQ n° 004   |   Versão V 00", pageWidth - marginX, 29, { align: "right" });
    doc.setTextColor(0, 0, 0);
  };

  const chk = (n: number) => {
    if (y + n > 275) { doc.addPage(); header(); y = 50; }
  };

  const sec = (title: string) => {
    chk(20);
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...BRAND_PURPLE);
    doc.text(title.toUpperCase(), marginX, y);
    doc.setDrawColor(...BRAND_GREEN); doc.setLineWidth(0.8);
    doc.line(marginX, y + 2, marginX + 15, y + 2);
    y += 10;
  };

  const tbl: any = {
    margin: { left: marginX, right: marginX },
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: BRAND_PURPLE, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [252, 252, 252] },
  };

  header(); y = 50;

  const total = rdo.envolvidos?.reduce((a: number, b: any) => a + (Number(b.colaboradores) || 0), 0) || 0;
  [
    { label: "EFETIVO TOTAL",     val: `${total} PESSOAS` },
    { label: "CLIMA",             val: rdo.clima?.[0]?.condicao || "N/A" },
    { label: "STATUS SEGURANÇA",  val: rdo.sheq?.incidente === "Não" ? "SEM OCORRÊNCIAS" : "ALERTA" },
  ].forEach((c, i) => {
    const x = marginX + i * (cW / 3 + 2);
    doc.setFillColor(...lgray); doc.roundedRect(x, y, cW / 3 - 4, 18, 1, 1, "F");
    doc.setFontSize(7); doc.setTextColor(100); doc.text(c.label, x + 4, y + 6);
    doc.setFontSize(9); doc.setTextColor(...BRAND_PURPLE); doc.setFont("helvetica", "bold");
    doc.text(c.val, x + 4, y + 13);
  });
  y += 28;

  sec("Condições Climáticas");
  autoTable(doc, { ...tbl, startY: y, head: [["Período","Tempo","Condição","Impacto/Razão"]], body: rdo.clima?.map((c: any) => [c.periodo, c.tempo, c.condicao, c.razao || "-"]) || [] });
  y = (doc as any).lastAutoTable.finalY + 12;

  sec("Mão de Obra e Efetivo");
  autoTable(doc, { ...tbl, startY: y, head: [["Empresa Parceira","N° Colaboradores","Função Principal"]], body: rdo.envolvidos?.map((e: any) => [e.empresa, e.colaboradores, e.funcao]) || [] });
  y = (doc as any).lastAutoTable.finalY + 12;

  sec("Progresso das Atividades");
  autoTable(doc, {
    ...tbl, startY: y,
    head: [["Atividade Realizada","Responsável","Status","Observações"]],
    body: rdo.atividades?.map((a: any) => [a.atividade, a.empresa, a.status, a.obs || "-"]) || [],
    didParseCell: (d: any) => {
      if (d.section === "body" && d.column.index === 2) {
        const s = String(d.cell.raw).toLowerCase();
        if (s.includes("conclu"))   d.cell.styles.textColor = [0, 150, 0];
        if (s.includes("andamento")) d.cell.styles.textColor = [200, 120, 0];
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 12;

  sec("Segurança, Saúde e Meio Ambiente (SHEQ)");
  autoTable(doc, { ...tbl, startY: y, head: [["Tipo","Houve Registro?","Descrição"]], body: [
    ["Incidentes de Segurança", rdo.sheq?.incidente || "Não", rdo.sheq?.incidenteObs || "-"],
    ["Vazamentos / Meio Ambiente", rdo.sheq?.vazamento || "Não", rdo.sheq?.vazamentoObs || "-"],
  ]});
  y = (doc as any).lastAutoTable.finalY + 12;

  if (rdo.comentarios) {
    sec("Notas e Comentários");
    const lines = doc.splitTextToSize(rdo.comentarios, cW - 10);
    const bH = lines.length * 5 + 10; chk(bH);
    doc.setFillColor(250, 250, 250); doc.setDrawColor(230, 230, 230);
    doc.rect(marginX, y, cW, bH, "FD");
    doc.setTextColor(60, 60, 60); doc.setFont("helvetica", "normal");
    doc.text(lines, marginX + 5, y + 7);
    y += bH + 15;
  }

  if (rdo.fotos && rdo.fotos.length > 0) {
    sec("Registro Fotográfico");
    const bW = (cW / 2) - 5; const bH = 55;
    for (let i = 0; i < rdo.fotos.length; i++) {
      const foto = rdo.fotos[i];
      const isPar = i % 2 === 0;
      const xPos  = isPar ? marginX : marginX + bW + 10;
      if (isPar) chk(bH + 20);
      if (foto.storagePath) {
        try {
          const { data: ud } = supabase.storage.from("rdo-photos").getPublicUrl(foto.storagePath);
          const blob = await (await fetch(ud.publicUrl)).blob();
          const b64  = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onloadend = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(blob); });
          const p = doc.getImageProperties(b64);
          let iW = bW, iH = (p.height * bW) / p.width;
          if (iH > bH) { iH = bH; iW = (p.width * bH) / p.height; }
          doc.setFillColor(248, 248, 248); doc.rect(xPos, y, bW, bH, "F");
          doc.addImage(b64, "JPEG", xPos + (bW - iW) / 2, y + (bH - iH) / 2, iW, iH);
          doc.setDrawColor(220); doc.rect(xPos, y, bW, bH, "S");
        } catch { doc.setFillColor(240, 240, 240); doc.rect(xPos, y, bW, bH, "F"); }
      }
      doc.setFontSize(7); doc.setTextColor(120);
      doc.text(doc.splitTextToSize(foto.legenda || "Sem legenda", bW), xPos, y + bH + 4);
      if (!isPar || i === rdo.fotos.length - 1) y += bH + 15;
    }
  }

  if (rdo.assinaturas && rdo.assinaturas.length > 0) {
    chk(50); sec("Assinaturas");
    y += 5;
    rdo.assinaturas.forEach((a: any, i: number) => {
      const xPos = i % 2 === 0 ? marginX : pageWidth / 2 + 5;
      chk(35);
      if (a.assinatura) { try { doc.addImage(a.assinatura, "PNG", xPos + 10, y, 40, 15); } catch {} }
      doc.setDrawColor(180); doc.line(xPos, y + 16, xPos + 60, y + 16);
      doc.setFontSize(8); doc.text(a.empresa || "Responsável", xPos, y + 21);
      if (i % 2 !== 0 || i === rdo.assinaturas!.length - 1) y += 30;
    });
  }

  drawFooterPageNumbers(doc, { pageWidth });

  return doc;
}
